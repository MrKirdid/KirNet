--!strict

--[[
	Types.luau - Type definitions for KirNet services-only networking.

	Member kinds:
	  ServerSignal  - Server fires, client listens (server-to-client event)
	  ClientSignal  - Client fires, server listens (client-to-server event)
	  ServerFunction - Client calls, server handles (client-to-server RPC)
]]

export type SignalOptions = {
	batched: boolean?,
	lossy: boolean?,
	precision: number?,
	rateLimit: number?,
	compressionThreshold: number?,
}

-- Server-to-client signal: server fires events, client listens
export type ServerSignal<T...> = {
	-- Server side: fire events to clients
	Fire: (self: ServerSignal<T...>, player: Player, T...) -> (),
	FireAll: (self: ServerSignal<T...>, T...) -> (),
	FireExcept: (self: ServerSignal<T...>, player: Player, T...) -> (),
	FireList: (self: ServerSignal<T...>, players: { Player }, T...) -> (),
	-- Client side: listen for events from server
	Connect: (self: ServerSignal<T...>, callback: (T...) -> ()) -> (),
	Once: (self: ServerSignal<T...>, callback: (T...) -> ()) -> (),
	Wait: (self: ServerSignal<T...>, timeout: number?) -> T...,
	Disconnect: (self: ServerSignal<T...>) -> (),
}

-- Client-to-server signal: client fires events, server listens
export type ClientSignal<T...> = {
	-- Client side: fire events to server
	FireServer: (self: ClientSignal<T...>, T...) -> (),
	-- Server side: listen for events from clients
	OnServerEvent: (self: ClientSignal<T...>, callback: (player: Player, T...) -> ()) -> (),
}

-- Bidirectional signal: both server-to-client and client-to-server
export type Signal<T...> = {
	-- Server side: fire events to clients
	Fire: (self: Signal<T...>, player: Player, T...) -> (),
	FireAll: (self: Signal<T...>, T...) -> (),
	FireExcept: (self: Signal<T...>, player: Player, T...) -> (),
	FireList: (self: Signal<T...>, players: { Player }, T...) -> (),
	-- Client side: fire events to server
	FireServer: (self: Signal<T...>, T...) -> (),
	-- Client side: listen for events from server
	Connect: (self: Signal<T...>, callback: (T...) -> ()) -> (),
	Once: (self: Signal<T...>, callback: (T...) -> ()) -> (),
	Wait: (self: Signal<T...>, timeout: number?) -> T...,
	Disconnect: (self: Signal<T...>) -> (),
	-- Server side: listen for events from clients
	OnServerEvent: (self: Signal<T...>, callback: (player: Player, T...) -> ()) -> (),
}

-- Client-to-server function: client calls, server handles and returns result
export type ServerFunction<TReturn> = {
	Call: (self: ServerFunction<TReturn>, ...any) -> TReturn,
}

export type MiddlewareContext = {
	name: string,
	service: string,
	player: Player?,
	payload: any,
	direction: "c2s" | "s2c",
}

export type MiddlewareFn = (context: MiddlewareContext, next: (context: MiddlewareContext) -> ()) -> ()

-- Member kind identifiers for routing
export type MemberKind = "serverSignal" | "clientSignal" | "signal" | "serverFunction"

-- Internal types

export type SignalImpl = {
	_options: SignalOptions,
	_kind: "server" | "client" | "signal",
	_id: number?,
	_serviceName: string?,
	_methodName: string?,
	_callbacks: { (...any) -> () },
	_onceCallbacks: { (...any) -> () },
	_waitingThreads: { thread },
	_isServer: boolean,
}

export type FunctionImpl = {
	_options: SignalOptions,
	_id: number?,
	_serviceName: string?,
	_methodName: string?,
	_handler: ((player: Player, ...any) -> ...any)?,
	_isServer: boolean,
}

export type ServiceDefinition = {
	[string]: SignalImpl | FunctionImpl,
}

export type RegisteredService = {
	name: string,
	methods: { [string]: SignalImpl | FunctionImpl },
}

return nil
