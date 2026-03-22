--!strict

--[[
	KirNet - Services-only networking library for Roblox.

	One job: let the server expose typed network members to clients.
	No framework, no lifecycle hooks, no Init/Start. Just the networking layer.

	Member kinds:
	  CreateServerSignal(options?)  - Server fires events, client listens
	  CreateClientSignal(options?)  - Client fires events, server listens
	  CreateServerFunction(handler, options?) - Client calls, server handles

	Usage:
	  Services are registered on the server with RegisterService().
	  Clients retrieve services with GetService() and get
	  direction-correct proxies that only expose valid operations.
]]

local Types = require(script.Types)
local Signal = require(script.Signal)
local KirFunction = require(script.Function)
local Registry = require(script.Registry)
local Middleware = require(script.Middleware)

export type ServerSignal<T...> = Types.ServerSignal<T...>
export type ClientSignal<T...> = Types.ClientSignal<T...>
export type Signal<T...> = Types.Signal<T...>
export type ServerFunction<TReturn> = Types.ServerFunction<TReturn>
export type SignalOptions = Types.SignalOptions
export type MiddlewareContext = Types.MiddlewareContext
export type MiddlewareFn = Types.MiddlewareFn

local KirNet = {}

--- Create a server-to-client signal. Server fires events, client listens.
--- Use inside a service definition for broadcast-style events.
function KirNet.CreateServerSignal(options: Types.SignalOptions?): Types.ServerSignal<...any>
	return Signal.new("server", options) :: any
end

--- Create a client-to-server signal. Client fires events, server listens.
--- Use inside a service definition for client-initiated events.
function KirNet.CreateClientSignal(options: Types.SignalOptions?): Types.ClientSignal<...any>
	return Signal.new("client", options) :: any
end

--- Create a bidirectional signal. Both server and client can fire and listen.
--- Server can Fire/FireAll/FireExcept/FireList and OnServerEvent.
--- Client can FireServer and Connect/Once/Wait/Disconnect.
function KirNet.CreateSignal(options: Types.SignalOptions?): Types.Signal<...any>
	return Signal.new("signal", options) :: any
end

--- Create a server function with a server-side handler.
--- Client calls this function and receives the server's return value.
function KirNet.CreateServerFunction(
	handler: ((player: Player, ...any) -> ...any)?,
	options: Types.SignalOptions?
): Types.ServerFunction<any>
	return KirFunction.new(handler, options) :: any
end

--- Alias for CreateServerFunction.
function KirNet.CreateFunction(
	handler: ((player: Player, ...any) -> ...any)?,
	options: Types.SignalOptions?
): Types.ServerFunction<any>
	return KirFunction.new(handler, options) :: any
end

--- Register a service on the server. Declares signals and functions that clients can access.
--- Validates all members and errors immediately on invalid definitions.
--- Returns the definition table for direct use.
function KirNet.RegisterService(name: string, definition: { [string]: any }): { [string]: any }
	return Registry.registerService(name, definition)
end

--- Get a registered service by name.
--- On the server, looks up locally registered services (yields briefly if not yet registered).
--- On the client, waits for the server to replicate the service definition.
--- Returns a proxy with only the methods valid for the current environment.
function KirNet.GetService(name: string, timeout: number?): { [string]: any }
	return Registry.getService(name, timeout)
end

--- Register global middleware that runs on every remote call.
--- Middleware can inspect, mutate payloads, or abort calls by not calling next().
function KirNet.UseMiddleware(fn: Types.MiddlewareFn)
	Middleware.use(fn)
end

--- Enable or disable debug logging for send/receive/compression info.
function KirNet.SetDebug(enabled: boolean)
	Registry.setDebug(enabled)
end

return KirNet
