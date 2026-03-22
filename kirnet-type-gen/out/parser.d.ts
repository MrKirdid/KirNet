export interface FieldDef {
    name: string;
    type: string;
}
export interface ServiceDef {
    name: string;
    fields: FieldDef[];
    filePath: string;
}
export interface ParseResult {
    services: ServiceDef[];
    warnings: ParseWarning[];
}
export interface ParseWarning {
    filePath: string;
    line: number;
    message: string;
}
/**
 * Scan all .luau/.lua files under the given directories and extract
 * KirNet.RegisterService / KirNet.RegisterController definitions.
 */
export declare function parseAll(workspaceRoot: string, servicePaths: string[], isDebug: boolean): ParseResult;
/**
 * Parse a single file for RegisterService / RegisterController calls.
 */
export declare function parseFile(content: string, filePath: string, isDebug: boolean): ParseResult;
