# KirNet

KirNet is a focused networking layer for Roblox. It lets servers expose typed signals and functions to clients, and lets clients expose typed signals back to the server, without pulling in a larger framework or lifecycle model.

## Install with Wally

Add KirNet to your `wally.toml` dependencies:

```toml
[dependencies]
KirNet = "mrkirdid/kirnet@1.0.4"
```

Then install packages:

```bash
wally install
```

With the included `default.project.json`, the package is available from `ReplicatedStorage.Packages.KirNet`.

## Quick Start

### Server

```luau
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local KirNet = require(ReplicatedStorage.Packages.KirNet)

local ChatService = KirNet.RegisterService("ChatService", {
	MessageSent = KirNet.CreateSignal(),
	SendMessage = KirNet.CreateFunction(function(player, text)
		print(player.Name, text)
		return true
	end),
})

ChatService.MessageSent:FireAll("Server ready")
```

### Client

```luau
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local KirNet = require(ReplicatedStorage.Packages.KirNet)

local ChatService = KirNet.GetService("ChatService")

ChatService.MessageSent:Connect(function(message)
	print(message)
end)

local ok = ChatService.SendMessage:Call("hello from the client")
print(ok)
```

## API Surface

- `KirNet.CreateSignal(options?)`
- `KirNet.CreateFunction(handler?, options?)`
- `KirNet.RegisterService(name, definition)`
- `KirNet.RegisterController(name, definition)`
- `KirNet.GetService(name, timeout?)`
- `KirNet.GetController(name)`
- `KirNet.UseMiddleware(fn)`
- `KirNet.SetDebug(enabled)`

The package also exports Luau types for `Signal`, `Function`, `SignalOptions`, `MiddlewareContext`, and `MiddlewareFn`.

## What KirNet Handles

- Server-to-client signals
- Client-to-server functions
- Client controller registration
- Global middleware hooks for remote calls
- Compact routing and payload serialization behind the scenes

## Type Generation

This repository also includes `kirnet-type-gen`, a VS Code extension project for generating typed wrappers and autocomplete for KirNet services. See `kirnet-type-gen/README.md` for details.

## Repository Layout

- `src/` contains the runtime package published through Wally.
- `init.luau` re-exports the package entrypoint.
- `default.project.json` maps the package into `ReplicatedStorage` for Rojo projects.
- `kirnet-type-gen/` contains the companion VS Code extension.

## License

KirNet is available under the MIT License. See `LICENSE`.