import * as vscode from "vscode";
export declare function getChannel(): vscode.OutputChannel;
export declare function log(message: string): void;
export declare function warn(message: string): void;
export declare function error(message: string): void;
export declare function debug(message: string, isDebug: boolean): void;
export declare function dispose(): void;
