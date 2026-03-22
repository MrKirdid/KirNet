--!strict

--[[
	Registry.luau — Stores registered services/controllers and their remotes.

	Server: creates remotes, registers services, replicates routing table.
	Client: receives routing table, resolves GetService calls.
]]

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local Types = require(script.Parent.Types)
local Router = require(script.Parent.Router)
local Codec = require(script.Parent.Codec)
local Signal = require(script.Parent.Signal)
local KirFunction = require(script.Parent.Function)

local IS_SERVER = RunService:IsServer()

local Registry = {}

-- Registered services: name → { [methodName]: SignalImpl | FunctionImpl }
local _services: { [string]: { [string]: any } } = {}

-- Registered controllers (client-side): name → { [methodName]: SignalImpl | FunctionImpl }
local _controllers: { [string]: { [string]: any } } = {}

-- Threads waiting for a service to be registered (client-side)
local _waitingForService: { [string]: { thread } } = {}

-- Whether the client has received the routing table
local _clientReady = false

-- Route type map: routeId → "signal" | "function" (client-side, received from server)
local _routeTypes: { [number]: string } = {}

-- The container folder for KirNet remotes
local FOLDER_NAME = "__KirNet"

-- Remote instances
local _remoteEvent: RemoteEvent? = nil
local _remoteFunction: RemoteFunction? = nil
local _routingRemote: RemoteEvent? = nil -- server→client routing table replication

local _debugEnabled = false

function Registry.setDebug(enabled: boolean)
	_debugEnabled = enabled
	Signal.setDebug(enabled)
	KirFunction.setDebug(enabled)
end

local function getOrCreateFolder(): Folder
	local folder = ReplicatedStorage:FindFirstChild(FOLDER_NAME) :: Folder?
	if not folder then
		if IS_SERVER then
			folder = Instance.new("Folder")
			folder.Name = FOLDER_NAME
			folder.Parent = ReplicatedStorage
		else
			folder = ReplicatedStorage:WaitForChild(FOLDER_NAME, 30) :: Folder
			if not folder then
				error("[KirNet] ERROR: Could not find remote folder. Is the server running KirNet?")
			end
		end
	end
	return folder :: Folder
end

local function ensureRemotes()
	if _remoteEvent and _remoteFunction and _routingRemote then
		return
	end

	local folder = getOrCreateFolder()

	if IS_SERVER then
		_remoteEvent = Instance.new("RemoteEvent")
		_remoteEvent.Name = "KirNetEvent"
		_remoteEvent.Parent = folder

		_remoteFunction = Instance.new("RemoteFunction")
		_remoteFunction.Name = "KirNetFunction"
		_remoteFunction.Parent = folder

		_routingRemote = Instance.new("RemoteEvent")
		_routingRemote.Name = "KirNetRouting"
		_routingRemote.Parent = folder
	else
		_remoteEvent = folder:WaitForChild("KirNetEvent", 30) :: RemoteEvent
		_remoteFunction = folder:WaitForChild("KirNetFunction", 30) :: RemoteFunction
		_routingRemote = folder:WaitForChild("KirNetRouting", 30) :: RemoteEvent
	end

	if _remoteEvent then
		Signal.setRemoteEvent(_remoteEvent)
	end
	if _remoteFunction then
		KirFunction.setRemoteFunction(_remoteFunction)
	end
end

-- Lookup table: routeId → SignalImpl/FunctionImpl
local _routeHandlers: { [number]: any } = {}

local function setupServerListeners()
	if not IS_SERVER then
		return
	end

	local remoteEvent = _remoteEvent
	local remoteFunction = _remoteFunction

	if remoteEvent then
		remoteEvent.OnServerEvent:Connect(function(player: Player, data: any)
			if typeof(data) ~= "buffer" then
				return
			end
			local pkt = data :: buffer

			-- Check for batch
			if Signal.isBatch(pkt) then
				local packets = Signal.parseBatch(pkt)
				for _, subPkt in packets do
					local routeId, _, payload = Signal.parsePacket(subPkt)
					local handler = _routeHandlers[routeId]
					if handler and handler._callbacks then
						-- Rate limit check
						if handler._checkRate and not handler:_checkRate(player) then
							continue
						end
						handler:_dispatch(player, Codec.decode(payload))
					end
				end
			else
				local routeId, _, payload = Signal.parsePacket(pkt)
				local handler = _routeHandlers[routeId]
				if handler and handler._callbacks then
					if handler._checkRate and not handler:_checkRate(player) then
						return
					end
					handler:_dispatch(player, Codec.decode(payload))
				end
			end
		end)
	end

	if remoteFunction then
		remoteFunction.OnServerInvoke = function(player: Player, data: any): any
			if typeof(data) ~= "buffer" then
				return nil
			end
			local pkt = data :: buffer
			local routeId = buffer.readu16(pkt, 0)
			local handler = _routeHandlers[routeId]
			if handler and handler._handleInvoke then
				return handler:_handleInvoke(player, pkt)
			end
			return nil
		end
	end
end

local function setupClientListeners()
	if IS_SERVER then
		return
	end

	local remoteEvent = _remoteEvent
	local routingRemote = _routingRemote

	if routingRemote then
		routingRemote.OnClientEvent:Connect(function(data: any)
			if typeof(data) == "table" then
				-- Routing table received
				local routingTable = data :: { [string]: any }
				local serviceNames = routingTable._services :: { [string]: { [string]: number } }?
				if serviceNames then
					-- Import route types
					local types = routingTable._types :: { [string]: string }?
					if types then
						for routeIdStr, typ in types do
							local routeId = tonumber(routeIdStr)
							if routeId then
								_routeTypes[routeId] = typ
							end
						end
					end

					-- Import routes
					for serviceName, methods in serviceNames do
						for methodName, routeId in methods do
							Router.import({ [serviceName .. "." .. methodName] = routeId })
						end
						-- Wake up anyone waiting for this service
						local waiting = _waitingForService[serviceName]
						if waiting then
							for _, thread in waiting do
								task.spawn(thread, true)
							end
							_waitingForService[serviceName] = nil
						end
					end
				end
				_clientReady = true
			end
		end)
	end

	if remoteEvent then
		remoteEvent.OnClientEvent:Connect(function(data: any)
			if typeof(data) ~= "buffer" then
				return
			end
			local pkt = data :: buffer

			if Signal.isBatch(pkt) then
				local packets = Signal.parseBatch(pkt)
				for _, subPkt in packets do
					local routeId, _, payload = Signal.parsePacket(subPkt)
					local handler = _routeHandlers[routeId]
					if handler and handler._dispatch then
						handler:_dispatch(Codec.decode(payload))
					end
				end
			else
				local routeId, _, payload = Signal.parsePacket(pkt)
				local handler = _routeHandlers[routeId]
				if handler and handler._dispatch then
					handler:_dispatch(Codec.decode(payload))
				end
			end
		end)
	end
end

local _listenersSetUp = false

local function ensureListeners()
	if _listenersSetUp then
		return
	end
	_listenersSetUp = true

	ensureRemotes()

	if IS_SERVER then
		setupServerListeners()
	else
		setupClientListeners()
	end
end

--- Send the current routing table to a specific player (or all)
local function replicateRoutingTable(player: Player?)
	if not IS_SERVER or not _routingRemote then
		return
	end

	-- Build service routing data
	local serviceData: { [string]: { [string]: number } } = {}
	local typeData: { [string]: string } = {}
	for serviceName, methods in _services do
		serviceData[serviceName] = {}
		for methodName, impl in methods do
			if impl._id then
				serviceData[serviceName][methodName] = impl._id
				typeData[tostring(impl._id)] = if impl._callbacks then "signal" else "function"
			end
		end
	end

	local payload = { _services = serviceData, _types = typeData }

	if player then
		_routingRemote:FireClient(player, payload)
	else
		_routingRemote:FireAllClients(payload)
	end
end

function Registry.registerService(name: string, definition: { [string]: any }): { [string]: any }
	if not IS_SERVER then
		warn(
			string.format(
				'[KirNet] WARNING: RegisterService("%s") called on client — skipping. Did you mean RegisterController?',
				name
			)
		)
		return definition
	end

	ensureListeners()

	local methods: { [string]: any } = {}
	local methodCount = 0

	for methodName, impl in definition do
		local routeId = Router.register(name, methodName)
		impl:_init(name, methodName, routeId)
		_routeHandlers[routeId] = impl
		methods[methodName] = impl
		methodCount += 1
	end

	_services[name] = methods

	if _debugEnabled then
		print(string.format('[KirNet] Registered service "%s" with %d methods', name, methodCount))
	end

	-- Replicate to all connected clients
	replicateRoutingTable()

	-- Also replicate to future connecting players
	-- (handled via PlayerAdded below)

	return definition
end

function Registry.registerController(name: string, definition: { [string]: any }): { [string]: any }
	if IS_SERVER then
		warn(
			string.format(
				'[KirNet] WARNING: RegisterController("%s") called on server — skipping. Did you mean RegisterService?',
				name
			)
		)
		return definition
	end

	ensureListeners()

	local methods: { [string]: any } = {}

	for methodName, impl in definition do
		local routeId = Router.register(name, methodName)
		impl:_init(name, methodName, routeId)
		_routeHandlers[routeId] = impl
		methods[methodName] = impl
	end

	_controllers[name] = methods

	return definition
end

function Registry.getService(name: string, timeout: number?): { [string]: any }
	local timeoutSec = timeout or 10

	-- Server-side: immediate lookup
	if IS_SERVER then
		local service = _services[name]
		if service then
			return service
		end

		-- Wait for registration on server side too
		local elapsed = 0
		local dt = 0
		while elapsed < timeoutSec do
			dt = RunService.Heartbeat:Wait()
			elapsed += dt
			service = _services[name]
			if service then
				return service
			end
		end

		error(
			string.format(
				'[KirNet] ERROR: GetService("%s") timed out after %d seconds. Is the service registered on the server?',
				name,
				timeoutSec
			)
		)
	end

	-- Client-side: wait for routing table delivery
	ensureListeners()

	-- Check if we already have routes for this service
	local function checkReady(): { [string]: any }?
		local routeTable = Router.getTable()
		local methods: { [string]: any } = {}
		local found = false
		for key, routeId in routeTable do
			local svcName, methodName = Router.parse(key)
			if svcName == name then
				found = true
				-- Create client-side proxy signal/function
				local handler = _routeHandlers[routeId]
				if handler then
					methods[methodName] = handler
				else
					-- Create a lightweight client proxy matching the server-side type
					local proxy
					if _routeTypes[routeId] == "function" then
						proxy = KirFunction.new()
					else
						proxy = Signal.new()
					end
					proxy:_init(svcName, methodName, routeId)
					_routeHandlers[routeId] = proxy
					methods[methodName] = proxy
				end
			end
		end
		if found then
			return methods
		end
		return nil
	end

	local result = checkReady()
	if result then
		return result
	end

	-- Wait for the service routing info to arrive
	local thread = coroutine.running()
	if not _waitingForService[name] then
		_waitingForService[name] = {}
	end
	table.insert(_waitingForService[name], thread)

	-- Set up timeout
	local timedOut = false
	task.delay(timeoutSec, function()
		local waiting = _waitingForService[name]
		if waiting then
			local idx = table.find(waiting, thread)
			if idx then
				table.remove(waiting, idx)
				timedOut = true
				task.spawn(thread) -- resume the yielded coroutine so it can check timedOut
			end
		end
	end)

	coroutine.yield()

	if timedOut then
		error(
			string.format(
				'[KirNet] ERROR: GetService("%s") timed out after %d seconds. Is the service registered on the server?',
				name,
				timeoutSec
			)
		)
	end

	-- Service should now be available in routes
	result = checkReady()
	if result then
		return result
	end

	error(string.format('[KirNet] ERROR: GetService("%s") failed to resolve after routing table arrived.', name))
end

function Registry.getController(name: string): { [string]: any }?
	return _controllers[name]
end

--- Get a service that was already registered on this peer (no yield).
function Registry.getLocalService(name: string): { [string]: any }?
	return _services[name]
end

-- Set up player connection handling for routing table replication
if IS_SERVER then
	ensureRemotes()
	Players.PlayerAdded:Connect(function(player)
		task.defer(replicateRoutingTable, player)
	end)
	for _, player in Players:GetPlayers() do
		task.defer(replicateRoutingTable, player)
	end
end

return Registry
