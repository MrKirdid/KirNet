import * as fs from "fs";
import * as path from "path";
import * as logger from "./logger";

/**
 * Detect the variable name used for KirNet in a file.
 * Scans for `local X = require(...)` where the path contains "kirnet" (case-insensitive).
 */
function detectKirNetVar(content: string): string {
	const match = content.match(/local\s+(\w+)\s*=\s*require\s*\([^)]*kirnet[^)]*\)/i);
	return match ? match[1] : "KirNet";
}

function escapeForRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Strip trailing inline comment (-- ...) from a line,
 * respecting string literals so `--` inside strings is preserved.
 */
function stripInlineComment(line: string): string {
	let inString: string | null = null;
	for (let i = 0; i < line.length; i++) {
		const ch = line[i];
		if (inString) {
			if (ch === "\\") {
				i++;
				continue;
			}
			if (ch === inString) {
				inString = null;
			}
		} else {
			if (ch === '"' || ch === "'") {
				inString = ch;
			} else if (ch === "-" && i + 1 < line.length && line[i + 1] === "-") {
				return line.substring(0, i).trimEnd();
			}
		}
	}
	return line;
}

export interface FieldDef {
	name: string;
	type: string;
}

export interface ServiceDef {
	name: string;
	fields: FieldDef[];
	filePath: string;
	kind: "service" | "controller";
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
export function parseAll(
	workspaceRoot: string,
	servicePaths: string[],
	isDebug: boolean,
): ParseResult {
	const allServices: ServiceDef[] = [];
	const allWarnings: ParseWarning[] = [];

	// Deduplicate scan paths (e.g. both default to "src")
	const uniquePaths = [...new Set(servicePaths)];

	for (const rel of uniquePaths) {
		const dir = path.join(workspaceRoot, rel);
		if (!fs.existsSync(dir)) {
			continue;
		}
		const files = collectLuauFiles(dir);
		for (const filePath of files) {
			try {
				const content = fs.readFileSync(filePath, "utf-8");
				const result = parseFile(content, filePath, isDebug);
				allServices.push(...result.services);
				allWarnings.push(...result.warnings);
			} catch (e: any) {
				logger.error(`Failed to parse ${filePath}: ${e.message}`);
			}
		}
	}

	return { services: allServices, warnings: allWarnings };
}

function collectLuauFiles(dir: string): string[] {
	const results: string[] = [];
	try {
		const entries = fs.readdirSync(dir, { withFileTypes: true });
		for (const entry of entries) {
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				results.push(...collectLuauFiles(full));
			} else if (/\.luau?$/.test(entry.name)) {
				results.push(full);
			}
		}
	} catch {
		// skip unreadable dirs
	}
	return results;
}

/**
 * Parse a single file for RegisterService / RegisterController calls.
 */
export function parseFile(
	content: string,
	filePath: string,
	isDebug: boolean,
): ParseResult {
	const services: ServiceDef[] = [];
	const warnings: ParseWarning[] = [];

	// Detect the variable name used for KirNet (e.g. KirNet, Kirnet, kirnet)
	const kirnetVar = detectKirNetVar(content);

	// Match VarName.RegisterService("Name", { ... }) and VarName.RegisterController("Name", { ... })
	const registerPattern = new RegExp(
		`${escapeForRegex(kirnetVar)}\\s*\\.\\s*(RegisterService|RegisterController)\\s*\\(\\s*["']([^"']+)["']\\s*,\\s*\\{`,
		"g",
	);

	let match: RegExpExecArray | null;
	while ((match = registerPattern.exec(content)) !== null) {
		const kind: "service" | "controller" = match[1] === "RegisterService" ? "service" : "controller";
		const serviceName = match[2];
		const braceStart = match.index + match[0].length - 1; // points at the {

		try {
			const tableBody = extractTableBody(content, braceStart);
			if (tableBody === null) {
				warnings.push({
					filePath,
					line: lineAt(content, match.index),
					message: `Could not find matching closing brace for ${serviceName} definition`,
				});
				continue;
			}

			const fields = parseDefinitionTable(
				tableBody.text,
				serviceName,
				filePath,
				tableBody.startOffset,
				content,
				warnings,
				isDebug,
				kirnetVar,
			);

			services.push({ name: serviceName, fields, filePath, kind });

			if (isDebug) {
				logger.debug(
					`Parsed ${serviceName}: ${fields.map((f) => `${f.name}: ${f.type}`).join(", ")}`,
					true,
				);
			}
		} catch (e: any) {
			warnings.push({
				filePath,
				line: lineAt(content, match.index),
				message: `Error parsing ${serviceName}: ${e.message}`,
			});
		}
	}

	return { services, warnings };
}

interface TableBodyResult {
	text: string;
	startOffset: number; // offset in original content where the body text starts
}

/**
 * Given an opening `{` at position `bracePos`, extract the inner text
 * up to the matching `}`, handling nested braces.
 */
function extractTableBody(content: string, bracePos: number): TableBodyResult | null {
	let depth = 0;
	for (let i = bracePos; i < content.length; i++) {
		const ch = content[i];
		if (ch === "{") {
			depth++;
		} else if (ch === "}") {
			depth--;
			if (depth === 0) {
				const bodyStart = bracePos + 1;
				return {
					text: content.slice(bodyStart, i),
					startOffset: bodyStart,
				};
			}
		} else if (ch === "-" && content[i + 1] === "-") {
			// Check for block comment: --[[ ... ]]  or --[=[ ... ]=] etc.
			if (content[i + 2] === "[") {
				const afterDashes = content.substring(i + 2);
				const blockOpenMatch = afterDashes.match(/^\[(=*)\[/);
				if (blockOpenMatch) {
					const eqs = blockOpenMatch[1];
					const closeTag = `]${eqs}]`;
					const closeIdx = content.indexOf(closeTag, i + 2 + blockOpenMatch[0].length);
					if (closeIdx === -1) break;
					i = closeIdx + closeTag.length - 1;
					continue;
				}
			}
			// line comment — skip to EOL
			const eol = content.indexOf("\n", i);
			if (eol === -1) {
				break;
			}
			i = eol;
		} else if (ch === '"' || ch === "'") {
			// skip string literals
			i = skipString(content, i, ch);
		} else if (ch === "[" && (content[i + 1] === "[" || content[i + 1] === "=")) {
			const afterBracket = content.substring(i);
			const longStringMatch = afterBracket.match(/^\[(=*)\[/);
			if (longStringMatch) {
				const eqs = longStringMatch[1];
				const closeTag = `]${eqs}]`;
				const closeIdx = content.indexOf(closeTag, i + longStringMatch[0].length);
				if (closeIdx === -1) break;
				i = closeIdx + closeTag.length - 1;
			}
		}
	}
	return null;
}

function skipString(content: string, start: number, quote: string): number {
	for (let i = start + 1; i < content.length; i++) {
		if (content[i] === "\\") {
			i++; // skip escaped char
		} else if (content[i] === quote) {
			return i;
		}
	}
	return content.length - 1;
}

/**
 * Find the closing `)` that matches the `(` at openPos,
 * handling nesting, strings, and comments.
 */
function findMatchingParen(content: string, openPos: number): number {
	let depth = 0;
	for (let i = openPos; i < content.length; i++) {
		const ch = content[i];
		if (ch === "(") {
			depth++;
		} else if (ch === ")") {
			depth--;
			if (depth === 0) return i;
		} else if (ch === '"' || ch === "'") {
			i = skipString(content, i, ch);
		} else if (ch === "-" && content[i + 1] === "-") {
			// Check for block comment: --[[ ... ]]  or --[=[ ... ]=] etc.
			if (content[i + 2] === "[") {
				const afterDashes = content.substring(i + 2);
				const blockOpenMatch = afterDashes.match(/^\[(=*)\[/);
				if (blockOpenMatch) {
					const eqs = blockOpenMatch[1];
					const closeTag = `]${eqs}]`;
					const closeIdx = content.indexOf(closeTag, i + 2 + blockOpenMatch[0].length);
					if (closeIdx === -1) break;
					i = closeIdx + closeTag.length - 1;
					continue;
				}
			}
			// line comment — skip to EOL
			const eol = content.indexOf("\n", i);
			if (eol === -1) break;
			i = eol;
		} else if (ch === "[" && (content[i + 1] === "[" || content[i + 1] === "=")) {
			const afterBracket = content.substring(i);
			const longStringMatch = afterBracket.match(/^\[(=*)\[/);
			if (longStringMatch) {
				const eqs = longStringMatch[1];
				const closeTag = `]${eqs}]`;
				const closeIdx = content.indexOf(closeTag, i + longStringMatch[0].length);
				if (closeIdx === -1) break;
				i = closeIdx + closeTag.length - 1;
			}
		}
	}
	return -1;
}

/**
 * Find the closing `>` that matches the `<` at openPos,
 * handling nested angle brackets.
 */
function findMatchingAngle(content: string, openPos: number): number {
	let depth = 0;
	for (let i = openPos; i < content.length; i++) {
		const ch = content[i];
		if (ch === "<") depth++;
		else if (ch === ">") {
			depth--;
			if (depth === 0) return i;
		}
	}
	return -1;
}

/**
 * Parse out the key = value entries from within a definition table body.
 * Supports nested sub-tables (e.g. Client = { ... }), bare functions, and
 * multi-line function bodies.
 */
function parseDefinitionTable(
	tableBody: string,
	serviceName: string,
	filePath: string,
	bodyOffset: number,
	fullContent: string,
	warnings: ParseWarning[],
	isDebug: boolean,
	kirnetVar: string,
): FieldDef[] {
	const fields: FieldDef[] = [];
	const v = escapeForRegex(kirnetVar);
	const lines = tableBody.split("\n");
	let lineOffset = 0;
	let i = 0;

	while (i < lines.length) {
		const line = lines[i];
		const trimmed = stripInlineComment(line.trim());

		// Skip empty/comment lines
		if (!trimmed) {
			lineOffset += line.length + 1;
			i++;
			continue;
		}

		// ── CreateSignal: check fullContent-based first (handles multi-line + single-line) ──
		const createSignalStart = trimmed.match(
			new RegExp(`^(\\w+)\\s*=\\s*${v}\\s*\\.\\s*CreateSignal\\s*\\(`),
		);
		if (createSignalStart) {
			const fieldName = createSignalStart[1];
			const absOffset = bodyOffset + lineOffset;
			const csIdx = fullContent.indexOf("CreateSignal", absOffset);
			if (csIdx !== -1) {
				const parenOpen = fullContent.indexOf("(", csIdx);
				if (parenOpen !== -1) {
					const parenClose = findMatchingParen(fullContent, parenOpen);
					if (parenClose !== -1) {
						const afterParen = fullContent.substring(parenClose + 1);
						const castMatch = afterParen.match(
							new RegExp(`^[\\s\\n]*::[\\s\\n]*(?:${v}[\\s\\n]*\\.[\\s\\n]*)?Signal[\\s\\n]*<`),
						);

						let signalField: FieldDef;
						let exprEnd: number;

						if (castMatch) {
							const angleOpen = parenClose + 1 + castMatch[0].length - 1;
							const angleClose = findMatchingAngle(fullContent, angleOpen);
							if (angleClose !== -1) {
								const typeArgs = fullContent
									.substring(angleOpen + 1, angleClose)
									.replace(/[\s\n]+/g, " ")
									.trim();
								signalField = { name: fieldName, type: `Signal<${typeArgs}>` };
								exprEnd = angleClose + 1;
							} else {
								signalField = { name: fieldName, type: "Signal<any>" };
								exprEnd = parenClose + 1;
							}
						} else {
							signalField = { name: fieldName, type: "Signal<any>" };
							const absLine = lineAt(fullContent, absOffset);
							warnings.push({
								filePath,
								line: absLine,
								message: `[KirNet] ${serviceName}.${fieldName} is untyped — add :: ${kirnetVar}.Signal<T>`,
							});
							exprEnd = parenClose + 1;
						}

						fields.push(signalField);
						if (isDebug) {
							logger.debug(`  ${serviceName}.${signalField.name} → ${signalField.type}`, true);
						}

						while (i < lines.length && bodyOffset + lineOffset < exprEnd) {
							lineOffset += lines[i].length + 1;
							i++;
						}
						continue;
					}
				}
			}
		}

		// ── CreateFunction: check fullContent-based (handles multi-line) ──
		const createFuncStart = trimmed.match(
			new RegExp(`^(\\w+)\\s*=\\s*${v}\\s*\\.\\s*CreateFunction\\s*\\(`),
		);
		if (createFuncStart) {
			const fieldName = createFuncStart[1];
			const absOffset = bodyOffset + lineOffset;
			const cfIdx = fullContent.indexOf("CreateFunction", absOffset);
			if (cfIdx !== -1) {
				const outerParenOpen = fullContent.indexOf("(", cfIdx);
				if (outerParenOpen !== -1) {
					const outerParenClose = findMatchingParen(fullContent, outerParenOpen);
					if (outerParenClose !== -1) {
						// Inside CreateFunction(...) find the function(params) signature
						const inner = fullContent.substring(outerParenOpen + 1, outerParenClose);
						const funcSigMatch = inner.match(/function\s*\(([^)]*)\)/);
						if (funcSigMatch) {
							// Find return type: last ): ... before the function body
							const sigEnd = inner.indexOf(")", inner.indexOf("function"));
							const afterSig = inner.substring(sigEnd + 1);
							const retMatch = afterSig.match(/^\s*:\s*([^\n]+)/);
							let funcField: FieldDef;
							if (retMatch) {
								const returnType = retMatch[1].replace(/\s*,?\s*$/, "").trim();
								funcField = { name: fieldName, type: `Function<${returnType}>` };
							} else {
								const absLine = lineAt(fullContent, absOffset);
								warnings.push({
									filePath,
									line: absLine,
									message: `[KirNet] ${serviceName}.${fieldName} has no return type annotation`,
								});
								funcField = { name: fieldName, type: "Function<any>" };
							}
							fields.push(funcField);
							if (isDebug) {
								logger.debug(`  ${serviceName}.${funcField.name} → ${funcField.type}`, true);
							}

							// Skip past the full expression in the line array
							const exprEnd = outerParenClose + 1;
							while (i < lines.length && bodyOffset + lineOffset < exprEnd) {
								lineOffset += lines[i].length + 1;
								i++;
							}
							continue;
						}
					}
				}
			}
		}

		// ── Single-line field matching (type annotations, misc) ──
		const field = tryParseField(trimmed, serviceName, filePath, bodyOffset + lineOffset, fullContent, warnings, kirnetVar);
		if (field) {
			fields.push(field);
			if (isDebug) {
				logger.debug(`  ${serviceName}.${field.name} → ${field.type}`, true);
			}
			// If this line starts a multi-line function, skip to the matching end
			if (/\bfunction\s*\(/.test(trimmed) && !/\bend\b/.test(trimmed)) {
				const endIdx = skipToMatchingEnd(lines, i);
				for (let j = i + 1; j <= endIdx; j++) {
					lineOffset += lines[j].length + 1;
				}
			}
			lineOffset += line.length + 1;
			i = (/\bfunction\s*\(/.test(trimmed) && !/\bend\b/.test(trimmed))
				? skipToMatchingEnd(lines, i) + 1
				: i + 1;
			continue;
		}

		// Check for bare function: Name = function(...)
		const bareFuncMatch = trimmed.match(
			/^(\w+)\s*=\s*function\s*\(([^)]*)\)\s*(?::\s*(.+?))?$/,
		);
		if (bareFuncMatch) {
			const funcField = parseBareFunction(
				bareFuncMatch[1],
				bareFuncMatch[2],
				bareFuncMatch[3],
				serviceName,
				filePath,
				bodyOffset + lineOffset,
				fullContent,
				warnings,
			);
			if (funcField) {
				fields.push(funcField);
				if (isDebug) {
					logger.debug(`  ${serviceName}.${funcField.name} → ${funcField.type}`, true);
				}
			}
			// Skip past the function body to the matching `end`
			const endIdx = skipToMatchingEnd(lines, i);
			for (let j = i; j <= endIdx; j++) {
				lineOffset += lines[j].length + 1;
			}
			i = endIdx + 1;
			continue;
		}

		// Check for nested sub-table: Key = {
		const nestedTableMatch = trimmed.match(/^(\w+)\s*=\s*\{/);
		if (nestedTableMatch) {
			// Find the { in the full content and extract the matching body
			const absBracePos = bodyOffset + lineOffset + line.indexOf("{");
			const nested = extractTableBody(fullContent, absBracePos);
			if (nested) {
				const nestedFields = parseDefinitionTable(
					nested.text,
					serviceName,
					filePath,
					nested.startOffset,
					fullContent,
					warnings,
					isDebug,
					kirnetVar,
				);
				fields.push(...nestedFields);
				// Skip past the closing } of the nested table
				const closingBracePos = nested.startOffset + nested.text.length;
				while (i < lines.length) {
					lineOffset += lines[i].length + 1;
					i++;
					if (bodyOffset + lineOffset > closingBracePos) {
						break;
					}
				}
				continue;
			}
		}

		// Unrecognized line
		lineOffset += line.length + 1;
		i++;
	}

	return fields;
}

/**
 * Parse a bare `function(params): ReturnType` style field.
 */
function parseBareFunction(
	name: string,
	paramsRaw: string,
	returnTypeRaw: string | undefined,
	serviceName: string,
	filePath: string,
	offsetInContent: number,
	fullContent: string,
	warnings: ParseWarning[],
): FieldDef | null {
	if (!returnTypeRaw) {
		const absLine = lineAt(fullContent, offsetInContent);
		warnings.push({
			filePath,
			line: absLine,
			message: `[KirNet] ${serviceName}.${name} has no return type annotation`,
		});
		return { name, type: "Function<any>" };
	}

	const returnType = returnTypeRaw.replace(/\s*,?\s*$/, "").trim();
	return { name, type: `Function<${returnType}>` };
}

/**
 * Skip lines from startLine until the matching `end` for a `function`.
 * Tracks nesting of function/if/for/while blocks.
 */
function skipToMatchingEnd(lines: string[], startLine: number): number {
	let depth = 0;
	let inBlockComment = false;
	let blockCloseTag = "]]";
	for (let i = startLine; i < lines.length; i++) {
		let line = lines[i];
		if (inBlockComment) {
			const closeIdx = line.indexOf(blockCloseTag);
			if (closeIdx === -1) continue;
			line = line.substring(closeIdx + blockCloseTag.length);
			inBlockComment = false;
		}
		// Strip block comments that start and end on this line, or start here
		line = line.replace(/--\[(=*)\[[\s\S]*?\]\1\]/g, "");
		const blockStart = line.match(/--\[(=*)\[/);
		if (blockStart) {
			line = line.substring(0, blockStart.index);
			inBlockComment = true;
			blockCloseTag = `]${blockStart[1]}]`;
		}
		// Strip line comments
		const stripped = line.replace(/--.*$/, "").trim();
		// Also strip string literals to avoid matching keywords in strings
		const noStrings = stripped.replace(/"[^"]*"|'[^']*'/g, "");
		const words = noStrings.split(/\W+/);
		for (const word of words) {
			if (word === "function" || word === "if" || word === "for" || word === "while") {
				depth++;
			} else if (word === "end") {
				depth--;
				if (depth <= 0) {
					return i;
				}
			} else if (word === "repeat") {
				depth++;
			} else if (word === "until") {
				depth--;
				if (depth <= 0) {
					return i;
				}
			}
		}
	}
	return lines.length - 1;
}

function tryParseField(
	line: string,
	serviceName: string,
	filePath: string,
	offsetInContent: number,
	fullContent: string,
	warnings: ParseWarning[],
	kirnetVar: string,
): FieldDef | null {
	const v = escapeForRegex(kirnetVar);

	// Case 1/2: Typed signal — KeyName = VarName.CreateSignal(...) :: [VarName.]Signal<T>
	const typedSignalMatch = line.match(
		new RegExp(`^(\\w+)\\s*=\\s*${v}\\s*\\.\\s*CreateSignal\\s*\\(.*?\\)\\s*::\\s*((?:${v}\\s*\\.\\s*)?Signal\\s*<(.+)>)\\s*,?\\s*$`),
	);
	if (typedSignalMatch) {
		const name = typedSignalMatch[1];
		const rawType = typedSignalMatch[2];
		// Normalize whitespace and strip module prefix so generated type uses local Signal<T>
		const type = rawType.replace(/\s+/g, " ").replace(new RegExp(`${v}\\s*\\.\\s*`, "g"), "").trim();
		return { name, type };
	}

	// Case 3: Untyped signal — KeyName = VarName.CreateSignal(...)
	const untypedSignalMatch = line.match(
		new RegExp(`^(\\w+)\\s*=\\s*${v}\\s*\\.\\s*CreateSignal\\s*\\(.*?\\)\\s*,?\\s*$`),
	);
	if (untypedSignalMatch) {
		const name = untypedSignalMatch[1];
		const absLine = lineAt(fullContent, offsetInContent);
		warnings.push({
			filePath,
			line: absLine,
			message: `[KirNet] ${serviceName}.${name} is untyped — add :: ${kirnetVar}.Signal<T>`,
		});
		return { name, type: "Signal<any>" };
	}

	// Case 4/5/6: Function — KeyName = VarName.CreateFunction(function(player: Player, ...) : ReturnType
	const funcMatch = line.match(
		new RegExp(`^(\\w+)\\s*=\\s*${v}\\s*\\.\\s*CreateFunction\\s*\\(\\s*function\\s*\\((.+?)\\)`),
	);
	if (funcMatch) {
		const name = funcMatch[1];

		// Look for return type annotation: everything after ): up to the newline
		const returnMatch = line.match(/\)\s*:\s*(.+?)$/);
		if (!returnMatch) {
			const absLine = lineAt(fullContent, offsetInContent);
			warnings.push({
				filePath,
				line: absLine,
				message: `[KirNet] ${serviceName}.${name} has no return type annotation`,
			});
			return { name, type: "Function<any>" };
		}

		const returnType = returnMatch[1].replace(/\s*,?\s*$/, "").trim();
		return { name, type: `Function<${returnType}>` };
	}

	// Case 7: Direct type annotation — KeyName: SomeType,
	const directTypeMatch = line.match(/^(\w+)\s*:\s*(.+?)\s*,?\s*$/);
	if (directTypeMatch) {
		const name = directTypeMatch[1];
		const type = directTypeMatch[2].trim();
		return { name, type };
	}

	// Not a recognizable entry
	return null;
}

function lineAt(content: string, offset: number): number {
	let line = 1;
	for (let i = 0; i < offset && i < content.length; i++) {
		if (content[i] === "\n") {
			line++;
		}
	}
	return line;
}
