--!strict

--[[
	Function.luau — Function (request/response) implementation for KirNet.

	Defined server-side with a handler. Called client-side, yields and returns
	the server's response directly. Uses the shared RemoteFunction for invocation.
]]

local RunService = game:GetService("RunService")

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

function KirFunction.setRemoteFunction(remote: RemoteFunction)
	_remoteFunction = remote
end

function KirFunction.setDebug(enabled: boolean)
	_debugEnabled = enabled
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

local function preparePayload(self: any, ...: any): (buffer, number)
	local opts = self._options :: Types.SignalOptions
	local precision = opts.precision or 2
	local lossy = opts.lossy or false
	local compressionThreshold = opts.compressionThreshold or 64

	local payload = Codec.encode(precision, lossy, ...)
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

	return payload, flags
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
		end
	end

	return buffer.readu16(pkt, 0), payload
end

--- Client calls the function → yields and returns the server's response directly.
function KirFunction.Call(self: any, ...: any): ...any
	if IS_SERVER then
		warn("[KirNet] WARNING: Function:Call() should only be used on the client.")
		return nil
	end

	local remote = _remoteFunction
	if not remote or not self._id then
		error("[KirNet] Remote not ready")
	end

	local context: Types.MiddlewareContext = {
		name = self._methodName or "",
		service = self._serviceName or "",
		player = nil,
		payload = { ... },
		direction = "c2s",
	}
	if not Middleware.execute(context) then
		error("[KirNet] Blocked by middleware")
	end

	local routeId = self._id
	local payload, flags = preparePayload(self, table.unpack(context.payload))
	local pkt = buildPacket(routeId, flags, payload)

	local result = remote:InvokeServer(pkt)

	if typeof(result) == "buffer" then
		local _, responsePayload = decodePacket(result)
		return Codec.decode(responsePayload)
	end

	return result
end

--- Internal: Handle an incoming function invoke on the server side
function KirFunction._handleInvoke(self: any, player: Player, pkt: buffer): buffer?
	if not self._handler then
		return nil
	end

	local _, payload = decodePacket(pkt)
	local args = { Codec.decode(payload) }

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

	local results = { self._handler(player, table.unpack(context.payload)) }
	local responsePayload, responseFlags = preparePayload(self, table.unpack(results))
	return buildPacket(self._id or 0, responseFlags, responsePayload)
end

return KirFunction
