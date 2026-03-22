/**
 * Standalone test harness — run with: npx tsx --require ./mock-vscode.cjs test-parser.ts
 * Tests the parser against every realistic pattern a user would write.
 */
import { parseFile } from "./src/parser";
import { generateTypesContent } from "./src/generator";
interface TestCase {
	name: string;
	input: string;
	expectedServices: { name: string; fields: { name: string; type: string }[] }[];
}

const cases: TestCase[] = [
	// ─── SINGLE-LINE SIGNAL: typed, with KirNet. prefix ──────────────────────
	{
		name: "typed signal (KirNet.Signal<string>)",
		input: `
local KirNet = require(game.ReplicatedStorage.KirNet)
KirNet.RegisterService("Svc1", {
	OnChat = KirNet.CreateSignal() :: KirNet.Signal<string>,
})
`,
		expectedServices: [
			{ name: "Svc1", fields: [{ name: "OnChat", type: "Signal<string>" }] },
		],
	},
	// ─── SINGLE-LINE SIGNAL: typed, WITHOUT module prefix ────────────────────
	{
		name: "typed signal (Signal<string>) — no module prefix",
		input: `
local KirNet = require(game.ReplicatedStorage.KirNet)
KirNet.RegisterService("Svc2", {
	OnChat = KirNet.CreateSignal() :: Signal<string>,
})
`,
		expectedServices: [
			{ name: "Svc2", fields: [{ name: "OnChat", type: "Signal<string>" }] },
		],
	},
	// ─── SINGLE-LINE SIGNAL: untyped ─────────────────────────────────────────
	{
		name: "untyped signal (no cast)",
		input: `
local KirNet = require(game.ReplicatedStorage.KirNet)
KirNet.RegisterService("Svc3", {
	OnChat = KirNet.CreateSignal(),
})
`,
		expectedServices: [
			{ name: "Svc3", fields: [{ name: "OnChat", type: "Signal<any>" }] },
		],
	},
	// ─── SIGNAL WITH OPTIONS TABLE (single line) ─────────────────────────────
	{
		name: "typed signal with options table (single line)",
		input: `
local KirNet = require(game.ReplicatedStorage.KirNet)
KirNet.RegisterService("Svc4", {
	OnDamage = KirNet.CreateSignal({ batched = true }) :: KirNet.Signal<number>,
})
`,
		expectedServices: [
			{ name: "Svc4", fields: [{ name: "OnDamage", type: "Signal<number>" }] },
		],
	},
	// ─── SIGNAL WITH OPTIONS TABLE (multi-line) ──────────────────────────────
	{
		name: "typed signal with multi-line options (multi-line)",
		input: `
local KirNet = require(game.ReplicatedStorage.KirNet)
KirNet.RegisterService("Svc5", {
	OnDamage = KirNet.CreateSignal({
		batched = true,
		lossy = false,
	}) :: KirNet.Signal<number>,
})
`,
		expectedServices: [
			{ name: "Svc5", fields: [{ name: "OnDamage", type: "Signal<number>" }] },
		],
	},
	// ─── SIGNAL WITH MULTI-LINE OPTIONS — UNTYPED ────────────────────────────
	{
		name: "untyped signal with multi-line options",
		input: `
local KirNet = require(game.ReplicatedStorage.KirNet)
KirNet.RegisterService("Svc6", {
	OnDamage = KirNet.CreateSignal({
		batched = true,
	}),
})
`,
		expectedServices: [
			{ name: "Svc6", fields: [{ name: "OnDamage", type: "Signal<any>" }] },
		],
	},
	// ─── SIGNAL WITH INLINE COMMENT ──────────────────────────────────────────
	{
		name: "signal with inline comment",
		input: `
local KirNet = require(game.ReplicatedStorage.KirNet)
KirNet.RegisterService("Svc7", {
	OnChat = KirNet.CreateSignal() :: KirNet.Signal<string>, -- fired on chat
})
`,
		expectedServices: [
			{ name: "Svc7", fields: [{ name: "OnChat", type: "Signal<string>" }] },
		],
	},
	// ─── FUNCTION (CreateFunction, single-line) ──────────────────────────────
	{
		name: "CreateFunction with return type",
		input: `
local KirNet = require(game.ReplicatedStorage.KirNet)
KirNet.RegisterService("Svc8", {
	GetCoins = KirNet.CreateFunction(function(player: Player): number
		return 42
	end),
})
`,
		expectedServices: [
			{ name: "Svc8", fields: [{ name: "GetCoins", type: "ServerFunction<number>" }] },
		],
	},
	// ─── FUNCTION WITH EXTRA PARAMS ──────────────────────────────────────────
	{
		name: "CreateFunction with extra params",
		input: `
local KirNet = require(game.ReplicatedStorage.KirNet)
KirNet.RegisterService("Svc9", {
	SetName = KirNet.CreateFunction(function(player: Player, name: string): boolean
		return true
	end),
})
`,
		expectedServices: [
			{
				name: "Svc9",
				fields: [{ name: "SetName", type: "ServerFunction<boolean>" }],
			},
		],
	},
	// ─── MULTIPLE FIELDS IN ONE SERVICE ──────────────────────────────────────
	{
		name: "multiple fields: signal + function",
		input: `
local KirNet = require(game.ReplicatedStorage.KirNet)
KirNet.RegisterService("GameService", {
	OnDeath = KirNet.CreateSignal() :: KirNet.Signal<Player>,
	GetHealth = KirNet.CreateFunction(function(player: Player): number
		return 100
	end),
})
`,
		expectedServices: [
			{
				name: "GameService",
				fields: [
					{ name: "OnDeath", type: "Signal<Player>" },
					{ name: "GetHealth", type: "ServerFunction<number>" },
				],
			},
		],
	},
	// ─── NESTED SUB-TABLE (Client = { ... }) ─────────────────────────────────
	{
		name: "nested Client sub-table with signals",
		input: `
local KirNet = require(game.ReplicatedStorage.KirNet)
KirNet.RegisterService("DataService", {
	Client = {
		OnDataChanged = KirNet.CreateSignal() :: KirNet.Signal<string, any>,
		GetData = KirNet.CreateFunction(function(player: Player, key: string): any
			return nil
		end),
	},
})
`,
		expectedServices: [
			{
				name: "DataService",
				fields: [
					{ name: "OnDataChanged", type: "Signal<string, any>" },
					{ name: "GetData", type: "ServerFunction<any>" },
				],
			},
		],
	},
	// ─── BARE FUNCTION (no CreateFunction) ───────────────────────────────────
	{
		name: "bare function style",
		input: `
local KirNet = require(game.ReplicatedStorage.KirNet)
KirNet.RegisterService("UtilService", {
	DoThing = function(player: Player, x: number): string
		return tostring(x)
	end,
})
`,
		expectedServices: [
			{
				name: "UtilService",
				fields: [{ name: "DoThing", type: "ServerFunction<string>" }],
			},
		],
	},
	// ─── COMPLEX GENERIC SIGNAL ──────────────────────────────────────────────
	{
		name: "signal with complex generic type",
		input: `
local KirNet = require(game.ReplicatedStorage.KirNet)
KirNet.RegisterService("InventoryService", {
	OnInventoryUpdate = KirNet.CreateSignal() :: KirNet.Signal<{ [string]: number }>,
})
`,
		expectedServices: [
			{
				name: "InventoryService",
				fields: [
					{ name: "OnInventoryUpdate", type: "Signal<{ [string]: number }>" },
				],
			},
		],
	},
	// ─── CUSTOM VAR NAME (e.g. Net) ──────────────────────────────────────────
	{
		name: "custom variable name (Net instead of KirNet)",
		input: `
local Net = require(game.ReplicatedStorage.KirNet)
Net.RegisterService("CustomVar", {
	Msg = Net.CreateSignal() :: Net.Signal<string>,
})
`,
		expectedServices: [
			{
				name: "CustomVar",
				fields: [{ name: "Msg", type: "Signal<string>" }],
			},
		],
	},
	// ─── SIGNAL: empty parens, no options ─────────────────────────────────────
	{
		name: "signal with empty options (nil arg)",
		input: `
local KirNet = require(game.ReplicatedStorage.KirNet)
KirNet.RegisterService("SvcEmpty", {
	Ping = KirNet.CreateSignal(nil) :: KirNet.Signal<()>,
})
`,
		expectedServices: [
			{
				name: "SvcEmpty",
				fields: [{ name: "Ping", type: "Signal<()>" }],
			},
		],
	},
	// ─── New API: CreateServerSignal / CreateClientSignal / CreateServerFunction ──
	{
		name: "new API: CreateServerSignal, CreateClientSignal, CreateServerFunction",
		input: `
local KirNet = require(game.ReplicatedStorage.KirNet)
KirNet.RegisterService("NewApiService", {
	OnData = KirNet.CreateServerSignal() :: KirNet.ServerSignal<string>,
	OnInput = KirNet.CreateClientSignal() :: KirNet.ClientSignal<number>,
	GetInfo = KirNet.CreateServerFunction(function(player: Player): boolean
		return true
	end),
})
`,
		expectedServices: [
			{
				name: "NewApiService",
				fields: [
					{ name: "OnData", type: "ServerSignal<string>" },
					{ name: "OnInput", type: "ClientSignal<number>" },
					{ name: "GetInfo", type: "ServerFunction<boolean>" },
				],
			},
		],
	},
	// ─── SIGNAL WITH TRAILING COMMA AND COMMENT ──────────────────────────────
	{
		name: "signal trailing comma then comment",
		input: `
local KirNet = require(game.ReplicatedStorage.KirNet)
KirNet.RegisterService("SvcTrail", {
	Foo = KirNet.CreateSignal() :: KirNet.Signal<string>, -- some comment
	Bar = KirNet.CreateSignal() :: KirNet.Signal<number>,
})
`,
		expectedServices: [
			{
				name: "SvcTrail",
				fields: [
					{ name: "Foo", type: "Signal<string>" },
					{ name: "Bar", type: "Signal<number>" },
				],
			},
		],
	},
	// ─── SIGNAL WITH OPTIONS TABLE CONTAINING NESTED BRACES ──────────────────
	{
		name: "signal with nested braces in options",
		input: `
local KirNet = require(game.ReplicatedStorage.KirNet)
KirNet.RegisterService("SvcNested", {
	OnData = KirNet.CreateSignal({
		batched = true,
		lossy = false,
		compressionThreshold = 100,
	}) :: KirNet.Signal<{ name: string, value: number }>,
})
`,
		expectedServices: [
			{
				name: "SvcNested",
				fields: [
					{ name: "OnData", type: "Signal<{ name: string, value: number }>" },
				],
			},
		],
	},
	// ─── MULTI-LINE SIGNAL CAST ON SEPARATE LINE ─────────────────────────────
	{
		name: "signal cast on next line",
		input: `
local KirNet = require(game.ReplicatedStorage.KirNet)
KirNet.RegisterService("SvcMultiCast", {
	OnEvent = KirNet.CreateSignal()
		:: KirNet.Signal<string>,
})
`,
		expectedServices: [
			{
				name: "SvcMultiCast",
				fields: [{ name: "OnEvent", type: "Signal<string>" }],
			},
		],
	},
	// ─── CreateFunction WITH NO PARAMS (just player) ─────────────────────────
	{
		name: "CreateFunction with only player param",
		input: `
local KirNet = require(game.ReplicatedStorage.KirNet)
KirNet.RegisterService("SvcNoParam", {
	Ping = KirNet.CreateFunction(function(player: Player): boolean
		return true
	end),
})
`,
		expectedServices: [
			{
				name: "SvcNoParam",
				fields: [{ name: "Ping", type: "ServerFunction<boolean>" }],
			},
		],
	},
	// ─── MIX: 3 signals + 2 functions ────────────────────────────────────────
	{
		name: "large service with mixed fields",
		input: `
local KirNet = require(game.ReplicatedStorage.KirNet)
KirNet.RegisterService("BigService", {
	OnJoin = KirNet.CreateSignal() :: KirNet.Signal<Player>,
	OnLeave = KirNet.CreateSignal() :: KirNet.Signal<Player>,
	OnChat = KirNet.CreateSignal() :: KirNet.Signal<string>,
	GetPlayerData = KirNet.CreateFunction(function(player: Player, key: string): any
		return nil
	end),
	SetPlayerData = KirNet.CreateFunction(function(player: Player, key: string, value: any): boolean
		return true
	end),
})
`,
		expectedServices: [
			{
				name: "BigService",
				fields: [
					{ name: "OnJoin", type: "Signal<Player>" },
					{ name: "OnLeave", type: "Signal<Player>" },
					{ name: "OnChat", type: "Signal<string>" },
					{ name: "GetPlayerData", type: "ServerFunction<any>" },
					{ name: "SetPlayerData", type: "ServerFunction<boolean>" },
				],
			},
		],
	},
	// ─── MULTIPLE SERVICES IN ONE FILE ───────────────────────────────────────
	{
		name: "two services in one file",
		input: `
local KirNet = require(game.ReplicatedStorage.KirNet)
KirNet.RegisterService("ServiceA", {
	Notify = KirNet.CreateSignal() :: KirNet.Signal<string>,
})
KirNet.RegisterService("ServiceB", {
	Health = KirNet.CreateSignal() :: KirNet.Signal<number>,
})
`,
		expectedServices: [
			{
				name: "ServiceA",
				fields: [{ name: "Notify", type: "Signal<string>" }],
			},
			{
				name: "ServiceB",
				fields: [{ name: "Health", type: "Signal<number>" }],
			},
		],
	},
	// ─── SIGNAL: tuple type (multiple type params) ───────────────────────────
	{
		name: "signal with tuple type args",
		input: `
local KirNet = require(game.ReplicatedStorage.KirNet)
KirNet.RegisterService("SvcTuple", {
	OnMove = KirNet.CreateSignal() :: KirNet.Signal<Vector3, number, boolean>,
})
`,
		expectedServices: [
			{
				name: "SvcTuple",
				fields: [{ name: "OnMove", type: "Signal<Vector3, number, boolean>" }],
			},
		],
	},
	// ─── FUNCTION WITH BARE VARIADIC (...) ───────────────────────────────────
	{
		name: "CreateFunction with bare variadic",
		input: `
local KirNet = require(game.ReplicatedStorage.KirNet)
KirNet.RegisterService("SvcVariadic1", {
	FireGun = KirNet.CreateFunction(function(player: Player, ...): boolean
		return true
	end),
})
`,
		expectedServices: [
			{
				name: "SvcVariadic1",
				fields: [{ name: "FireGun", type: "ServerFunction<boolean>" }],
			},
		],
	},
	// ─── FUNCTION WITH TYPED VARIADIC (...: any) ─────────────────────────────
	{
		name: "CreateFunction with typed variadic",
		input: `
local KirNet = require(game.ReplicatedStorage.KirNet)
KirNet.RegisterService("SvcVariadic2", {
	FireGun = KirNet.CreateFunction(function(player: Player, ...: any): boolean
		return true
	end),
})
`,
		expectedServices: [
			{
				name: "SvcVariadic2",
				fields: [{ name: "FireGun", type: "ServerFunction<boolean>" }],
			},
		],
	},
	// ─── BARE FUNCTION WITH VARIADIC ─────────────────────────────────────────
	{
		name: "bare function with variadic",
		input: `
local KirNet = require(game.ReplicatedStorage.KirNet)
KirNet.RegisterService("SvcVariadic3", {
	DoStuff = function(player: Player, ...): string
		return ""
	end,
})
`,
		expectedServices: [
			{
				name: "SvcVariadic3",
				fields: [{ name: "DoStuff", type: "ServerFunction<string>" }],
			},
		],
	},
];

// ─── Runner ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

for (const tc of cases) {
	const result = parseFile(tc.input, "test.luau", false);

	let ok = true;
	const errors: string[] = [];

	if (result.services.length !== tc.expectedServices.length) {
		ok = false;
		errors.push(
			`  service count: expected ${tc.expectedServices.length}, got ${result.services.length}`,
		);
	}

	for (let si = 0; si < tc.expectedServices.length; si++) {
		const exp = tc.expectedServices[si];
		const got = result.services[si];

		if (!got) {
			ok = false;
			errors.push(`  missing service ${exp.name}`);
			continue;
		}

		if (got.name !== exp.name) {
			ok = false;
			errors.push(`  service name: expected "${exp.name}", got "${got.name}"`);
		}

		if (got.fields.length !== exp.fields.length) {
			ok = false;
			errors.push(
				`  ${exp.name} field count: expected ${exp.fields.length}, got ${got.fields.length}`,
			);
		}

		for (let fi = 0; fi < exp.fields.length; fi++) {
			const ef = exp.fields[fi];
			const gf = got.fields[fi];

			if (!gf) {
				ok = false;
				errors.push(`  ${exp.name}: missing field ${ef.name}`);
				continue;
			}

			if (gf.name !== ef.name) {
				ok = false;
				errors.push(
					`  ${exp.name}: field name: expected "${ef.name}", got "${gf.name}"`,
				);
			}
			if (gf.type !== ef.type) {
				ok = false;
				errors.push(
					`  ${exp.name}.${ef.name}: expected type "${ef.type}", got "${gf.type}"`,
				);
			}
		}
	}

	if (result.warnings.length > 0) {
		for (const w of result.warnings) {
			errors.push(`  warning: ${w.message}`);
		}
	}

	if (ok) {
		console.log(`✔ ${tc.name}`);
		passed++;
	} else {
		console.log(`✘ ${tc.name}`);
		for (const e of errors) {
			console.log(e);
		}
		// Also dump raw result for debugging
		console.log(`  raw services: ${JSON.stringify(result.services.map(s => ({ name: s.name, fields: s.fields })))}`);
		failed++;
	}
}

console.log(`\n${passed} passed, ${failed} failed out of ${cases.length} tests`);

// ─── Generator test ──────────────────────────────────────────────────────────
console.log("\n─── Generator output test ───");

const genInput = `
local KirNet = require(game.ReplicatedStorage.KirNet)
KirNet.RegisterService("CombatService", {
	OnDamage = KirNet.CreateSignal({ batched = true }) :: KirNet.Signal<number>,
	OnDeath = KirNet.CreateSignal() :: KirNet.Signal<Player>,
	GetHealth = KirNet.CreateFunction(function(player: Player): number
		return 100
	end),
	SetHealth = KirNet.CreateFunction(function(player: Player, hp: number): boolean
		return true
	end),
})
`;
const parseResult = parseFile(genInput, "test.luau", false);
const generated = generateTypesContent(parseResult.services, 'game:GetService("ReplicatedStorage").KirNet');
console.log(generated);

// Verify the generated output contains the right type definitions
const checks = [
	["ServerSignal<T...> type def", /type ServerSignal<T\.\.\.> = \{/],
	["ClientSignal<T...> type def", /type ClientSignal<T\.\.\.> = \{/],
	["Signal<T...> type def", /type Signal<T\.\.\.> = \{/],
	["ServerFunction<TReturn> type def", /type ServerFunction<TReturn> = \{/],
	["ServerSignal.Fire method", /Fire: \(self: ServerSignal<T\.\.\.>, player: Player, T\.\.\.\) -> \(\)/],
	["ServerSignal.Connect method", /Connect: \(self: ServerSignal<T\.\.\.>, callback: \(T\.\.\.\) -> \(\)\) -> \(\)/],
	["ClientSignal.OnServerEvent method", /OnServerEvent: \(self: ClientSignal<T\.\.\.>, callback: \(player: Player, T\.\.\.\) -> \(\)\) -> \(\)/],
	["Signal.Fire method", /Fire: \(self: Signal<T\.\.\.>, player: Player, T\.\.\.\) -> \(\)/],
	["Signal.FireServer method", /FireServer: \(self: Signal<T\.\.\.>, T\.\.\.\) -> \(\)/],
	["Signal.Connect method", /Connect: \(self: Signal<T\.\.\.>, callback: \(T\.\.\.\) -> \(\)\) -> \(\)/],
	["Signal.OnServerEvent method", /OnServerEvent: \(self: Signal<T\.\.\.>, callback: \(player: Player, T\.\.\.\) -> \(\)\) -> \(\)/],
	["ServerFunction.Call method", /Call: \(self: ServerFunction<TReturn>, \.\.\.any\) -> TReturn/],
	["CombatServiceType export", /export type CombatServiceType = \{/],
	["OnDamage typed as Signal<number>", /OnDamage: Signal<number>/],
	["OnDeath typed as Signal<Player>", /OnDeath: Signal<Player>/],
	["GetHealth typed correctly", /GetHealth: ServerFunction<number>/],
	["SetHealth typed correctly", /SetHealth: ServerFunction<boolean>/],
	["TypedKirNet type", /type TypedKirNet = \{/],
	["CreateSignal in TypedKirNet", /CreateSignal: typeof\(KirNet\.CreateSignal\)/],
	["CreateFunction in TypedKirNet", /CreateFunction: typeof\(KirNet\.CreateFunction\)/],
	["GetService overload for CombatService", /\(\(name: "CombatService"\) -> CombatServiceType\)/],
	["GetService fallback overload", /\(\(name: string\) -> \{ \[string\]: any \}\)/],
	["RegisterService overload for CombatService", /\(\(name: "CombatService", definition: CombatServiceType\) -> CombatServiceType\)/],
	["Return cast to TypedKirNet", /return \(KirNet :: any\) :: TypedKirNet/],
	["No leading & without left operand", { test: (s: string) => !/ =\s*\n\s*&/.test(s), source: "negative check" }],
	["No KirNet.Signal in output", { test: (s: string) => !s.includes("KirNet.Signal"), source: "negative check" }],
	["No KirNet.Function in output", { test: (s: string) => !s.includes("KirNet.Function"), source: "negative check" }],
] as const;

let genPassed = 0;
let genFailed = 0;
for (const [label, check] of checks) {
	const ok = check instanceof RegExp ? check.test(generated) : (check as any).test(generated);
	if (ok) {
		console.log(`✔ ${label}`);
		genPassed++;
	} else {
		console.log(`✘ ${label}`);
		genFailed++;
	}
}

console.log(`\nGenerator: ${genPassed} passed, ${genFailed} failed out of ${checks.length} checks`);

const totalFailed = failed + genFailed;
process.exit(totalFailed > 0 ? 1 : 0);
