import * as vscode from "vscode";

let channel: vscode.OutputChannel | undefined;

export function getChannel(): vscode.OutputChannel {
	if (!channel) {
		channel = vscode.window.createOutputChannel("KirNet Type Generator");
	}
	return channel;
}

export function log(message: string): void {
	const ts = new Date().toISOString();
	getChannel().appendLine(`[${ts}] ${message}`);
}

export function warn(message: string): void {
	log(`⚠ ${message}`);
}

export function error(message: string): void {
	log(`✖ ${message}`);
}

export function debug(message: string, isDebug: boolean): void {
	if (isDebug) {
		log(`[DEBUG] ${message}`);
	}
}

export function dispose(): void {
	channel?.dispose();
	channel = undefined;
}
