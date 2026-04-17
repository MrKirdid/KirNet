--!strict

--[[
	Signal.luau - Signal implementation for KirNet.

	Three signal kinds:
	  ServerSignal ("server") - server fires events to clients, clients listen
	  ClientSignal ("client") - client fires events to server, server listens
	  Signal ("signal") - bidirectional signal with both APIs

	Strict directional enforcement: methods error immediately if called
	from the wrong side or with the wrong signal kind.
]]

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")

local Types = require(script.Parent.Types)
local Codec = require(script.Parent.Codec)
local Compression = require(script.Parent.Compression)
local Middleware = require(script.Parent.Middleware)
local Batcher = require(script.Parent.Batcher)

local IS_SERVER = RunService:IsServer()

local Signal = {}
Signal.__index = Signal

-- Flag bits
local FLAG_COMPRESSED: number = 0x01
local FLAG_BATCHED: number = 0x02
local FLAG_LOSSY: number = 0x04

-- Module-level references set by Registry
local _remoteEvent: RemoteEvent? = nil
local _debugEnabled = false

local function packArgs(...: any): { any }
	return table.pack(...)
end

local function unpackArgs(args: { any }): ...any
	local packed = args :: any
	return table.unpack(packed, 1, packed.n or #packed)
end

function Signal.setRemoteEvent(remote: RemoteEvent)
	_remoteEvent = remote
end

function Signal.setDebug(enabled: boolean)
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

	-- Reset counter every second
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

local function buildPacket(routeId: number, flags: number, payload: buffer): buffer
	local payloadLen = buffer.len(payload)
	-- [routeId: u16][flags: u8][payloadLength: u32][payload: bytes]
	local pkt = buffer.create(2 + 1 + 4 + payloadLen)
	buffer.writeu16(pkt, 0, routeId)
	buffer.writeu8(pkt, 2, flags)
	buffer.writeu32(pkt, 3, payloadLen)
	if payloadLen > 0 then
		buffer.copy(pkt, 7, payload, 0, payloadLen)
	end
	return pkt
end

local function buildBatchPacket(packets: { buffer }): buffer
	-- [BATCH_MARKER: u16][batchSize: u16][packet1][packet2]...
	local totalSize = 4 -- u16 marker + u16 count
	for _, pkt in packets do
		totalSize += buffer.len(pkt)
	end
	local batch = buffer.create(totalSize)
	buffer.writeu16(batch, 0, Batcher.BATCH_MARKER)
	buffer.writeu16(batch, 2, #packets)
	local cursor = 4
	for _, pkt in packets do
		local pktLen = buffer.len(pkt)
		buffer.copy(batch, cursor, pkt, 0, pktLen)
		cursor += pktLen
	end
	return batch
end

function Signal.new(kind: "server" | "client" | "signal", options: Types.SignalOptions?): Types.SignalImpl
	local self: Types.SignalImpl = {
		_options = options or {} :: Types.SignalOptions,
		_kind = kind,
		_id = nil,
		_serviceName = nil,
		_methodName = nil,
		_callbacks = {},
		_onceCallbacks = {},
		_waitingThreads = {},
		_isServer = IS_SERVER,
	}
	return setmetatable(self :: any, Signal) :: any
end

function Signal._init(self: any, serviceName: string, methodName: string, id: number)
	self._serviceName = serviceName
	self._methodName = methodName
	self._id = id

	local opts = self._options :: Types.SignalOptions
	if opts.batched and IS_SERVER and (self._kind == "server" or self._kind == "signal") then
		Batcher.register(id, function(entries: { Batcher.BatchEntry })
			Signal._flushBatch(self, entries)
		end)
	end
end

function Signal._flushBatch(_self: any, entries: { Batcher.BatchEntry })
	local remote = _remoteEvent
	if not remote then
		return
	end

	-- Separate entries with and without passthrough
	local normalEntries: { Batcher.BatchEntry } = {}
	local passthroughEntries: { Batcher.BatchEntry } = {}

	for _, entry in entries do
		if entry.passthrough and #entry.passthrough > 0 then
			table.insert(passthroughEntries, entry)
		else
			table.insert(normalEntries, entry)
		end
	end

	-- Send passthrough entries individually (can't batch with passthrough data)
	for _, entry in passthroughEntries do
		local pkt = buildPacket(entry.id, entry.flags, entry.payload)
		if entry.excludePlayer then
			for _, player in Players:GetPlayers() do
				if player ~= entry.excludePlayer then
					remote:FireClient(player, pkt, entry.passthrough)
				end
			end
		elseif entry.targets then
			for _, player in entry.targets do
				remote:FireClient(player, pkt, entry.passthrough)
			end
		else
			remote:FireAllClients(pkt, entry.passthrough)
		end
	end

	-- Batch normal entries as before
	if #normalEntries == 0 then
		return
	end

	-- Group entries by target pattern to send correct packets to correct recipients
	local groups: { [string]: { entries: { Batcher.BatchEntry }, sample: Batcher.BatchEntry } } = {}

	for _, entry in normalEntries do
		local key = "all"
		if entry.excludePlayer then
			key = "except:" .. tostring(entry.excludePlayer.UserId)
		elseif entry.targets then
			local ids = {}
			for _, p in entry.targets do
				table.insert(ids, tostring(p.UserId))
			end
			table.sort(ids)
			key = "players:" .. table.concat(ids, ",")
		end

		if not groups[key] then
			groups[key] = { entries = {}, sample = entry }
		end
		table.insert(groups[key].entries, entry)
	end

	for _, group in groups do
		local allPackets: { buffer } = {}
		for _, entry in group.entries do
			-- Preserve original flags (compression, lossy) and add batched flag
			table.insert(allPackets, buildPacket(entry.id, bit32.bor(entry.flags, FLAG_BATCHED), entry.payload))
		end

		if #allPackets == 0 then
			continue
		end

		local batchPkt = buildBatchPacket(allPackets)
		local sample = group.sample

		if sample.excludePlayer then
			for _, player in Players:GetPlayers() do
				if player ~= sample.excludePlayer then
					remote:FireClient(player, batchPkt)
				end
			end
		elseif sample.targets then
			for _, player in sample.targets do
				remote:FireClient(player, batchPkt)
			end
		else
			remote:FireAllClients(batchPkt)
		end
	end
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

	-- Compress if above threshold
	if Compression.shouldCompress(rawSize, compressionThreshold) then
		local ok, compressed = pcall(Compression.compress, payload)
		if ok and buffer.len(compressed) < rawSize then
			payload = compressed
			flags = bit32.bor(flags, FLAG_COMPRESSED)
		end
	end

	if _debugEnabled and self._serviceName and self._methodName then
		local compressedSize = buffer.len(payload)
		if bit32.band(flags, FLAG_COMPRESSED) ~= 0 then
			local saved = math.floor((1 - compressedSize / rawSize) * 100)
			print(
				string.format(
					"[KirNet] %s.%s | raw: %db | compressed: %db | saved: %d%%",
					self._serviceName,
					self._methodName,
					rawSize,
					compressedSize,
					saved
				)
			)
		end
	end

	return payload, flags, passthrough
end

-- Strict direction helpers
local function assertServerSignalOnServer(self: any, method: string)
	if self._kind ~= "server" and self._kind ~= "signal" then
		error(
			string.format(
				"[KirNet] %s.%s:%s() failed — %s is only available on ServerSignal or Signal, not ClientSignal.",
				self._serviceName or "?",
				self._methodName or "?",
				method,
				method
			)
		)
	end
	if not IS_SERVER then
		error(
			string.format(
				"[KirNet] %s.%s:%s() failed — Fire methods can only be called on the server.",
				self._serviceName or "?",
				self._methodName or "?",
				method
			)
		)
	end
end

local function assertClientSignalOnClient(self: any, method: string)
	if self._kind ~= "client" and self._kind ~= "signal" then
		error(
			string.format(
				"[KirNet] %s.%s:%s() failed — FireServer is only available on ClientSignal or Signal, not ServerSignal.",
				self._serviceName or "?",
				self._methodName or "?",
				method
			)
		)
	end
	if IS_SERVER then
		error(
			string.format(
				"[KirNet] %s.%s:%s() failed — FireServer can only be called on the client.",
				self._serviceName or "?",
				self._methodName or "?",
				method
			)
		)
	end
end

local function assertServerSignalOnClient(self: any, method: string)
	if self._kind ~= "server" and self._kind ~= "signal" then
		error(
			string.format(
				"[KirNet] %s.%s:%s() failed — %s is only available on ServerSignal or Signal (server-to-client), not ClientSignal.",
				self._serviceName or "?",
				self._methodName or "?",
				method,
				method
			)
		)
	end
	if IS_SERVER then
		error(
			string.format(
				"[KirNet] %s.%s:%s() failed — Client listener methods can only be used on the client.",
				self._serviceName or "?",
				self._methodName or "?",
				method
			)
		)
	end
end

local function assertClientSignalOnServer(self: any, method: string)
	if self._kind ~= "client" and self._kind ~= "signal" then
		error(
			string.format(
				"[KirNet] %s.%s:%s() failed — OnServerEvent is only available on ClientSignal or Signal, not ServerSignal.",
				self._serviceName or "?",
				self._methodName or "?",
				method
			)
		)
	end
	if not IS_SERVER then
		error(
			string.format(
				"[KirNet] %s.%s:%s() failed — OnServerEvent can only be used on the server.",
				self._serviceName or "?",
				self._methodName or "?",
				method
			)
		)
	end
end

--- Server -> single player (ServerSignal only, server only)
function Signal.Fire(self: any, player: Player, ...: any)
	assertServerSignalOnServer(self, "Fire")
	local remote = _remoteEvent
	if not remote or not self._id then
		return
	end

	local context: Types.MiddlewareContext = {
		name = self._methodName or "",
		service = self._serviceName or "",
		player = nil,
		payload = packArgs(...),
		direction = "s2c",
	}
	if not Middleware.execute(context) then
		return
	end

	local payload, flags, passthrough = preparePayload(self, unpackArgs(context.payload))
	local opts = self._options :: Types.SignalOptions

	if opts.batched and Batcher.hasBatch(self._id) then
		Batcher.enqueue(self._id, {
			id = self._id,
			flags = flags,
			payload = payload,
			passthrough = if #passthrough > 0 then passthrough else nil,
			targets = { player },
			excludePlayer = nil,
			isFireAll = false,
		})
	else
		local pkt = buildPacket(self._id, flags, payload)

		if _debugEnabled then
			print(string.format("[KirNet] %s.%s -> %s", self._serviceName or "?", self._methodName or "?", player.Name))
		end

		if #passthrough > 0 then
			remote:FireClient(player, pkt, passthrough)
		else
			remote:FireClient(player, pkt)
		end
	end
end

--- Server -> all players (ServerSignal only, server only)
function Signal.FireAll(self: any, ...: any)
	assertServerSignalOnServer(self, "FireAll")
	local remote = _remoteEvent
	if not remote or not self._id then
		return
	end

	local context: Types.MiddlewareContext = {
		name = self._methodName or "",
		service = self._serviceName or "",
		player = nil,
		payload = packArgs(...),
		direction = "s2c",
	}
	if not Middleware.execute(context) then
		return
	end

	local payload, flags, passthrough = preparePayload(self, unpackArgs(context.payload))
	local opts = self._options :: Types.SignalOptions

	if opts.batched and Batcher.hasBatch(self._id) then
		Batcher.enqueue(self._id, {
			id = self._id,
			flags = flags,
			payload = payload,
			passthrough = if #passthrough > 0 then passthrough else nil,
			targets = nil,
			excludePlayer = nil,
			isFireAll = true,
		})
	else
		local pkt = buildPacket(self._id, flags, payload)
		if #passthrough > 0 then
			remote:FireAllClients(pkt, passthrough)
		else
			remote:FireAllClients(pkt)
		end
	end
end

--- Server -> all except one player (ServerSignal only, server only)
function Signal.FireExcept(self: any, player: Player, ...: any)
	assertServerSignalOnServer(self, "FireExcept")
	local remote = _remoteEvent
	if not remote or not self._id then
		return
	end

	local context: Types.MiddlewareContext = {
		name = self._methodName or "",
		service = self._serviceName or "",
		player = nil,
		payload = packArgs(...),
		direction = "s2c",
	}
	if not Middleware.execute(context) then
		return
	end

	local payload, flags, passthrough = preparePayload(self, unpackArgs(context.payload))
	local opts = self._options :: Types.SignalOptions

	if opts.batched and Batcher.hasBatch(self._id) then
		Batcher.enqueue(self._id, {
			id = self._id,
			flags = flags,
			payload = payload,
			passthrough = if #passthrough > 0 then passthrough else nil,
			targets = nil,
			excludePlayer = player,
			isFireAll = false,
		})
	else
		local pkt = buildPacket(self._id, flags, payload)
		for _, p in Players:GetPlayers() do
			if p ~= player then
				if #passthrough > 0 then
					remote:FireClient(p, pkt, passthrough)
				else
					remote:FireClient(p, pkt)
				end
			end
		end
	end
end

--- Server -> list of players (ServerSignal only, server only)
function Signal.FireList(self: any, players: { Player }, ...: any)
	assertServerSignalOnServer(self, "FireList")
	local remote = _remoteEvent
	if not remote or not self._id then
		return
	end

	local context: Types.MiddlewareContext = {
		name = self._methodName or "",
		service = self._serviceName or "",
		player = nil,
		payload = packArgs(...),
		direction = "s2c",
	}
	if not Middleware.execute(context) then
		return
	end

	local payload, flags, passthrough = preparePayload(self, unpackArgs(context.payload))
	local opts = self._options :: Types.SignalOptions

	if opts.batched and Batcher.hasBatch(self._id) then
		Batcher.enqueue(self._id, {
			id = self._id,
			flags = flags,
			payload = payload,
			passthrough = if #passthrough > 0 then passthrough else nil,
			targets = players,
			excludePlayer = nil,
			isFireAll = false,
		})
	else
		local pkt = buildPacket(self._id, flags, payload)
		for _, p in players do
			if #passthrough > 0 then
				remote:FireClient(p, pkt, passthrough)
			else
				remote:FireClient(p, pkt)
			end
		end
	end
end

--- Client -> Server (ClientSignal only, client only)
function Signal.FireServer(self: any, ...: any)
	assertClientSignalOnClient(self, "FireServer")
	local remote = _remoteEvent
	if not remote or not self._id then
		return
	end

	local context: Types.MiddlewareContext = {
		name = self._methodName or "",
		service = self._serviceName or "",
		player = nil,
		payload = packArgs(...),
		direction = "c2s",
	}
	if not Middleware.execute(context) then
		return
	end

	local payload, flags, passthrough = preparePayload(self, unpackArgs(context.payload))
	local pkt = buildPacket(self._id, flags, payload)
	if #passthrough > 0 then
		remote:FireServer(pkt, passthrough)
	else
		remote:FireServer(pkt)
	end
end

--- Connect a callback to listen for server broadcasts (ServerSignal, client only)
function Signal.Connect(self: any, callback: (...any) -> ())
	assertServerSignalOnClient(self, "Connect")
	table.insert(self._callbacks, callback)
end

--- Listen for client-to-server events (ClientSignal, server only)
function Signal.OnServerEvent(self: any, callback: (player: Player, ...any) -> ())
	assertClientSignalOnServer(self, "OnServerEvent")
	table.insert(self._callbacks, callback)
end

--- Connect a callback that fires once then auto-disconnects (ServerSignal, client only)
function Signal.Once(self: any, callback: (...any) -> ())
	assertServerSignalOnClient(self, "Once")
	table.insert(self._onceCallbacks, callback)
end

--- Yield until the signal fires or timeout expires (ServerSignal, client only)
function Signal.Wait(self: any, timeout: number?): ...any
	assertServerSignalOnClient(self, "Wait")
	local thread = coroutine.running()
	local timedOut = false
	local timeoutValue = timeout or 0
	table.insert(self._waitingThreads, thread)

	if timeout then
		task.delay(timeoutValue, function()
			local idx = table.find(self._waitingThreads, thread)
			if idx then
				table.remove(self._waitingThreads, idx)
				timedOut = true
				task.spawn(thread)
			end
		end)
	end

	local results = packArgs(coroutine.yield())

	if timedOut then
		error(string.format("[KirNet] ERROR: Signal:Wait() timed out after %d seconds.", timeoutValue))
	end

	return unpackArgs(results)
end

--- Disconnect all callbacks (ServerSignal, client only)
function Signal.Disconnect(self: any)
	assertServerSignalOnClient(self, "Disconnect")
	table.clear(self._callbacks)
	table.clear(self._onceCallbacks)
	for _, thread in self._waitingThreads do
		task.defer(thread)
	end
	table.clear(self._waitingThreads)
end

--- Internal: Dispatch received data to callbacks
function Signal._dispatch(self: any, ...: any)
	for _, cb in self._callbacks do
		task.spawn(cb :: (...any) -> (), ...)
	end

	local onceCbs = table.clone(self._onceCallbacks)
	table.clear(self._onceCallbacks)
	for _, cb in onceCbs do
		task.spawn(cb :: (...any) -> (), ...)
	end

	local waiting = table.clone(self._waitingThreads)
	table.clear(self._waitingThreads)
	for _, thread in waiting do
		task.spawn(thread :: thread, ...)
	end
end

--- Internal: Handle rate limiting check for incoming c2s signals
function Signal._checkRate(self: any, player: Player): boolean
	local opts = self._options :: Types.SignalOptions
	if not opts.rateLimit or not self._id then
		return true
	end
	return checkRateLimit(self._id, player, opts.rateLimit, self._serviceName or "", self._methodName or "")
end

--- Parse packet and decode payload (decompresses if FLAG_COMPRESSED is set)
function Signal.parsePacket(pkt: buffer): (number, number, buffer)
	local routeId = buffer.readu16(pkt, 0)
	local flags = buffer.readu8(pkt, 2)
	local payloadLen = buffer.readu32(pkt, 3)
	local payload = buffer.create(payloadLen)
	if payloadLen > 0 then
		buffer.copy(payload, 0, pkt, 7, payloadLen)
	end

	-- Decompress if needed (buffer in, buffer out)
	if bit32.band(flags, FLAG_COMPRESSED) ~= 0 then
		local ok, decompressed = pcall(Compression.decompress, payload)
		if ok then
			payload = decompressed
		else
			warn(string.format("[KirNet] WARN: Decompression failed for route %d: %s", routeId, tostring(decompressed)))
		end
	end

	return routeId, flags, payload
end

--- Check if a packet is a batch
function Signal.isBatch(pkt: buffer): boolean
	return buffer.len(pkt) >= 4 and buffer.readu16(pkt, 0) == Batcher.BATCH_MARKER
end

--- Parse batch packet into individual packets
function Signal.parseBatch(pkt: buffer): { buffer }
	local count = buffer.readu16(pkt, 2)
	local packets: { buffer } = {}
	local cursor = 4

	for _ = 1, count do
		if cursor + 7 > buffer.len(pkt) then
			warn("[KirNet] WARN: Batch packet truncated, stopping parse.")
			break
		end
		-- Each sub-packet: [routeId: u16][flags: u8][payloadLength: u32][payload]
		local payloadLen = buffer.readu32(pkt, cursor + 3)
		local pktLen = 7 + payloadLen
		if cursor + pktLen > buffer.len(pkt) then
			warn("[KirNet] WARN: Batch sub-packet exceeds buffer, stopping parse.")
			break
		end
		local subPkt = buffer.create(pktLen)
		buffer.copy(subPkt, 0, pkt, cursor, pktLen)
		table.insert(packets, subPkt)
		cursor += pktLen
	end

	return packets
end

return Signal
