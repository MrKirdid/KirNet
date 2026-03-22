# KirNet

KirNet is a focused, services-only networking library for Roblox. It lets the server expose typed signals and functions to clients through explicitly directional service definitions, without pulling in a larger framework or lifecycle model.

## Key Properties

- **Services only** - no controllers, no separate client-side registration
- **Strict directionality** - every member has explicit send/receive rules
- **Runtime-enforced** - invalid side usage errors immediately with clear messages
- **Buffer-based transport** - serialization, compression, and packet assembly stay buffer-based end-to-end
- **Minimal surface** - small API, strong defaults, hard to misuse

## Install with Wally

Add KirNet to your `wally.toml` dependencies:

```toml
[dependencies]
KirNet = "mrkirdid/kirnet@2.0.0"
```

Then install packages:

```bash
wally install
```

## Quick Start

### Server

```luau
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local KirNet = require(ReplicatedStorage.Packages.KirNet)

local ChatService = KirNet.RegisterService("ChatService", {
	-- Server fires, client listens
	MessageSent = KirNet.CreateServerSignal() :: KirNet.ServerSignal<string>,

	-- Client fires, server listens
	SendMessage = KirNet.CreateClientSignal() :: KirNet.ClientSignal<string>,

	-- Client calls, server handles
	GetHistory = KirNet.CreateServerFunction(function(player: Player, channel: string): { string }
		return { "Welcome to " .. channel }
	end),
})

-- Server broadcasts to all clients
ChatService.MessageSent:FireAll("Server ready")

-- Server listens for client events
ChatService.SendMessage:OnServerEvent(function(player, text)
	print(player.Name .. ": " .. text)
	ChatService.MessageSent:FireAll(player.Name .. ": " .. text)
end)
```

### Client

```luau
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local KirNet = require(ReplicatedStorage.Packages.KirNet)

local ChatService = KirNet.GetService("ChatService")

-- Client listens to server broadcasts
ChatService.MessageSent:Connect(function(message)
	print(message)
end)

-- Client fires event to server
ChatService.SendMessage:FireServer("hello from the client")

-- Client calls function on server
local history = ChatService.GetHistory:Call("general")
print(history)
```

## Member Kinds

| Kind | Creator | Server Can | Client Can |
|------|---------|------------|------------|
| **ServerSignal** | `CreateServerSignal()` | Fire, FireAll, FireExcept, FireList | Connect, Once, Wait, Disconnect |
| **ClientSignal** | `CreateClientSignal()` | OnServerEvent | FireServer |
| **ServerFunction** | `CreateServerFunction(handler)` | (provides handler) | Call |

Calling a method from the wrong side or wrong member kind errors immediately:

```
[KirNet] ChatService.MessageSent:FireServer() failed - FireServer is only available on ClientSignal, not ServerSignal.
```

## API Surface

```luau
-- Member constructors (use inside service definitions)
KirNet.CreateServerSignal(options?)          -- server-to-client event
KirNet.CreateClientSignal(options?)          -- client-to-server event
KirNet.CreateServerFunction(handler, options?)  -- client-to-server RPC

-- Service registration and retrieval
KirNet.RegisterService(name, definition)     -- server only
KirNet.GetService(name, timeout?)            -- yields on client

-- Global middleware
KirNet.UseMiddleware(fn)

-- Debug logging
KirNet.SetDebug(enabled)
```

Exported types: `ServerSignal<T...>`, `ClientSignal<T...>`, `ServerFunction<TReturn>`, `SignalOptions`, `MiddlewareContext`, `MiddlewareFn`.

## Signal Options

All signal and function constructors accept an options table:

```luau
KirNet.CreateServerSignal({
	batched = true,               -- batch multiple fires per frame into one packet
	lossy = true,                 -- use f32 instead of f64 for floats
	precision = 2,                -- decimal places for lossy rounding
	compressionThreshold = 64,    -- compress payloads >= this many bytes
	rateLimit = 30,               -- max invocations per second per player (client-to-server)
})
```

### Batching

When `batched = true`, all fires within one Heartbeat frame are collected and sent as a single packet. This reduces remote call overhead for high-frequency signals. Batching preserves per-packet compression flags.

### Lossy Precision

When `lossy = true`, floats are serialized as f32 instead of f64, and Vector3/CFrame components are rounded to the specified `precision`. Good for position updates where exact precision is unnecessary.

### Compression

Payloads at or above `compressionThreshold` bytes are compressed using a buffer-based LZ77 algorithm. Compressed data is only used if smaller than the original. The entire pipeline stays buffer-based:

1. Codec encodes values to buffer
2. Compression compresses buffer to smaller buffer (if beneficial)
3. Packet assembly wraps payload buffer with routing header
4. Transport sends buffer via RemoteEvent/RemoteFunction
5. Decompression restores original buffer
6. Codec decodes buffer back to values

Compression helps for larger structured payloads. For small payloads (under 64 bytes), compression typically increases size and is skipped.

### Rate Limiting

When `rateLimit` is set, incoming calls from each client are limited to that many per second. Applies to both ClientSignal events and ServerFunction calls. Excess calls are dropped with a warning.

```luau
-- Both signals and functions can be rate-limited
EquipItem = KirNet.CreateClientSignal({ rateLimit = 10 }) :: KirNet.ClientSignal<string>,
PurchaseItem = KirNet.CreateServerFunction(function(player, itemId)
	return { success = true }
end, { rateLimit = 5 }),
```

## Middleware

Global middleware runs on every remote call, in registration order:

```luau
KirNet.UseMiddleware(function(context, next)
	print(context.direction, context.service, context.name)
	next(context) -- must call next() to continue; omit to abort
end)
```

The `context` contains: `name` (method), `service` (service name), `player` (sender, if c2s), `payload` (args table), `direction` ("c2s" or "s2c").

## Serialization

KirNet uses a compact binary codec that supports: `nil`, `boolean`, `number` (auto-selects smallest integer or float representation), `string`, `Vector3`, `Vector2`, `CFrame` (quaternion-compressed rotation), `Color3`, `UDim2`, and `table` (recursive).

Unsupported types (instances, userdata, etc.) error immediately:

```
[KirNet] Codec error: unsupported type 'Instance' (value: Workspace). Supported types: nil, boolean, number, string, Vector3, Vector2, CFrame, Color3, UDim2, table.
```

## What KirNet Does Not Replace

KirNet handles application-level networking: events, RPC, fan-out, selective sends, batching, compression, middleware, rate limiting, and structured serialization.

KirNet does **not** replace:
- Roblox physics replication and ownership
- Character replication and movement
- Built-in data store or memory store APIs
- Instance replication (Workspace, ReplicatedStorage sync)
- Terrain streaming or other engine-level systems

Use KirNet for your game's custom networking needs alongside the engine's built-in systems.

## Type Generation

This repository includes `kirnet-type-gen`, a VS Code extension that generates typed wrappers for KirNet services. See `kirnet-type-gen/README.md` for details.

## Repository Layout

- `src/` contains the runtime package published through Wally.
- `init.luau` re-exports the package entrypoint.
- `default.project.json` maps the package into ReplicatedStorage for Rojo projects.
- `kirnet-type-gen/` contains the companion VS Code extension.

## License

KirNet is available under the MIT License. See `LICENSE`.