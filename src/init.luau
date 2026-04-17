--!strict

--[[
	KirNet - Services-only networking library for Roblox.

	Create signals, functions, and variables in service definitions.
	Register on the server, fetch on the client with GetService().

	Primary API:
	  CreateSignal(options?)    - Bidirectional by default, or set direction option
	  CreateFunction(handler, options?) - Client calls, server handles
	  CreateVariable(initialValue)     - Server-replicated state
]]

local Types = require(script.Types)
local Signal = require(script.Signal)
local KirFunction = require(script.Function)
local Variable = require(script.Variable)
local Registry = require(script.Registry)
local Middleware = require(script.Middleware)

export type ServerSignal<T...> = Types.ServerSignal<T...>
export type ClientSignal<T...> = Types.ClientSignal<T...>
export type Signal<T...> = Types.Signal<T...>
export type ServerFunction<TReturn> = Types.ServerFunction<TReturn>
export type Variable<T> = Types.Variable<T>
export type SignalOptions = Types.SignalOptions
export type MiddlewareContext = Types.MiddlewareContext
export type MiddlewareFn = Types.MiddlewareFn

local KirNet = {}

--- Create a signal. Bidirectional by default.
--- Set options.direction = "server" for server→client only,
--- or options.direction = "client" for client→server only.
function KirNet.CreateSignal(options: Types.SignalOptions?): Types.Signal<...any>
	local opts = options or {} :: Types.SignalOptions
	local direction = opts.direction
	local kind: "server" | "client" | "signal"
	if direction == "server" then
		kind = "server"
	elseif direction == "client" then
		kind = "client"
	else
		kind = "signal"
	end
	return Signal.new(kind, options) :: any
end

--- Create a function. Client calls, server handles and returns a result.
function KirNet.CreateFunction(
	handler: ((player: Player, ...any) -> ...any)?,
	options: Types.SignalOptions?
): Types.ServerFunction<any>
	return KirFunction.new(handler, options) :: any
end

--- Create a server-replicated variable.
--- Server: Set(value), Get()
--- Client: Get(), OnChanged(callback)
function KirNet.CreateVariable(initialValue: any): Types.Variable<any>
	return Variable.new(initialValue) :: any
end

--- (Deprecated) Create a server-to-client signal. Use CreateSignal({ direction = "server" }) instead.
function KirNet.CreateServerSignal(options: Types.SignalOptions?): Types.ServerSignal<...any>
	return Signal.new("server", options) :: any
end

--- (Deprecated) Create a client-to-server signal. Use CreateSignal({ direction = "client" }) instead.
function KirNet.CreateClientSignal(options: Types.SignalOptions?): Types.ClientSignal<...any>
	return Signal.new("client", options) :: any
end

--- (Deprecated) Create a server function. Use CreateFunction() instead.
function KirNet.CreateServerFunction(
	handler: ((player: Player, ...any) -> ...any)?,
	options: Types.SignalOptions?
): Types.ServerFunction<any>
	return KirFunction.new(handler, options) :: any
end

--- Register a service on the server.
function KirNet.RegisterService(name: string, definition: { [string]: any }): { [string]: any }
	return Registry.registerService(name, definition)
end

--- Get a registered service by name.
function KirNet.GetService(name: string, timeout: number?): { [string]: any }
	return Registry.getService(name, timeout)
end

--- Register global middleware.
function KirNet.UseMiddleware(fn: Types.MiddlewareFn)
	Middleware.use(fn)
end

--- Enable or disable debug logging.
function KirNet.SetDebug(enabled: boolean)
	Registry.setDebug(enabled)
end

return KirNet
