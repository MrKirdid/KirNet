--!strict

--[[
	Middleware.luau — Global middleware chain for KirNet.

	Middleware runs on every remote call in order of registration.
	Can inspect, mutate payload, or abort by not calling next().

	Runs before serialization on send side,
	after deserialization on receive side.
]]

local Types = require(script.Parent.Types)

local Middleware = {}

local _chain: { Types.MiddlewareFn } = {}

--- Register a middleware function. Runs in FIFO order.
function Middleware.use(fn: Types.MiddlewareFn)
	table.insert(_chain, fn)
end

--- Execute the middleware chain for a given context.
--- Returns true if the chain completed (next was called through all middleware).
--- Returns false if any middleware aborted (did not call next).
function Middleware.execute(context: Types.MiddlewareContext): boolean
	if #_chain == 0 then
		return true
	end

	local completed = false
	local index = 0

	local function advance(ctx: Types.MiddlewareContext)
		index += 1
		if index > #_chain then
			completed = true
			return
		end
		local fn = _chain[index]
		fn(ctx, advance)
	end

	advance(context)
	return completed
end

--- Clear all registered middleware. Primarily for testing.
function Middleware.clear()
	table.clear(_chain)
end

--- Get current middleware count.
function Middleware.count(): number
	return #_chain
end

return Middleware
