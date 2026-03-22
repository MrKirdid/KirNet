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
exports.updateKnownServices = updateKnownServices;
exports.createCompletionProvider = createCompletionProvider;
exports.registerCompletionProvider = registerCompletionProvider;
const vscode = __importStar(require("vscode"));
let knownServices = [];
function updateKnownServices(services) {
    knownServices = services;
}
function createCompletionProvider() {
    return {
        provideCompletionItems(document, position) {
            const lineText = document.lineAt(position).text;
            const textBeforeCursor = lineText.substring(0, position.character);
            // Check if we're inside a KirNet.GetService / KirNet:GetService string argument
            const pattern = /KirNet\s*[.:]\s*GetService\s*\(\s*["']([^"']*)$/;
            const match = textBeforeCursor.match(pattern);
            if (!match) {
                return undefined;
            }
            const query = match[1]; // partial string typed so far
            const quoteStartPos = position.character - query.length;
            // Build completion items
            const items = [];
            for (const svc of knownServices) {
                if (query && !fuzzyMatch(query, svc.name)) {
                    continue;
                }
                const item = new vscode.CompletionItem(svc.name, vscode.CompletionItemKind.Value);
                item.insertText = svc.name;
                // Replace from after the opening quote to just before the cursor
                const range = new vscode.Range(position.line, quoteStartPos, position.line, position.character);
                item.range = range;
                item.detail = "KirNet Service";
                const docLines = svc.fields.map((f) => `- \`${f.name}\`: \`${f.type}\``);
                item.documentation = new vscode.MarkdownString(`**${svc.name}**\n\n` + docLines.join("\n"));
                item.sortText = query
                    ? fuzzyScore(query, svc.name).toString().padStart(5, "0")
                    : svc.name;
                items.push(item);
            }
            return items;
        },
    };
}
function fuzzyMatch(query, candidate) {
    const q = query.toLowerCase();
    const c = candidate.toLowerCase();
    let qi = 0;
    for (let ci = 0; ci < c.length && qi < q.length; ci++) {
        if (c[ci] === q[qi]) {
            qi++;
        }
    }
    return qi === q.length;
}
/**
 * Score a fuzzy match — lower is better.
 * Counts consecutive character matches; more consecutive = lower score.
 */
function fuzzyScore(query, candidate) {
    const q = query.toLowerCase();
    const c = candidate.toLowerCase();
    let qi = 0;
    let consecutive = 0;
    let maxConsecutive = 0;
    for (let ci = 0; ci < c.length && qi < q.length; ci++) {
        if (c[ci] === q[qi]) {
            qi++;
            consecutive++;
            maxConsecutive = Math.max(maxConsecutive, consecutive);
        }
        else {
            consecutive = 0;
        }
    }
    // Invert so higher consecutive = lower score = sorted first
    return 1000 - maxConsecutive * 100 + candidate.length;
}
function registerCompletionProvider(context) {
    const provider = createCompletionProvider();
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider([{ language: "lua" }, { language: "luau" }], provider, '"', "'"));
}
//# sourceMappingURL=completions.js.map