import * as vscode from "vscode";
export declare function createSaveHandler(onTrigger: (uri: vscode.Uri) => void, isInScope: (uri: vscode.Uri) => boolean): vscode.Disposable;
