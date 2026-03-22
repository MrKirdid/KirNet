--!strict

export type SignalOptions = {
	batched: boolean?,
	lossy: boolean?,
	precision: number?,
	rateLimit: number?,
	compressionThreshold: number?,
}

export type Signal<T...> = {
	-- Server → Client
	Fire: (self: Signal<T...>, player: Player, T...) -> (),
	FireAll: (self: Signal<T...>, T...) -> (),
	FireExcept: (self: Signal<T...>, player: Player, T...) -> (),
	FireList: (self: Signal<T...>, players: { Player }, T...) -> (),
	-- Client → Server
	FireServer: (self: Signal<T...>, T...) -> (),
	-- Client listening
	Connect: (self: Signal<T...>, callback: (T...) -> ()) -> (),
	Once: (self: Signal<T...>, callback: (T...) -> ()) -> (),
	Wait: (self: Signal<T...>, timeout: number?) -> T...,
	Disconnect: (self: Signal<T...>) -> (),
	-- Server listening (c2s)
	OnServerEvent: (self: Signal<T...>, callback: (player: Player, T...) -> ()) -> (),
}

export type Function<TReturn> = {
	Call: (self: Function<TReturn>, ...any) -> TReturn,
}

export type MiddlewareContext = {
	name: string,
	service: string,
	player: Player?,
	payload: any,
	direction: "c2s" | "s2c",
}

export type MiddlewareFn = (context: MiddlewareContext, next: (context: MiddlewareContext) -> ()) -> ()

-- Internal types

export type SignalImpl = {
	_options: SignalOptions,
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
