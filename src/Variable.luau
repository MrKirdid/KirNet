--!strict

--[[
	Variable.luau — Server-replicated state for KirNet.

	Variables hold a value on the server that auto-syncs to all clients.
	Server: Set(value), Get()
	Client: Get(), OnChanged(callback)
]]

local RunService = game:GetService("RunService")

local Types = require(script.Parent.Types)
local Codec = require(script.Parent.Codec)
local Compression = require(script.Parent.Compression)

local IS_SERVER = RunService:IsServer()

local Variable = {}
Variable.__index = Variable

local FLAG_COMPRESSED: number = 0x01

local _remoteEvent: RemoteEvent? = nil
local _debugEnabled = false

function Variable.setRemoteEvent(remote: RemoteEvent)
	_remoteEvent = remote
end

function Variable.setDebug(enabled: boolean)
	_debugEnabled = enabled
end

function Variable.new(initialValue: any): Types.VariableImpl
	local self: Types.VariableImpl = {
		_value = initialValue,
		_callbacks = {},
		_id = nil,
		_serviceName = nil,
		_methodName = nil,
		_isServer = IS_SERVER,
		_isVariable = true,
	}
	return setmetatable(self :: any, Variable) :: any
end

function Variable._init(self: any, serviceName: string, methodName: string, id: number)
	self._serviceName = serviceName
	self._methodName = methodName
	self._id = id
end

--- Get the current value of the variable.
function Variable.Get(self: any): any
	return self._value
end

--- Set the value and replicate to all clients. Server only.
function Variable.Set(self: any, value: any)
	if not IS_SERVER then
		error(
			string.format(
				"[KirNet] %s.%s:Set() failed — Set() can only be called on the server.",
				self._serviceName or "?",
				self._methodName or "?"
			)
		)
	end

	local oldValue = self._value
	self._value = value

	-- Fire local callbacks
	for _, cb in self._callbacks do
		task.spawn(cb, value, oldValue)
	end

	-- Replicate to all clients
	local remote = _remoteEvent
	if not remote or not self._id then
		return
	end

	local payload, passthrough = Codec.encode(2, false, value)
	local rawSize = buffer.len(payload)
	local flags: number = 0

	if Compression.shouldCompress(rawSize, 64) then
		local ok, compressed = pcall(Compression.compress, payload)
		if ok and buffer.len(compressed) < rawSize then
			payload = compressed
			flags = bit32.bor(flags, FLAG_COMPRESSED)
		end
	end

	-- Build packet: [routeId: u16][flags: u8][payloadLen: u32][payload]
	local payloadLen = buffer.len(payload)
	local pkt = buffer.create(2 + 1 + 4 + payloadLen)
	buffer.writeu16(pkt, 0, self._id)
	buffer.writeu8(pkt, 2, flags)
	buffer.writeu32(pkt, 3, payloadLen)
	if payloadLen > 0 then
		buffer.copy(pkt, 7, payload, 0, payloadLen)
	end

	if _debugEnabled then
		print(string.format("[KirNet] %s.%s:Set() -> all clients", self._serviceName or "?", self._methodName or "?"))
	end

	if #passthrough > 0 then
		remote:FireAllClients(pkt, passthrough)
	else
		remote:FireAllClients(pkt)
	end
end

--- Listen for value changes. Works on both server and client.
function Variable.OnChanged(self: any, callback: (any, any) -> ())
	table.insert(self._callbacks, callback)
end

--- Internal: dispatch a received variable update (client-side).
function Variable._dispatch(self: any, ...: any)
	local oldValue = self._value
	local newValue = select(1, ...)
	self._value = newValue

	for _, cb in self._callbacks do
		task.spawn(cb, newValue, oldValue)
	end
end

--- Internal: get the current value for routing table replication.
function Variable._getInitialValue(self: any): any
	return self._value
end

return Variable
