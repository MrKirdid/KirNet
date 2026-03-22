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
