import { ServiceDef } from "./parser";
/**
 * Generate the Types.luau content from parsed service definitions.
 */
export declare function generateTypesContent(services: ServiceDef[], requirePath: string): string;
/**
 * Write the generated Types.luau to disk.
 */
export declare function writeTypesFile(workspaceRoot: string, outputPath: string, content: string): void;
