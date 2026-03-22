"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const config_1 = require("./config");
const logger = __importStar(require("./logger"));
const parser_1 = require("./parser");
const generator_1 = require("./generator");
const completions_1 = require("./completions");
const watcher_1 = require("./watcher");
let config;
let workspaceRoot;
let statusBarItem;
let diagnosticCollection;
function activate(context) {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
        return;
    }
    workspaceRoot = folders[0].uri.fsPath;
    // Only activate if default.project.json exists
    if (!fs.existsSync(path.join(workspaceRoot, "default.project.json"))) {
        return;
    }
    config = (0, config_1.readConfig)(workspaceRoot);
    logger.log("KirNet Type Generator activated");
    // Status bar
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = "kirnet.showOutput";
    statusBarItem.text = "$(sync~spin) KirNet Types";
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);
    // Diagnostics
    diagnosticCollection = vscode.languages.createDiagnosticCollection("kirnet");
    context.subscriptions.push(diagnosticCollection);
    // Register completion provider
    (0, completions_1.registerCompletionProvider)(context);
    // Register commands
    context.subscriptions.push(vscode.commands.registerCommand("kirnet.regenerateTypes", () => {
        regenerate("command");
    }));
    context.subscriptions.push(vscode.commands.registerCommand("kirnet.showOutput", () => {
        logger.getChannel().show();
    }));
    context.subscriptions.push(vscode.commands.registerCommand("kirnet.openTypesFile", () => {
        const absPath = path.join(workspaceRoot, config.paths.output);
        if (fs.existsSync(absPath)) {
            vscode.window.showTextDocument(vscode.Uri.file(absPath));
        }
        else {
            vscode.window.showWarningMessage("Types.luau has not been generated yet.");
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand("kirnet.reloadConfig", () => {
        config = (0, config_1.readConfig)(workspaceRoot);
        logger.log("Config reloaded");
        regenerate("config reload");
    }));
    // Register save watcher
    const servicesAbsPath = path.resolve(workspaceRoot, config.paths.services);
    const controllersAbsPath = path.resolve(workspaceRoot, config.paths.controllers);
    context.subscriptions.push((0, watcher_1.createSaveHandler)((uri) => {
        regenerate(`saved: ${path.relative(workspaceRoot, uri.fsPath)}`);
    }, (uri) => {
        const filePath = uri.fsPath;
        return (filePath.startsWith(servicesAbsPath) ||
            filePath.startsWith(controllersAbsPath));
    }));
    // Initial generation
    regenerate("session start");
}
function regenerate(trigger) {
    statusBarItem.text = "$(sync~spin) KirNet Types";
    logger.log(`--- Regenerating (trigger: ${trigger}) ---`);
    try {
        const result = (0, parser_1.parseAll)(workspaceRoot, [config.paths.services, config.paths.controllers], config.options.debug);
        logger.log(`Found ${result.services.length} service(s)/controller(s)`);
        logger.log(`Output: ${config.paths.output}`);
        // Log warnings
        for (const w of result.warnings) {
            logger.warn(`${path.relative(workspaceRoot, w.filePath)}:${w.line} — ${w.message}`);
        }
        // Generate and write
        const content = (0, generator_1.generateTypesContent)(result.services, config.options.kirnet_require_path);
        (0, generator_1.writeTypesFile)(workspaceRoot, config.paths.output, content);
        // Update completions
        (0, completions_1.updateKnownServices)(result.services);
        // Update diagnostics
        updateDiagnostics(result);
        // Update status bar
        if (result.warnings.length > 0) {
            statusBarItem.text = "$(warning) KirNet Types";
            statusBarItem.tooltip = `${result.warnings.length} warning(s) — click to view`;
        }
        else {
            statusBarItem.text = "$(check) KirNet Types";
            statusBarItem.tooltip = `${result.services.length} service(s) — up to date`;
        }
        logger.log("Generation complete");
    }
    catch (e) {
        logger.error(`Generation failed: ${e.message}`);
        statusBarItem.text = "$(error) KirNet Types";
        statusBarItem.tooltip = "Generation failed — click to view";
    }
}
function updateDiagnostics(result) {
    diagnosticCollection.clear();
    const byFile = new Map();
    for (const w of result.warnings) {
        if (!w.message.includes("Could not parse this entry")) {
            continue;
        }
        const uri = w.filePath;
        if (!byFile.has(uri)) {
            byFile.set(uri, []);
        }
        const line = Math.max(0, w.line - 1); // 0-indexed
        const diag = new vscode.Diagnostic(new vscode.Range(line, 0, line, 1000), w.message, vscode.DiagnosticSeverity.Warning);
        diag.source = "KirNet";
        byFile.get(uri).push(diag);
    }
    for (const [filePath, diags] of byFile) {
        diagnosticCollection.set(vscode.Uri.file(filePath), diags);
    }
}
function deactivate() {
    logger.dispose();
}
//# sourceMappingURL=extension.js.map