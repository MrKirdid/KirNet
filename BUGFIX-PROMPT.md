# KirNet Bug Fix Prompt

You are fixing bugs in **KirNet**, a Roblox networking library (Luau, in `src/`) and its companion VS Code extension (TypeScript, in `kirnet-type-gen/`). Apply every fix described below. Do not refactor surrounding code, do not add features, keep changes minimal and surgical. After each file, verify no syntax errors were introduced.

---

## FIX 1 — Batch marker collision with valid route IDs

**File:** `src/Signal.luau`

**Problem:** `isBatch()` checks `buffer.readu8(pkt, 0) == 0xFF`. Normal packets start with a u16 route ID (little-endian). Any route ID whose low byte is `0xFF` (255, 511, 767, …) will be misidentified as a batch packet, corrupting parsing.

**Fix:** Change the batch format to use a **2-byte marker** (`0xFFFF`). This means:

1. In `src/Batcher.luau`, change:
   ```luau
   Batcher.BATCH_MARKER = 0xFF
   ```
   to:
   ```luau
   Batcher.BATCH_MARKER = 0xFFFF
   ```

2. In `src/Signal.luau`, change `buildBatchPacket` to write a u16 marker and u16 count instead of u8+u8. Update `totalSize` from `2` to `4` (2 for marker, 2 for count):
   ```luau
   local function buildBatchPacket(packets: { buffer }): buffer
       local totalSize = 4 -- u16 marker + u16 count
       for _, pkt in packets do
           totalSize += buffer.len(pkt)
       end
       local batch = buffer.create(totalSize)
       buffer.writeu16(batch, 0, Batcher.BATCH_MARKER)
       buffer.writeu16(batch, 2, #packets)
       local cursor = 4
       ...
   ```

3. In `Signal.isBatch`, read a u16 and check length >= 4:
   ```luau
   function Signal.isBatch(pkt: buffer): boolean
       return buffer.len(pkt) >= 4 and buffer.readu16(pkt, 0) == Batcher.BATCH_MARKER
   end
   ```

4. In `Signal.parseBatch`, read the count as u16 from offset 2, and start cursor at 4:
   ```luau
   function Signal.parseBatch(pkt: buffer): { buffer }
       local count = buffer.readu16(pkt, 2)
       local packets: { buffer } = {}
       local cursor = 4
       ...
   ```

5. In `src/Router.luau`, add a guard in `Router.register()` to ensure route ID `0xFFFF` is never assigned. If `_nextId` reaches `0xFFFF`, skip it:
   ```luau
   local id = _nextId
   _nextId += 1
   if _nextId == 0xFFFF then
       _nextId += 1
   end
   ```

This also fixes **issue #8** (batch count overflow for >255 entries) since the count is now u16 (max 65535).

---

## FIX 2 — `getService` timeout never resumes the yielded coroutine

**File:** `src/Registry.luau`

**Problem:** On timeout, `task.defer(function() error(...) end)` fires the error in a throwaway coroutine. The original `coroutine.yield()` caller is never resumed and hangs forever. The `if timedOut then error(...)` after `coroutine.yield()` is dead code.

**Fix:** Replace the timeout handler so it resumes the waiting thread directly. Change the timeout block (around lines 430–452) to:

```luau
-- Set up timeout
local timedOut = false
task.delay(timeoutSec, function()
    local waiting = _waitingForService[name]
    if waiting then
        local idx = table.find(waiting, thread)
        if idx then
            table.remove(waiting, idx)
            timedOut = true
            task.spawn(thread) -- resume the yielded coroutine so it can check timedOut
        end
    end
end)

coroutine.yield()

if timedOut then
    error(
        string.format(
            '[KirNet] ERROR: GetService("%s") timed out after %d seconds. Is the service registered on the server?',
            name,
            timeoutSec
        )
    )
end
```

Remove the old `if timedOut then return end` guard at the top of the `task.delay` callback — it was checking `timedOut` before it was set, which is always false.

---

## FIX 3 — `Signal.Wait()` timeout permanently yields the caller

**File:** `src/Signal.luau`

**Problem:** Same pattern as Fix 2. `task.defer(function() error(...) end)` fires in a throwaway coroutine; the caller of `Wait()` is never resumed.

**Fix:** Replace the timeout block in `Signal.Wait` (around lines 437–448) to resume the caller thread directly:

```luau
function Signal.Wait(self: any, timeout: number?): ...any
    local thread = coroutine.running()
    local timedOut = false
    table.insert(self._waitingThreads, thread)

    if timeout then
        task.delay(timeout, function()
            local idx = table.find(self._waitingThreads, thread)
            if idx then
                table.remove(self._waitingThreads, idx)
                timedOut = true
                task.spawn(thread) -- resume so coroutine.yield() returns
            end
        end)
    end

    local results = { coroutine.yield() }

    if timedOut then
        error(string.format("[KirNet] ERROR: Signal:Wait() timed out after %d seconds.", timeout))
    end

    return table.unpack(results)
end
```

---

## FIX 4 — Compression `MAX_MATCH` overflows u8 storage

**File:** `src/Compression.luau`

**Problem:** `MAX_MATCH = 258` but match length is written via `buffer.writeu8` (max 255). Lengths 256–258 silently wrap to 0–2, corrupting data on decompression.

**Fix:** Change line 21:
```luau
local MAX_MATCH = 255
```

---

## FIX 5 — Batch `_flushBatch` uses first entry's targets for ALL entries

**File:** `src/Signal.luau`

**Problem:** Within one heartbeat, `Fire(playerA, ...)` and `Fire(playerB, ...)` on the same signal both enqueue to the same batch. At flush, only `firstEntry.targets` is used — playerB never receives data.

**Fix:** Group batch entries by their target pattern before sending. Replace the `_flushBatch` method body:

```luau
function Signal._flushBatch(self: any, entries: { Batcher.BatchEntry })
    local remote = _remoteEvent
    if not remote then
        return
    end

    -- Group entries by target pattern to send correct packets to correct recipients
    -- Group key: "all", "except:<UserId>", "players:<sorted UserId list>"
    local groups: { [string]: { entries: { Batcher.BatchEntry }, sample: Batcher.BatchEntry } } = {}

    for _, entry in entries do
        local key: string
        if entry.isFireAll then
            key = "all"
        elseif entry.excludePlayer then
            key = "except:" .. tostring(entry.excludePlayer.UserId)
        elseif entry.targets then
            local ids = {}
            for _, p in entry.targets do
                table.insert(ids, tostring(p.UserId))
            end
            table.sort(ids)
            key = "players:" .. table.concat(ids, ",")
        else
            key = "all"
        end

        if not groups[key] then
            groups[key] = { entries = {}, sample = entry }
        end
        table.insert(groups[key].entries, entry)
    end

    for _, group in groups do
        local allPackets: { buffer } = {}
        for _, entry in group.entries do
            table.insert(allPackets, buildPacket(entry.id, FLAG_BATCHED, entry.payload))
        end

        if #allPackets == 0 then
            continue
        end

        local batchPkt = buildBatchPacket(allPackets)
        local sample = group.sample

        if sample.isFireAll then
            remote:FireAllClients(batchPkt)
        elseif sample.excludePlayer then
            for _, player in Players:GetPlayers() do
                if player ~= sample.excludePlayer then
                    remote:FireClient(player, batchPkt)
                end
            end
        elseif sample.targets then
            for _, player in sample.targets do
                remote:FireClient(player, batchPkt)
            end
        end
    end
end
```

---

## FIX 6 — Dead `GetComponents()` call + unused variables in Codec

**File:** `src/Codec.luau`

**Problem:** Around line 172, `local ax, ay, az, aw = cf:GetComponents()` captures 4 values that are never used. Position is taken from `cf.Position`, rotation from a second `GetComponents()` call on line ~179. This is a wasted FFI call and 4 dead variables.

**Fix:** Delete the line:
```luau
local ax, ay, az, aw = cf:GetComponents()
```

---

## FIX 7 — Debug log uses `#` on a dictionary (always 0)

**File:** `src/Registry.luau`

**Problem:** Around line 309: `#(methods :: any)` on a dictionary with non-sequential keys returns 0 in Luau.

**Fix:** Count entries during the loop that builds `methods`, then use that count:

Before the for loop that populates `methods`, add `local methodCount = 0`. Inside the loop body, add `methodCount += 1`. Then change the print to use `methodCount` instead of `#(methods :: any)`.

---

## FIX 8 — Unknown codec tag leaves cursor misaligned

**File:** `src/Codec.luau`

**Problem:** At the end of `readValue`, if an unrecognized type tag is encountered, the function returns `(nil, cursor)`. The cursor advanced past the tag byte but not past the unknown value's data. All subsequent reads in the same buffer will be misaligned, producing garbage.

**Fix:** Change the fallback return at the end of `readValue` to `error()` instead of silently returning nil:
```luau
error(string.format("[KirNet] Unknown codec tag: %d at cursor %d", tag, cursor - 1))
```

---

## FIX 9 — Rate-limit entries never cleaned for disconnected players

**File:** `src/Signal.luau`

**Problem:** `_rateLimits[routeId][userId]` entries accumulate forever — no cleanup on player disconnect. Over a long session with many unique players, this grows unboundedly.

**Fix:** Add a `Players.PlayerRemoving` connection at module scope (near the other module-level code at the top of the file, after the `_rateLimits` declaration):

```luau
if IS_SERVER then
    Players.PlayerRemoving:Connect(function(player)
        local userId = player.UserId
        for _, playerLimits in _rateLimits do
            playerLimits[userId] = nil
        end
    end)
end
```

---

## FIX 10 — Decompression doesn't validate buffer bounds

**File:** `src/Compression.luau`

**Problem:** In `decompress`, a malformed compressed buffer could have `dist > outCursor`, making `srcPos` negative → OOB read. Also no check that enough bytes remain to read the reference fields.

**Fix:** Add bounds checks inside the decompress loop's REFERENCE_FLAG branch:

```luau
if flag == REFERENCE_FLAG then
    if inCursor + 3 > inputLen then
        break -- truncated reference, bail out
    end
    local dist = buffer.readu16(input, inCursor)
    inCursor += 2
    local len = buffer.readu8(input, inCursor)
    inCursor += 1

    local srcPos = outCursor - dist
    if srcPos < 0 or outCursor + len > originalLen then
        break -- invalid reference, bail out
    end
    for i = 0, len - 1 do
        buffer.writeu8(outBuf, outCursor + i, buffer.readu8(outBuf, srcPos + i))
    end
    outCursor += len
```

---

## FIX 11 — Extension diagnostics filter never matches (zero diagnostics shown)

**File:** `kirnet-type-gen/src/extension.ts`

**Problem:** `updateDiagnostics` filters for `"Could not parse this entry"`, but the parser never emits that exact string. It emits messages like `"Could not find matching closing brace"`, `"is untyped"`, `"has no return type annotation"`, etc. Zero diagnostics are ever shown.

**Fix:** Remove the filter entirely — all parser warnings should appear as diagnostics. Change the loop in `updateDiagnostics` from:

```ts
for (const w of result.warnings) {
    if (!w.message.includes("Could not parse this entry")) {
        continue;
    }
```

to:

```ts
for (const w of result.warnings) {
```

(just remove the `if` + `continue` block)

---

## FIX 12 — Parser doesn't handle block comments `--[[ ... ]]`

**File:** `kirnet-type-gen/src/parser.ts`

**Problem:** In `extractTableBody`, `findMatchingParen`, and potentially `stripInlineComment`: when `--` is encountered, the code skips to EOL. But `--[[ multi-line ]]` spans multiple lines. Lines inside the block comment are parsed as code, corrupting brace depth tracking.

**Fix:** Add block comment handling. In `extractTableBody`, `findMatchingParen`, and `skipToMatchingEnd`, when encountering `--`, check if the next chars are `[[` or `[=[` etc. If so, skip to the matching `]]` or `]=]`.

For `extractTableBody` and `findMatchingParen`, replace the existing `--` comment skip:

```ts
} else if (ch === "-" && content[i + 1] === "-") {
```

with:

```ts
} else if (ch === "-" && content[i + 1] === "-") {
    // Check for block comment: --[[ ... ]]  or --[=[ ... ]=] etc.
    if (content[i + 2] === "[") {
        const afterDashes = content.substring(i + 2);
        const blockOpenMatch = afterDashes.match(/^\[(=*)\[/);
        if (blockOpenMatch) {
            const eqs = blockOpenMatch[1];
            const closeTag = `]${eqs}]`;
            const closeIdx = content.indexOf(closeTag, i + 2 + blockOpenMatch[0].length);
            if (closeIdx === -1) break;
            i = closeIdx + closeTag.length - 1;
            continue;
        }
    }
    // line comment — skip to EOL
```

Keep the existing EOL skip as the fallback after the block comment check.

Also add the same handling for long strings `[=[ ... ]=]`. Replace:

```ts
} else if (ch === "[" && content[i + 1] === "[") {
    // skip multiline strings
    const end = content.indexOf("]]", i + 2);
    if (end === -1) break;
    i = end + 1;
}
```

with:

```ts
} else if (ch === "[" && (content[i + 1] === "[" || content[i + 1] === "=")) {
    const afterBracket = content.substring(i);
    const longStringMatch = afterBracket.match(/^\[(=*)\[/);
    if (longStringMatch) {
        const eqs = longStringMatch[1];
        const closeTag = `]${eqs}]`;
        const closeIdx = content.indexOf(closeTag, i + longStringMatch[0].length);
        if (closeIdx === -1) break;
        i = closeIdx + closeTag.length - 1;
    }
}
```

For `skipToMatchingEnd`, which operates line-by-line and currently does `lines[i].replace(/--.*$/, "")`, replace that with a function that strips both line comments and block comments from the accumulated text. The simplest approach: before the word-splitting loop, strip block comment regions from the full remaining text, or simply make `skipToMatchingEnd` skip lines that are inside a block comment:

```ts
function skipToMatchingEnd(lines: string[], startLine: number): number {
    let depth = 0;
    let inBlockComment = false;
    let blockCloseTag = "]]";
    for (let i = startLine; i < lines.length; i++) {
        let line = lines[i];
        if (inBlockComment) {
            const closeIdx = line.indexOf(blockCloseTag);
            if (closeIdx === -1) continue;
            line = line.substring(closeIdx + blockCloseTag.length);
            inBlockComment = false;
        }
        // Strip block comments that start and end on this line, or start here
        line = line.replace(/--\[(=*)\[[\s\S]*?\]\1\]/g, "");
        const blockStart = line.match(/--\[(=*)\[/);
        if (blockStart) {
            line = line.substring(0, blockStart.index);
            inBlockComment = true;
            blockCloseTag = `]${blockStart[1]}]`;
        }
        // Strip line comments
        const stripped = line.replace(/--.*$/, "").trim();
        // Also strip string literals to avoid matching keywords in strings
        const noStrings = stripped.replace(/"[^"]*"|'[^']*'/g, "");
        const words = noStrings.split(/\W+/);
        for (const word of words) {
            if (word === "function" || word === "if" || word === "for" || word === "while") {
                depth++;
            } else if (word === "end") {
                depth--;
                if (depth <= 0) {
                    return i;
                }
            } else if (word === "repeat") {
                depth++;
            } else if (word === "until") {
                depth--;
                if (depth <= 0) {
                    return i;
                }
            }
        }
    }
    return lines.length - 1;
}
```

Note this also fixes the issue where `skipToMatchingEnd` matches keywords inside string literals.

---

## FIX 13 — Extension debounce timer survives deactivation

**File:** `kirnet-type-gen/src/watcher.ts`

**Problem:** The pending debounce timer isn't cleared when the disposable is disposed. If a 300ms timer is pending, `regenerate()` fires on disposed state.

**Fix:** Clear the timer when the disposable is disposed. Change `watcher.ts` to:

```ts
import * as vscode from "vscode";

let debounceTimer: ReturnType<typeof setTimeout> | undefined;

export function createSaveHandler(
    onTrigger: (uri: vscode.Uri) => void,
    isInScope: (uri: vscode.Uri) => boolean,
): vscode.Disposable {
    const sub = vscode.workspace.onDidSaveTextDocument((doc) => {
        const uri = doc.uri;
        if (!/\.luau?$/.test(uri.fsPath)) {
            return;
        }
        if (!isInScope(uri)) {
            return;
        }

        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }

        debounceTimer = setTimeout(() => {
            debounceTimer = undefined;
            onTrigger(uri);
        }, 300);
    });

    return {
        dispose() {
            if (debounceTimer) {
                clearTimeout(debounceTimer);
                debounceTimer = undefined;
            }
            sub.dispose();
        },
    };
}
```

---

## FIX 14 — Dead code: `splitParams` in parser.ts

**File:** `kirnet-type-gen/src/parser.ts`

**Problem:** The `splitParams` function (lines 641–672) is fully implemented but has no callers.

**Fix:** Delete the entire `splitParams` function.

---

## FIX 15 — Dead code: `writeTypesFile` in generator.ts

**File:** `kirnet-type-gen/src/generator.ts`

**Problem:** `writeTypesFile` is exported but never imported or called by any module.

**Fix:** Delete the `writeTypesFile` function and its import of `fs` and `path` (if they become unused after removal). Check that `fs` is used in the file — if `writeTypesFile` is the only consumer, remove the `fs` import. Same for `path`.

---

## FIX 16 — Config TOML parse errors silently swallowed

**File:** `kirnet-type-gen/src/config.ts`

**Problem:** If `kirnet.toml` has a syntax error, the catch block silently returns defaults with no logging. The user has no idea their config is being ignored.

**Fix:** Import the logger and log a warning in the catch block:

```ts
} catch (e: any) {
    const { log, warn } = require("./logger");
    warn(`Failed to parse kirnet.toml: ${e.message ?? e} — using defaults`);
    return structuredClone(DEFAULTS);
}
```

Or, since it's a top-level import module, do `import * as logger from "./logger"` at the top and use `logger.warn(...)`.

---

## FIX 17 — `PlayerAdded` hook inside `task.defer` can miss early players

**File:** `src/Registry.luau`

**Problem:** At the bottom of the file, remotes and the `PlayerAdded` listener are set up inside `task.defer`. A player connecting in the deferred window could miss both the listener and the `GetPlayers()` loop.

**Fix:** Remove the `task.defer` wrapping. Call `ensureRemotes()` and set up the `PlayerAdded` listener synchronously at module scope:

```luau
if IS_SERVER then
    ensureRemotes()
    Players.PlayerAdded:Connect(function(player)
        task.defer(replicateRoutingTable, player)
    end)
    for _, player in Players:GetPlayers() do
        task.defer(replicateRoutingTable, player)
    end
end
```

---

## Summary of all files to edit:

| File | Fixes |
|---|---|
| `src/Batcher.luau` | #1 (marker → 0xFFFF) |
| `src/Signal.luau` | #1 (batch format), #3 (Wait timeout), #5 (flush grouping), #9 (rate limit cleanup) |
| `src/Registry.luau` | #2 (getService timeout), #7 (method count), #17 (PlayerAdded race) |
| `src/Compression.luau` | #4 (MAX_MATCH), #10 (decompress bounds) |
| `src/Codec.luau` | #6 (dead GetComponents), #8 (unknown tag error) |
| `src/Router.luau` | #1 (skip 0xFFFF route ID) |
| `kirnet-type-gen/src/extension.ts` | #11 (diagnostics filter) |
| `kirnet-type-gen/src/parser.ts` | #12 (block comments + long strings), #14 (dead splitParams) |
| `kirnet-type-gen/src/watcher.ts` | #13 (timer cleanup) |
| `kirnet-type-gen/src/generator.ts` | #15 (dead writeTypesFile) |
| `kirnet-type-gen/src/config.ts` | #16 (log parse errors) |
