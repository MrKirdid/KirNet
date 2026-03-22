# KirNet Type Generator

A VS Code extension that gives developers full autocomplete and type safety when using [KirNet](https://github.com/yourusername/KirNet).

## Features

### Automatic `Types.luau` Generation
Scans your service and controller files, extracts signal/function definitions, and generates a fully typed wrapper that `luau-lsp` can statically analyse.

### `GetService` String Completion
When typing `KirNet.GetService("`)`, all registered service names appear as fuzzy-matched suggestions inside the string literal.

## Configuration

Create a `kirnet.toml` in your workspace root (all fields optional):

```toml
[paths]
services    = "src/ServerScriptService/Services"
controllers = "src/StarterPlayerScripts/Controllers"
output      = "src/ReplicatedStorage/Shared/Packages/KirNet/Types.luau"

[options]
kirnet_require_path = 'game:GetService("ReplicatedStorage").Shared.Packages.KirNet'
debug = false
```

## Commands

| Command | Description |
|---|---|
| `KirNet: Regenerate Types Now` | Force immediate regeneration |
| `KirNet: Show Output` | Open output channel |
| `KirNet: Open Generated Types File` | Open `Types.luau` in editor |
| `KirNet: Reload Config` | Re-read `kirnet.toml` without restarting |

## How It Works

The generated `Types.luau` exports a typed wrapper around `KirNet.GetService`. Each service gets its own `Get<ServiceName>()` function with an explicit return type annotation. `luau-lsp` traces through these annotations to give full autocomplete at every call site — no casting needed.
