import * as vscode from "vscode";
import { ServiceDef } from "./parser";

let knownServices: ServiceDef[] = [];

export function updateKnownServices(services: ServiceDef[]): void {
	knownServices = services;
}

export function createCompletionProvider(): vscode.CompletionItemProvider {
	return {
		provideCompletionItems(
			document: vscode.TextDocument,
			position: vscode.Position,
		): vscode.CompletionItem[] | undefined {
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
			const items: vscode.CompletionItem[] = [];

			for (const svc of knownServices) {
				if (query && !fuzzyMatch(query, svc.name)) {
					continue;
				}

				const item = new vscode.CompletionItem(
					svc.name,
					vscode.CompletionItemKind.Value,
				);

				item.insertText = svc.name;

				// Replace from after the opening quote to just before the cursor
				const range = new vscode.Range(
					position.line,
					quoteStartPos,
					position.line,
					position.character,
				);
				item.range = range;

				item.detail = `KirNet Service`;

				const docLines = svc.fields.map(
					(f) => `- \`${f.name}\`: \`${f.type}\``,
				);
				item.documentation = new vscode.MarkdownString(
					`**${svc.name}**\n\n` + docLines.join("\n"),
				);

				item.sortText = query
					? fuzzyScore(query, svc.name).toString().padStart(5, "0")
					: svc.name;

				items.push(item);
			}

			return items;
		},
	};
}

function fuzzyMatch(query: string, candidate: string): boolean {
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
function fuzzyScore(query: string, candidate: string): number {
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
		} else {
			consecutive = 0;
		}
	}

	// Invert so higher consecutive = lower score = sorted first
	return 1000 - maxConsecutive * 100 + candidate.length;
}

export function registerCompletionProvider(
	context: vscode.ExtensionContext,
): void {
	const provider = createCompletionProvider();
	context.subscriptions.push(
		vscode.languages.registerCompletionItemProvider(
			[{ language: "lua" }, { language: "luau" }],
			provider,
			'"',
			"'",
		),
	);
}
