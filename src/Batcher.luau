--!strict

--[[
	Batcher.luau — Per-signal/function batching for KirNet.

	When batching is enabled for a signal, all calls within the same
	RunService.Heartbeat frame are collected and sent as a single
	remote fire at the end of the frame.
]]

local RunService = game:GetService("RunService")

local Batcher = {}

export type BatchEntry = {
	id: number,
	flags: number,
	payload: buffer,
	targets: { Player }?, -- nil = FireAll, empty = specific list
	excludePlayer: Player?, -- for FireExcept
	isFireAll: boolean,
}

export type BatchQueue = {
	entries: { BatchEntry },
	flush: ((queue: { BatchEntry }) -> ())?,
}

local _queues: { [number]: BatchQueue } = {}
local _connected = false
local _heartbeatConnection: RBXScriptConnection? = nil

local function flushAll()
	for id, queue in _queues do
		if #queue.entries > 0 and queue.flush then
			queue.flush(queue.entries)
			table.clear(queue.entries)
		end
	end
end

local function ensureHeartbeat()
	if _connected then
		return
	end
	_connected = true
	_heartbeatConnection = RunService.Heartbeat:Connect(flushAll)
end

--- Register a batch queue for a remote id.
function Batcher.register(id: number, flushFn: (queue: { BatchEntry }) -> ())
	_queues[id] = {
		entries = {},
		flush = flushFn,
	}
	ensureHeartbeat()
end

--- Add an entry to the batch queue for a remote id.
function Batcher.enqueue(id: number, entry: BatchEntry)
	local queue = _queues[id]
	if not queue then
		return
	end
	table.insert(queue.entries, entry)
end

--- Check if a remote id has batching enabled.
function Batcher.hasBatch(id: number): boolean
	return _queues[id] ~= nil
end

--- Manually flush a specific queue (for testing or immediate dispatch).
function Batcher.flush(id: number)
	local queue = _queues[id]
	if queue and #queue.entries > 0 and queue.flush then
		queue.flush(queue.entries)
		table.clear(queue.entries)
	end
end

--- Clean up all queues and disconnect heartbeat.
function Batcher.destroy()
	table.clear(_queues)
	if _heartbeatConnection then
		_heartbeatConnection:Disconnect()
		_heartbeatConnection = nil
	end
	_connected = false
end

--- Batch marker constant (u16)
Batcher.BATCH_MARKER = 0xFFFF

return Batcher
