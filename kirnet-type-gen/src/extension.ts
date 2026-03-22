import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { readConfig, KirNetConfig } from "./config";
import * as logger from "./logger";
import { parseAll, ParseResult, ServiceDef } from "./parser";
import { generateTypesContent } from "./generator";
import { updateKnownServices, registerCompletionProvider } from "./completions";
import { createSaveHandler } from "./watcher";

let config: KirNetConfig;
let workspaceRoot: string;
let statusBarItem: vscode.StatusBarItem;
let diagnosticCollection: vscode.DiagnosticCollection;

/**
 * Describes the file luau-lsp resolves when the user writes
 * require(Packages.kirnet) — could be a proxy .luau file or
 * a directory init.luau.
 */
interface KirNetEntry {
	/** Absolute path to the file we will overwrite with the typed wrapper. */
	entryFile: string;
	/** The Luau expression the typed wrapper should require to get the real KirNet. */
	requireExpr: string;
	/** "proxy" = single-file proxy, "source" = directory init.luau with real source. */
	kind: "proxy" | "source";
}

let resolvedEntry: KirNetEntry | null = null;
let lastParsedServices: ServiceDef[] = [];

// ────────────────────────────────────────────────────────────────
// Activation
// ────────────────────────────────────────────────────────────────

export function activate(context: vscode.ExtensionContext): void {
	const folders = vscode.workspace.workspaceFolders;
	if (!folders || folders.length === 0) {
		return;
	}

	workspaceRoot = folders[0].uri.fsPath;

	if (!fs.existsSync(path.join(workspaceRoot, "default.project.json"))) {
		return;
	}

	config = readConfig(workspaceRoot);
	logger.log("KirNet Type Generator activated");
	logger.log(`Workspace: ${workspaceRoot}`);

	// Status bar
	statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	statusBarItem.command = "kirnet.showOutput";
	statusBarItem.text = "$(sync~spin) KirNet Types";
	statusBarItem.show();
	context.subscriptions.push(statusBarItem);

	// Diagnostics
	diagnosticCollection = vscode.languages.createDiagnosticCollection("kirnet");
	context.subscriptions.push(diagnosticCollection);

	// Completion provider for GetService("") string suggestions
	registerCompletionProvider(context);

	// Commands
	context.subscriptions.push(
		vscode.commands.registerCommand("kirnet.regenerateTypes", () => regenerate("command")),
		vscode.commands.registerCommand("kirnet.showOutput", () => logger.getChannel().show()),
		vscode.commands.registerCommand("kirnet.openTypesFile", () => {
			const target = resolvedEntry?.entryFile ?? path.join(workspaceRoot, config.paths.output);
			if (fs.existsSync(target)) {
				vscode.window.showTextDocument(vscode.Uri.file(target));
			} else {
				vscode.window.showWarningMessage("Types file has not been generated yet.");
			}
		}),
		vscode.commands.registerCommand("kirnet.reloadConfig", () => {
			config = readConfig(workspaceRoot);
			resolvedEntry = null;
			logger.log("Config reloaded");
			regenerate("config reload");
		}),
		vscode.commands.registerCommand("kirnet.listServices", () => listServicesCommand()),
		vscode.commands.registerCommand("kirnet.goToService", () => goToServiceCommand()),
		vscode.commands.registerCommand("kirnet.restorePackage", () => restorePackageCommand()),
		vscode.commands.registerCommand("kirnet.createService", () => scaffoldCommand()),
	);

	// Save watcher — regenerate when service source files are saved
	const servicesAbsPath = path.resolve(workspaceRoot, config.paths.services).toLowerCase();

	context.subscriptions.push(
		createSaveHandler(
			(uri) => regenerate(`saved: ${path.relative(workspaceRoot, uri.fsPath)}`),
			(uri) => {
				const fp = uri.fsPath.toLowerCase();
				// Don't re-trigger on our own generated output
				if (resolvedEntry && fp === resolvedEntry.entryFile.toLowerCase()) {
					return false;
				}
				return fp.startsWith(servicesAbsPath);
			},
		),
	);

	// Packages watcher — re-inject after wally install
	for (const pattern of [
		"{Packages,ServerPackages,DevPackages}/{kirnet,KirNet}.{luau,lua}",
		"{Packages,ServerPackages,DevPackages}/{kirnet,KirNet}/init.{luau,lua}",
		"{Packages,ServerPackages,DevPackages}/_Index/*kirnet*/**/init.{luau,lua}",
	]) {
		const glob = new vscode.RelativePattern(workspaceRoot, pattern);
		const watcher = vscode.workspace.createFileSystemWatcher(glob);
		const handler = () => {
			logger.log("Detected KirNet package file change — re-injecting...");
			resolvedEntry = null;
			regenerate("packages changed");
		};
		watcher.onDidChange(handler);
		watcher.onDidCreate(handler);
		context.subscriptions.push(watcher);
	}

	// Initial generation
	regenerate("session start");
}

// ────────────────────────────────────────────────────────────────
// Find the KirNet entry file
// ────────────────────────────────────────────────────────────────

function findKirNetEntry(): KirNetEntry | null {
	logger.log("Searching for KirNet package...");

	// 1. Explicit config override
	if (config.paths.kirnet_package) {
		const target = path.resolve(workspaceRoot, config.paths.kirnet_package);
		logger.log(`  Checking configured path: ${target}`);
		const result = probeExplicit(target);
		if (result) {
			return result;
		}
		logger.warn(`  Configured kirnet_package not found or not valid`);
	}

	// 2. Scan common Wally roots
	for (const root of ["Packages", "ServerPackages", "DevPackages"]) {
		const packagesDir = path.join(workspaceRoot, root);
		if (!fs.existsSync(packagesDir)) {
			continue;
		}
		logger.log(`  Scanning ${root}/`);

		// 2a. Proxy file: Packages/kirnet.luau
		const proxy = probeProxyFile(packagesDir);
		if (proxy) {
			return proxy;
		}

		// 2b. Directory module: Packages/kirnet/init.luau
		const dirMod = probeDirModule(packagesDir);
		if (dirMod) {
			return dirMod;
		}

		// 2c. Wally _Index: Packages/_Index/*kirnet*/kirnet/init.luau
		const idx = probeIndex(packagesDir);
		if (idx) {
			return idx;
		}
	}

	// 3. Derive from output path
	const outputDir = path.resolve(workspaceRoot, path.dirname(config.paths.output));
	const result = probeExplicit(outputDir);
	if (result) {
		return result;
	}

	logger.warn(
		"Could not find KirNet package.\n" +
			"  Searched: Packages/kirnet.luau, Packages/kirnet/init.luau, _Index/*kirnet*\n" +
			'  Fix: add [paths] kirnet_package = "Packages/kirnet" in kirnet.toml',
	);
	return null;
}

/** Probe an explicitly-provided path (could be a file or directory). */
function probeExplicit(target: string): KirNetEntry | null {
	if (!fs.existsSync(target)) {
		return null;
	}
	const stat = fs.statSync(target);

	if (stat.isFile()) {
		return probeFile(target);
	}

	if (stat.isDirectory()) {
		for (const ext of [".luau", ".lua"]) {
			const init = path.join(target, `init${ext}`);
			if (fs.existsSync(init)) {
				return probeFile(init);
			}
		}
	}

	return null;
}

/** Check if a .luau file is KirNet (proxy or source) and return the entry info. */
function probeFile(filePath: string): KirNetEntry | null {
	let content: string;
	try {
		content = fs.readFileSync(filePath, "utf-8");
	} catch {
		return null;
	}

	// Already our generated file?
	if (content.includes("AUTO-GENERATED by KirNet Type Generator")) {
		const reqMatch = content.match(/^local KirNet = require\((.+)\)$/m);
		if (reqMatch) {
			const expr = reqMatch[1].trim();
			const isProxy = expr !== "script._KirNetImpl";
			logger.log(`    Found existing injection: ${path.basename(filePath)} (${isProxy ? "proxy" : "source"})`);
			return {
				entryFile: filePath,
				requireExpr: expr,
				kind: isProxy ? "proxy" : "source",
			};
		}
	}

	// Is it a Wally proxy? (contains essentially just: return require(...))
	const proxyMatch = content.match(/^\s*return\s+require\(([^)]+)\)\s*$/m);
	const codeLines = content.split("\n").filter((l) => l.trim() && !l.trim().startsWith("--")).length;

	if (proxyMatch && codeLines <= 3) {
		logger.log(`    Proxy file: ${path.basename(filePath)} → ${proxyMatch[1].trim()}`);
		return {
			entryFile: filePath,
			requireExpr: proxyMatch[1].trim(),
			kind: "proxy",
		};
	}

	// Is it actual KirNet source?
	if (content.includes("GetService") && content.includes("RegisterService")) {
		logger.log(`    KirNet source: ${path.basename(filePath)}`);
		return {
			entryFile: filePath,
			requireExpr: "script._KirNetImpl",
			kind: "source",
		};
	}

	return null;
}

/** Look for Packages/kirnet.luau proxy file (case-insensitive). */
function probeProxyFile(packagesDir: string): KirNetEntry | null {
	try {
		for (const entry of fs.readdirSync(packagesDir)) {
			const lower = entry.toLowerCase();
			if (lower === "kirnet.luau" || lower === "kirnet.lua") {
				const fp = path.join(packagesDir, entry);
				try {
					if (fs.statSync(fp).isFile()) {
						return probeFile(fp);
					}
				} catch {}
			}
		}
	} catch {}
	return null;
}

/** Look for Packages/kirnet/init.luau directory module (case-insensitive). */
function probeDirModule(packagesDir: string): KirNetEntry | null {
	try {
		for (const entry of fs.readdirSync(packagesDir, { withFileTypes: true })) {
			if (!entry.isDirectory()) {
				continue;
			}
			if (entry.name.toLowerCase() !== "kirnet") {
				continue;
			}
			const dir = path.join(packagesDir, entry.name);
			for (const ext of [".luau", ".lua"]) {
				const init = path.join(dir, `init${ext}`);
				if (fs.existsSync(init)) {
					return probeFile(init);
				}
			}
		}
	} catch {}
	return null;
}

/** Look inside Packages/_Index/ for kirnet vendor directories. */
function probeIndex(packagesDir: string): KirNetEntry | null {
	const indexDir = path.join(packagesDir, "_Index");
	if (!fs.existsSync(indexDir)) {
		return null;
	}
	try {
		for (const vendor of fs.readdirSync(indexDir, { withFileTypes: true })) {
			if (!vendor.isDirectory() || !vendor.name.toLowerCase().includes("kirnet")) {
				continue;
			}
			const vendorDir = path.join(indexDir, vendor.name);
			try {
				for (const pkg of fs.readdirSync(vendorDir, { withFileTypes: true })) {
					if (!pkg.isDirectory() || pkg.name.toLowerCase() !== "kirnet") {
						continue;
					}
					const dir = path.join(vendorDir, pkg.name);
					for (const ext of [".luau", ".lua"]) {
						const init = path.join(dir, `init${ext}`);
						if (fs.existsSync(init)) {
							return probeFile(init);
						}
					}
				}
			} catch {}
		}
	} catch {}
	return null;
}

// ────────────────────────────────────────────────────────────────
// Backup + regeneration
// ────────────────────────────────────────────────────────────────

/** For "source" entries: back up the original init → _KirNetImpl.luau. */
function ensureBackup(entry: KirNetEntry): void {
	if (entry.kind !== "source") {
		return; // proxies: we preserve the original require path in the generated wrapper
	}

	const dir = path.dirname(entry.entryFile);
	const backupPath = path.join(dir, "_KirNetImpl.luau");

	if (fs.existsSync(backupPath)) {
		return;
	}

	const content = fs.readFileSync(entry.entryFile, "utf-8");
	if (content.includes("AUTO-GENERATED by KirNet Type Generator")) {
		logger.warn("Init is already generated but _KirNetImpl.luau backup is missing.");
		return;
	}

	logger.log(`Backing up ${path.basename(entry.entryFile)} → _KirNetImpl.luau`);
	fs.copyFileSync(entry.entryFile, backupPath);
}

async function regenerate(trigger: string): Promise<void> {
	statusBarItem.text = "$(sync~spin) KirNet Types";
	logger.log(`--- Regenerating (trigger: ${trigger}) ---`);

	try {
		const result = parseAll(
			workspaceRoot,
			[config.paths.services],
			config.options.debug,
		);

		logger.log(`Found ${result.services.length} service(s)`);
		for (const svc of result.services) {
			logger.log(`  ${svc.name}: ${svc.fields.map((f) => f.name).join(", ")}`);
		}

		for (const w of result.warnings) {
			logger.warn(`${path.relative(workspaceRoot, w.filePath)}:${w.line} — ${w.message}`);
		}

		// Detect entry point (fresh each time — handles wally install)
		resolvedEntry = findKirNetEntry();

		let requirePath: string;
		let outputAbsPath: string;

		if (resolvedEntry) {
			ensureBackup(resolvedEntry);
			requirePath = resolvedEntry.requireExpr;
			outputAbsPath = resolvedEntry.entryFile;
			logger.log(`Injection mode (${resolvedEntry.kind}): ${path.relative(workspaceRoot, outputAbsPath)}`);
			logger.log(`  require = ${requirePath}`);
		} else {
			requirePath = config.options.kirnet_require_path;
			outputAbsPath = path.resolve(workspaceRoot, config.paths.output);
			logger.log(`Standalone mode: ${config.paths.output}`);
		}

		// Generate and write (skip if content is unchanged to avoid watcher re-triggers)
		const content = generateTypesContent(result.services, requirePath);
		const outputDir = path.dirname(outputAbsPath);
		fs.mkdirSync(outputDir, { recursive: true });
		const existing = fs.existsSync(outputAbsPath) ? fs.readFileSync(outputAbsPath, "utf-8") : "";
		if (existing !== content) {
			const outputUri = vscode.Uri.file(outputAbsPath);
			await vscode.workspace.fs.writeFile(outputUri, Buffer.from(content, "utf-8"));
		}

		// Update completions + diagnostics
		lastParsedServices = result.services;
		updateKnownServices(result.services);
		updateDiagnostics(result);

		// Status bar
		if (result.warnings.length > 0) {
			statusBarItem.text = "$(warning) KirNet Types";
			statusBarItem.tooltip = `${result.warnings.length} warning(s) — click to view`;
		} else {
			statusBarItem.text = "$(check) KirNet Types";
			const mode = resolvedEntry ? `injected (${resolvedEntry.kind})` : "standalone";
			statusBarItem.tooltip = `${result.services.length} service(s) — ${mode}`;
		}

		logger.log("Generation complete");
	} catch (e: any) {
		logger.error(`Generation failed: ${e.message}\n${e.stack ?? ""}`);
		statusBarItem.text = "$(error) KirNet Types";
		statusBarItem.tooltip = "Generation failed — click to view";
	}
}

function updateDiagnostics(result: ParseResult): void {
	diagnosticCollection.clear();

	const byFile = new Map<string, vscode.Diagnostic[]>();

	for (const w of result.warnings) {
		const uri = w.filePath;
		if (!byFile.has(uri)) {
			byFile.set(uri, []);
		}
		const line = Math.max(0, w.line - 1);
		const diag = new vscode.Diagnostic(
			new vscode.Range(line, 0, line, 1000),
			w.message,
			vscode.DiagnosticSeverity.Warning,
		);
		diag.source = "KirNet";
		byFile.get(uri)!.push(diag);
	}

	for (const [filePath, diags] of byFile) {
		diagnosticCollection.set(vscode.Uri.file(filePath), diags);
	}
}

// ────────────────────────────────────────────────────────────────
// Commands
// ────────────────────────────────────────────────────────────────

async function listServicesCommand(): Promise<void> {
	if (lastParsedServices.length === 0) {
		vscode.window.showInformationMessage("No services detected yet.");
		return;
	}

	const items = lastParsedServices.map((svc) => ({
		label: `$(symbol-class) ${svc.name}`,
		description: "service",
		detail: svc.fields.map((f) => `${f.name}: ${f.type}`).join(", "),
	}));

	await vscode.window.showQuickPick(items, {
		title: "KirNet Services",
		placeHolder: "Browse registered services",
	});
}

async function goToServiceCommand(): Promise<void> {
	if (lastParsedServices.length === 0) {
		vscode.window.showInformationMessage("No services detected yet.");
		return;
	}

	const items = lastParsedServices.map((svc) => ({
		label: svc.name,
		description: `service — ${path.relative(workspaceRoot, svc.filePath)}`,
		filePath: svc.filePath,
	}));

	const picked = await vscode.window.showQuickPick(items, {
		title: "Jump to Service Definition",
		placeHolder: "Select a service to open",
	});

	if (picked) {
		const doc = await vscode.workspace.openTextDocument(picked.filePath);
		const text = doc.getText();
		const registerPattern = new RegExp(
			`RegisterService\\s*\\(\\s*["']${picked.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`,
		);
		const match = registerPattern.exec(text);
		const pos = match ? doc.positionAt(match.index) : new vscode.Position(0, 0);
		await vscode.window.showTextDocument(doc, {
			selection: new vscode.Range(pos, pos),
		});
	}
}

async function restorePackageCommand(): Promise<void> {
	if (!resolvedEntry) {
		vscode.window.showWarningMessage("No KirNet package injection found to restore.");
		return;
	}

	if (resolvedEntry.kind === "source") {
		const backupPath = path.join(path.dirname(resolvedEntry.entryFile), "_KirNetImpl.luau");
		if (!fs.existsSync(backupPath)) {
			vscode.window.showWarningMessage("Backup file _KirNetImpl.luau not found — cannot restore.");
			return;
		}
		const confirm = await vscode.window.showWarningMessage(
			"Restore original KirNet init.luau from backup? This will remove typed overloads.",
			"Restore",
			"Cancel",
		);
		if (confirm !== "Restore") {
			return;
		}
		fs.copyFileSync(backupPath, resolvedEntry.entryFile);
		fs.unlinkSync(backupPath);
		resolvedEntry = null;
		logger.log("Restored original KirNet package from backup.");
		vscode.window.showInformationMessage("KirNet package restored to original.");
	} else {
		// Proxy — restore the simple return require(...) line
		const confirm = await vscode.window.showWarningMessage(
			"Restore original KirNet proxy file? This will remove typed overloads.",
			"Restore",
			"Cancel",
		);
		if (confirm !== "Restore") {
			return;
		}
		const content = `return require(${resolvedEntry.requireExpr})\n`;
		fs.writeFileSync(resolvedEntry.entryFile, content, "utf-8");
		resolvedEntry = null;
		logger.log("Restored original KirNet proxy file.");
		vscode.window.showInformationMessage("KirNet proxy file restored to original.");
	}
}

async function scaffoldCommand(): Promise<void> {
	const dir = path.resolve(workspaceRoot, config.paths.services);

	const name = await vscode.window.showInputBox({
		title: "New KirNet Service",
		prompt: "Enter the service name (e.g. CombatService)",
		validateInput: (value) => {
			if (!value || !/^[A-Z]\w*$/.test(value)) {
				return "Name must start with an uppercase letter and contain only word characters";
			}
			return undefined;
		},
	});

	if (!name) {
		return;
	}

	const filePath = path.join(dir, `${name}.luau`);
	if (fs.existsSync(filePath)) {
		vscode.window.showWarningMessage(`File already exists: ${path.relative(workspaceRoot, filePath)}`);
		return;
	}

	const content = [
		"--!strict",
		"",
		`local KirNet = require(game:GetService("ReplicatedStorage").Shared.Packages.kirnet)`,
		"",
		`KirNet.RegisterService("${name}", {`,
		"\tExampleBroadcast = KirNet.CreateServerSignal() :: KirNet.ServerSignal<string>,",
		"\tExampleEvent = KirNet.CreateClientSignal() :: KirNet.ClientSignal<string>,",
		"})",
		"",
	].join("\n");

	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(filePath, content, "utf-8");
	const doc = await vscode.workspace.openTextDocument(filePath);
	await vscode.window.showTextDocument(doc);
	logger.log(`Created service: ${path.relative(workspaceRoot, filePath)}`);
}

export function deactivate(): void {
	logger.dispose();
}
