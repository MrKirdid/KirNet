import * as vscode from "vscode";
import { ServiceDef } from "./parser";
export declare function updateKnownServices(services: ServiceDef[]): void;
export declare function createCompletionProvider(): vscode.CompletionItemProvider;
export declare function registerCompletionProvider(context: vscode.ExtensionContext): void;
