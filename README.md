# KirNet

KirNet is a services-first networking library for Roblox. Register services on the server, fetch them with `GetService()` on the client, and get typed, direction-safe networking with minimal API surface.

## Why KirNet

- Services only. No framework lifecycle, controller system, or startup ceremony.
- Three building blocks: `CreateSignal`, `CreateFunction`, `CreateVariable`.
- Runtime guardrails. Wrong-side and wrong-method calls error immediately.
- Instance passthrough. Send Instances, userdata, or any unsupported type alongside compressed data — no errors, no workarounds.
- Efficient transport. Buffers, optional batching, compression, lossy numeric payloads, and rate limiting are built in.
- Replicated variables. `CreateVariable(value)` auto-syncs server state to clients.
- Tooling. The companion `kirnet-type-gen` VS Code extension generates typed `GetService()` wrappers and string completions.

## Install

Add KirNet to your `wally.toml`:

```toml
[dependencies]
KirNet = "mrkirdid/kirnet@3.0.0"
```

Then install packages:

```bash
wally install
```

Your require path depends on your package alias and Rojo mapping. In a typical shared package setup:

```luau
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local KirNet = require(ReplicatedStorage.Packages.KirNet)
```

## Quick Start

### Server

```luau
--!strict
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local KirNet = require(ReplicatedStorage.Packages.KirNet)

local ChatService = KirNet.RegisterService("ChatService", {
	-- Server → client broadcast
	MessageSent = KirNet.CreateSignal({ direction = "server" }) :: KirNet.ServerSignal<string>,

	-- Client → server input
	SendMessage = KirNet.CreateSignal({ direction = "client" }) :: KirNet.ClientSignal<string>,

	-- Client calls, server responds
	GetHistory = KirNet.CreateFunction(function(player: Player, channel: string): { string }
		return { "Welcome to " .. channel, "Have fun." }
	end),

	-- Replicated variable (auto-syncs to clients)
	Enabled = KirNet.CreateVariable(true),
})

ChatService.SendMessage:OnServerEvent(function(player, text)
	ChatService.MessageSent:FireAll(player.Name .. ": " .. text)
end)

-- Variables can be changed anytime — clients update automatically
ChatService.Enabled:Set(false)

return ChatService
```

### Client

```luau
--!strict
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local KirNet = require(ReplicatedStorage.Packages.KirNet)

local ChatService = KirNet.GetService("ChatService")

ChatService.MessageSent:Connect(function(message)
	print(message)
end)

ChatService.SendMessage:FireServer("hello from the client")

local history = ChatService.GetHistory:Call("general")
print(history[1])

-- Read replicated variable
print(ChatService.Enabled:Get())

-- React to variable changes
ChatService.Enabled:OnChanged(function(newValue, oldValue)
	print("Chat enabled:", newValue)
end)
```

`GetService()` yields until the service is available. Pass a timeout if you want it to fail early:

```luau
local ChatService = KirNet.GetService("ChatService", 5)
```

## API

```luau
-- Signals
KirNet.CreateSignal(options?)                  -- bidirectional by default
KirNet.CreateSignal({ direction = "server" })  -- server → client only
KirNet.CreateSignal({ direction = "client" })  -- client → server only

-- Functions
KirNet.CreateFunction(handler?, options?)

-- Variables
KirNet.CreateVariable(initialValue)

-- Service management
KirNet.RegisterService(name, definition)   -- server only
KirNet.GetService(name, timeout?)          -- client or server

-- Utilities
KirNet.UseMiddleware(fn)
KirNet.SetDebug(enabled)
```

### Signal Direction

| Direction | Server API | Client API | Use it for |
| --- | --- | --- | --- |
| `nil` (bidirectional) | `Fire`, `FireAll`, `FireExcept`, `FireList`, `OnServerEvent` | `FireServer`, `Connect`, `Once`, `Wait`, `Disconnect` | Rare bidirectional channels |
| `"server"` | `Fire`, `FireAll`, `FireExcept`, `FireList` | `Connect`, `Once`, `Wait`, `Disconnect` | Broadcasts, state pushes |
| `"client"` | `OnServerEvent` | `FireServer` | Input, actions, requests |

### Variable API

| Method | Side | Description |
| --- | --- | --- |
| `:Get()` | Both | Returns the current value |
| `:Set(value)` | Server | Updates and replicates to all clients |
| `:OnChanged(callback)` | Both | Fires `callback(newValue, oldValue)` on change |

### Exported Types

- `KirNet.ServerSignal<T...>`
- `KirNet.ClientSignal<T...>`
- `KirNet.Signal<T...>`
- `KirNet.ServerFunction<TReturn>`
- `KirNet.Variable<T>`
- `KirNet.SignalOptions`
- `KirNet.MiddlewareContext`
- `KirNet.MiddlewareFn`

## Options

All signal and function constructors accept the same options table:

```luau
KirNet.CreateSignal({
	direction = "client",
	batched = false,
	lossy = false,
	precision = 2,
	rateLimit = 15,
	compressionThreshold = 64,
})
```

| Option | What it does |
| --- | --- |
| `direction` | `"server"`, `"client"`, or omit for bidirectional. |
| `batched` | Groups multiple server-to-client fires in the same frame into one packet. |
| `lossy` | Uses reduced-precision numeric encoding to cut bandwidth. |
| `precision` | Decimal precision used when `lossy` is enabled. |
| `compressionThreshold` | Compresses payloads above this byte size when compression saves space. |
| `rateLimit` | Limits incoming client-to-server traffic per player per second. |

## Instance & Userdata Passthrough

KirNet automatically handles unsupported types like `Instance` or userdata. If a value can't be buffer-encoded, it's sent alongside the buffer as a passthrough value and correctly reassembled on the other side. No configuration needed.

```luau
-- This just works — the Part is sent as a passthrough, the string is buffer-encoded
MySignal:FireAll("hit", workspace.Part, 42)
```

## Middleware

Middleware runs on every remote call in registration order. Inspect payloads, mutate them, or abort by not invoking `next()`.

```luau
KirNet.UseMiddleware(function(context, next)
	print(context.direction, context.service, context.name)
	next(context)
end)
```

`context` contains: `name`, `service`, `player`, `payload`, `direction` (`"c2s"` or `"s2c"`).

## VS Code Type Generator

The `kirnet-type-gen` extension makes KirNet fully typed in your editor.

It can:

- Generate a typed KirNet wrapper for `GetService("ServiceName")`
- Autocomplete service names inside `GetService("...")`
- Regenerate types on save and on startup
- Initialize a `kirnet.toml` config with `KirNet: Init`
- Enable/disable per project with `KirNet: Enable` / `KirNet: Disable`
- Jump to service definitions, list services, scaffold new services

### Setup

1. Open a workspace that contains `default.project.json`.
2. Install the extension from `kirnet-type-gen/`.
3. Run `KirNet: Init` from the Command Palette to create a `kirnet.toml`.
4. Save a service file — types regenerate automatically.

## Example Project

The `Example/` folder is a complete Rojo + Wally sample project.

## Repository Layout

- `src/` — runtime package source
- `init.luau` — package re-export entrypoint
- `default.project.json` — Rojo mapping for the package
- `kirnet-type-gen/` — VS Code extension
- `Example/` — example Roblox project

## License

KirNet is released under the MIT License. See `LICENSE`.