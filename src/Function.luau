--!strict

--[[
	Function.luau - ServerFunction (request/response) implementation for KirNet.

	Defined server-side with a handler. Called client-side, yields and returns
	the server's response directly. Uses the shared RemoteFunction for invocation.

	Strict directional enforcement:
	  - Call() can only be used on the client
	  - Handler is provided at creation time on the server
	  - Rate limiting is enforced on the server for incoming calls
]]

local RunService = game:GetService("RunService")
local Players = game:GetService("Players")

local Types = require(script.Parent.Types)
local Codec = require(script.Parent.Codec)
local Compression = require(script.Parent.Compression)
local Middleware = require(script.Parent.Middleware)

local IS_SERVER = RunService:IsServer()

local KirFunction = {}
KirFunction.__index = KirFunction

local FLAG_COMPRESSED: number = 0x01
local FLAG_LOSSY: number = 0x04

local _remoteFunction: RemoteFunction? = nil
local _debugEnabled = false

local function packArgs(...: any): { any }
	return table.pack(...)
end

local function unpackArgs(args: { any }): ...any
	local packed = args :: any
	return table.unpack(packed, 1, packed.n or #packed)
end

function KirFunction.setRemoteFunction(remote: RemoteFunction)
	_remoteFunction = remote
end

function KirFunction.setDebug(enabled: boolean)
	_debugEnabled = enabled
end

-- Rate limiting state: [routeId] -> [playerId] -> { count, lastReset }
local _rateLimits: { [number]: { [number]: { count: number, lastReset: number } } } = {}

if IS_SERVER then
	Players.PlayerRemoving:Connect(function(player)
		local userId = player.UserId
		for _, playerLimits in _rateLimits do
			playerLimits[userId] = nil
		end
	end)
end

local function checkRateLimit(
	routeId: number,
	player: Player,
	limit: number,
	serviceName: string,
	methodName: string
): boolean
	if not _rateLimits[routeId] then
		_rateLimits[routeId] = {}
	end
	local playerLimits = _rateLimits[routeId]
	local userId = player.UserId

	local now = os.clock()
	local entry = playerLimits[userId]
	if not entry then
		entry = { count = 0, lastReset = now }
		playerLimits[userId] = entry
	end

	if now - entry.lastReset >= 1 then
		entry.count = 0
		entry.lastReset = now
	end

	entry.count += 1
	if entry.count > limit then
		warn(
			string.format(
				"[KirNet] WARN: %s.%s rate limited for %s (%d/%d per sec)",
				serviceName,
				methodName,
				player.Name,
				entry.count,
				limit
			)
		)
		return false
	end
	return true
end

function KirFunction.new(
	handler: ((player: Player, ...any) -> ...any)?,
	options: Types.SignalOptions?
): Types.FunctionImpl
	local self: Types.FunctionImpl = {
		_options = options or {} :: Types.SignalOptions,
		_id = nil,
		_serviceName = nil,
		_methodName = nil,
		_handler = handler,
		_isServer = IS_SERVER,
	}
	return setmetatable(self :: any, KirFunction) :: any
end

function KirFunction._init(self: any, serviceName: string, methodName: string, id: number)
	self._serviceName = serviceName
	self._methodName = methodName
	self._id = id
end

local function preparePayload(self: any, ...: any): (buffer, number, { any })
	local opts = self._options :: Types.SignalOptions
	local precision = opts.precision or 2
	local lossy = opts.lossy or false
	local compressionThreshold = opts.compressionThreshold or 64

	local payload, passthrough = Codec.encode(precision, lossy, ...)
	local rawSize = buffer.len(payload)
	local flags: number = 0

	if lossy then
		flags = bit32.bor(flags, FLAG_LOSSY)
	end

	if Compression.shouldCompress(rawSize, compressionThreshold) then
		local ok, compressed = pcall(Compression.compress, payload)
		if ok and buffer.len(compressed) < rawSize then
			payload = compressed
			flags = bit32.bor(flags, FLAG_COMPRESSED)
		end
	end

	return payload, flags, passthrough
end

local function buildPacket(routeId: number, flags: number, payload: buffer): buffer
	local payloadLen = buffer.len(payload)
	local pkt = buffer.create(2 + 1 + 4 + payloadLen)
	buffer.writeu16(pkt, 0, routeId)
	buffer.writeu8(pkt, 2, flags)
	buffer.writeu32(pkt, 3, payloadLen)
	if payloadLen > 0 then
		buffer.copy(pkt, 7, payload, 0, payloadLen)
	end
	return pkt
end

local function decodePacket(pkt: buffer): (number, buffer)
	local flags = buffer.readu8(pkt, 2)
	local payloadLen = buffer.readu32(pkt, 3)
	local payload = buffer.create(payloadLen)
	if payloadLen > 0 then
		buffer.copy(payload, 0, pkt, 7, payloadLen)
	end

	if bit32.band(flags, FLAG_COMPRESSED) ~= 0 then
		local ok, decompressed = pcall(Compression.decompress, payload)
		if ok then
			payload = decompressed
		else
			warn(string.format("[KirNet] WARN: Function decompression failed: %s", tostring(decompressed)))
		end
	end

	return buffer.readu16(pkt, 0), payload
end

--- Client calls the function -> yields and returns the server's response directly.
--- ServerFunction only, client only.
function KirFunction.Call(self: any, ...: any): ...any
	if IS_SERVER then
		error(
			string.format(
				"[KirNet] %s.%s:Call() failed - Call() can only be used on the client.",
				self._serviceName or "?",
				self._methodName or "?"
			)
		)
	end

	local remote = _remoteFunction
	if not remote or not self._id then
		error("[KirNet] Remote not ready. Is the service registered?")
	end

	local context: Types.MiddlewareContext = {
		name = self._methodName or "",
		service = self._serviceName or "",
		player = nil,
		payload = packArgs(...),
		direction = "c2s",
	}
	if not Middleware.execute(context) then
		error("[KirNet] Blocked by middleware")
	end

	local routeId = self._id
	local payload, flags, passthrough = preparePayload(self, unpackArgs(context.payload))
	local pkt = buildPacket(routeId, flags, payload)

	if _debugEnabled then
		print(string.format("[KirNet] %s.%s:Call() -> server", self._serviceName or "?", self._methodName or "?"))
	end

	local result, resultPassthrough
	if #passthrough > 0 then
		result, resultPassthrough = remote:InvokeServer(pkt, passthrough)
	else
		result, resultPassthrough = remote:InvokeServer(pkt)
	end

	if typeof(result) == "buffer" then
		local _, responsePayload = decodePacket(result)
		local opts = self._options :: Types.SignalOptions
		local p = if opts.lossy then opts.precision or 2 else nil
		local pt = if typeof(resultPassthrough) == "table" then resultPassthrough else nil
		return Codec.decode(responsePayload, p, pt)
	end

	return result
end

--- Internal: Handle an incoming function invoke on the server side.
--- Includes rate limiting enforcement.
function KirFunction._handleInvoke(self: any, player: Player, pkt: buffer, passthrough: { any }?): (buffer?, { any }?)
	if not self._handler then
		warn(
			string.format(
				"[KirNet] %s.%s has no handler registered.",
				self._serviceName or "?",
				self._methodName or "?"
			)
		)
		return nil, nil
	end

	-- Rate limiting for incoming client calls
	local opts = self._options :: Types.SignalOptions
	if opts.rateLimit and self._id then
		if not checkRateLimit(self._id, player, opts.rateLimit, self._serviceName or "", self._methodName or "") then
			return nil, nil
		end
	end

	local _, payload = decodePacket(pkt)
	local p = if opts.lossy then opts.precision or 2 else nil
	local args = packArgs(Codec.decode(payload, p, passthrough))

	local context: Types.MiddlewareContext = {
		name = self._methodName or "",
		service = self._serviceName or "",
		player = player,
		payload = args,
		direction = "c2s",
	}
	if not Middleware.execute(context) then
		return nil
	end

	if _debugEnabled then
		print(
			string.format(
				"[KirNet] %s.%s:_handleInvoke() from %s",
				self._serviceName or "?",
				self._methodName or "?",
				player.Name
			)
		)
	end

	local results = packArgs(self._handler(player, unpackArgs(context.payload)))
	local responsePayload, responseFlags, responsePassthrough = preparePayload(self, unpackArgs(results))
	local responsePkt = buildPacket(self._id or 0, responseFlags, responsePayload)
	if #responsePassthrough > 0 then
		return responsePkt, responsePassthrough
	end
	return responsePkt, nil
end

return KirFunction
