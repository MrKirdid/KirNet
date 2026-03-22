--!strict

--[[
	Router.luau — Maps "serviceName.methodName" to a u16 identifier.

	The server builds the routing table at registration time and replicates
	it to clients upon connection.
]]

local Router = {}

local _nextId: number = 1
local _nameToId: { [string]: number } = {}
local _idToName: { [number]: string } = {}

--- Register a route and return its u16 id.
function Router.register(serviceName: string, methodName: string): number
	local key = serviceName .. "." .. methodName
	if _nameToId[key] then
		return _nameToId[key]
	end

	local id = _nextId
	_nextId += 1
	if _nextId == 0xFFFF then
		_nextId += 1
	end
	_nameToId[key] = id
	_idToName[id] = key
	return id
end

--- Look up an id from "serviceName.methodName".
function Router.getId(serviceName: string, methodName: string): number?
	return _nameToId[serviceName .. "." .. methodName]
end

--- Look up the "serviceName.methodName" key from an id.
function Router.getName(id: number): string?
	return _idToName[id]
end

--- Parse a routing key into (serviceName, methodName).
function Router.parse(key: string): (string, string)
	local dot = string.find(key, ".", 1, true)
	if not dot then
		return key, ""
	end
	return string.sub(key, 1, dot - 1), string.sub(key, dot + 1)
end

--- Export the full routing table for replication to clients.
function Router.export(): { [string]: number }
	local copy: { [string]: number } = {}
	for k, v in _nameToId do
		copy[k] = v
	end
	return copy
end

--- Import a routing table received from the server (client-side).
function Router.import(routingTable: { [string]: number })
	for key, id in routingTable do
		_nameToId[key] = id
		_idToName[id] = key
		if id >= _nextId then
			_nextId = id + 1
		end
	end
end

--- Get the full name-to-id table (read-only usage).
function Router.getTable(): { [string]: number }
	return _nameToId
end

return Router
