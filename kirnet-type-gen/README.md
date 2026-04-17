# KirNet Type Generator

KirNet Type Generator is a VS Code extension for KirNet projects. It scans `KirNet.RegisterService()` definitions, generates a typed wrapper around KirNet, and makes `GetService("...")` much easier to work with in Luau-aware editors.

Repository: <https://github.com/MrKirdid/KirNet>

## What It Does

- Generates a typed KirNet wrapper on activation and whenever service files are saved.
- Adds service-name completion inside `KirNet.GetService("...")` string literals.
- Scans both service and controller trees when configured.
- Tries to inject the generated wrapper directly into the discovered KirNet package or Wally proxy.
- Falls back to writing a standalone output file if the package cannot be found.
- Ships commands for initialization, enable/disable, regeneration, navigation, scaffolding, recovery, output logs, and opening the GitHub README.

## Quick Setup

1. Open a workspace that contains `default.project.json`.
2. Install the extension or run it from this repository.
3. Run `KirNet: Init` to create a starter `kirnet.toml`.
4. Save a KirNet service or controller file and start using the generated typed wrapper where you want typed `GetService()` overloads.

The example workspace in this repo includes a working config at `Example/kirnet.toml`.

## Recognized Service Patterns

The parser looks for `KirNet.RegisterService("ServiceName", { ... })` and extracts members created with:

- `CreateSignal(...)`
- `CreateSignal({ direction = "server" | "client" })`
- `CreateFunction(...)`
- `CreateVariable(...)`

Legacy constructors such as `CreateServerSignal(...)`, `CreateClientSignal(...)`, and `CreateServerFunction(...)` are still recognized for compatibility.

Typed casts such as `:: KirNet.ServerSignal<T>`, `:: KirNet.ClientSignal<T>`, `:: KirNet.ServerFunction<T>`, and `:: KirNet.Variable<T>` are preserved in the generated output. If you omit a cast, the extension still includes the member and infers what it can, otherwise defaulting to `any`.

## kirnet.toml

Create `kirnet.toml` in the workspace root if you want to override the defaults:

```toml
[paths]
services = "src/Server/Services"
controllers = "src/Shared/Controllers"
output = "src/ReplicatedStorage/Shared/Packages/KirNet/Types.luau"
kirnet_package = "Packages/kirnet.lua"

[options]
kirnet_require_path = 'game:GetService("ReplicatedStorage").Shared.Packages.KirNet'
debug = false
```

### Path Options

- `services`: directory tree to scan for KirNet services.
- `controllers`: optional directory tree to scan alongside services.
- `output`: fallback output file when the extension cannot inject into the KirNet package directly.
- `kirnet_package`: explicit path to the KirNet package or proxy file when auto-discovery is not enough.

### Other Options

- `kirnet_require_path`: require expression used in standalone mode.
- `debug`: enables extra parser and generation logging in the output channel.

## Output Modes

### Injection Mode

If the extension can find the KirNet package or Wally proxy, it overwrites that entrypoint with the generated typed wrapper.

- Proxy package: preserves the original `return require(...)` target and wraps it.
- Source package: creates `_KirNetImpl.luau` as a backup of the original implementation and points the generated wrapper at it.

### Standalone Mode

If the package cannot be found, the extension writes the generated wrapper to `paths.output` and leaves your package untouched.

## Commands

| Command | Description |
| --- | --- |
| `KirNet: Regenerate Types Now` | Force immediate regeneration. |
| `KirNet: Show Output` | Open the KirNet output channel. |
| `KirNet: Open GitHub README` | Open the KirNet repository README in your browser. |
| `KirNet: Open Generated Types File` | Open the current generated wrapper file. |
| `KirNet: Reload Config` | Re-read `kirnet.toml` and regenerate. |
| `KirNet: List Services` | Show the services discovered by the parser. |
| `KirNet: Go to Service Definition` | Jump to a parsed service definition. |
| `KirNet: Restore Original Package (Remove Injection)` | Restore the package entry file that was replaced by injection mode. |
| `KirNet: Create New Service` | Scaffold a new KirNet service file. |
| `KirNet: Init` | Create a starter `kirnet.toml` for the workspace. |
| `KirNet: Enable` | Re-enable automatic type generation for the current workspace. |
| `KirNet: Disable` | Pause automatic type generation for the current workspace. |

## How The Generated Wrapper Helps

The generated wrapper overloads `GetService()` and `RegisterService()` with literal service names. That gives `luau-lsp` a concrete return type when you write code like this:

```luau
local TypedKirNet = require(game:GetService("ReplicatedStorage").Shared.Packages.KirNet)
local DataService = TypedKirNet.GetService("DataService")
```

That means:

- service names autocomplete inside the string literal
- returned services expose the right members without manual casts
- field types stay attached to the service definition instead of being re-declared at every call site

## Notes

- The extension activates only when the workspace contains `default.project.json`.
- Save-triggered regeneration is debounced to avoid duplicate runs during rapid edits.
- The output channel is named `KirNet Type Generator`.
