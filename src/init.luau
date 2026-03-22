--!strict

--[[
	KirNet — Pure networking hub for Roblox.

	One job: let the server expose typed signals and functions to clients,
	and let clients expose typed signals back to the server.
	No framework, no lifecycle hooks, no Init/Start. Just the networking layer.
]]

local Types = require(script.Types)
local Signal = require(script.Signal)
local KirFunction = require(script.Function)
local Registry = require(script.Registry)
local Middleware = require(script.Middleware)

export type Signal<T...> = Types.Signal<T...>
export type Function<TReturn> = Types.Function<TReturn>
export type SignalOptions = Types.SignalOptions
export type MiddlewareContext = Types.MiddlewareContext
export type MiddlewareFn = Types.MiddlewareFn

local KirNet = {}

--- Create a new signal with optional configuration.
function KirNet.CreateSignal(options: Types.SignalOptions?): any
	return Signal.new(options)
end

--- Create a new function with a server-side handler and optional configuration.
function KirNet.CreateFunction(handler: ((player: Player, ...any) -> ...any)?, options: Types.SignalOptions?): any
	return KirFunction.new(handler, options)
end

--- Register a service on the server. Declares signals and functions that clients can access.
--- Returns the definition table for direct use.
function KirNet.RegisterService(name: string, definition: { [string]: any }): { [string]: any }
	return Registry.registerService(name, definition)
end

--- Register a controller on the client. Declares signals the server can call on this client.
--- Returns the definition table for direct use.
function KirNet.RegisterController(name: string, definition: { [string]: any }): { [string]: any }
	return Registry.registerController(name, definition)
end

--- Get a registered service by name. Yields until available or timeout expires.
--- On the server, looks up locally registered services.
--- On the client, waits for the server to replicate the service definition.
function KirNet.GetService(name: string, timeout: number?): { [string]: any }
	return Registry.getService(name, timeout)
end

--- Get a registered controller by name (client-side only).
--- Returns nil if the controller hasn't been registered yet.
function KirNet.GetController(name: string): { [string]: any }?
	return Registry.getController(name)
end

--- Register global middleware that runs on every remote call.
function KirNet.UseMiddleware(fn: Types.MiddlewareFn)
	Middleware.use(fn)
end

--- Enable or disable debug logging.
function KirNet.SetDebug(enabled: boolean)
	Registry.setDebug(enabled)
end

return KirNet
