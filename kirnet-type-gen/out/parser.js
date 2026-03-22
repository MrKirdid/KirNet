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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseAll = parseAll;
exports.parseFile = parseFile;
var fs = __importStar(require("fs"));
var path = __importStar(require("path"));
var logger = __importStar(require("./logger"));
/**
 * Detect the variable name used for KirNet in a file.
 * Scans for `local X = require(...)` where the path contains "kirnet" (case-insensitive).
 */
function detectKirNetVar(content) {
    var match = content.match(/local\s+(\w+)\s*=\s*require\s*\([^)]*kirnet[^)]*\)/i);
    return match ? match[1] : "KirNet";
}
function escapeForRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
/**
 * Strip trailing inline comment (-- ...) from a line,
 * respecting string literals so `--` inside strings is preserved.
 */
function stripInlineComment(line) {
    var inString = null;
    for (var i = 0; i < line.length; i++) {
        var ch = line[i];
        if (inString) {
            if (ch === "\\") {
                i++;
                continue;
            }
            if (ch === inString) {
                inString = null;
            }
        }
        else {
            if (ch === '"' || ch === "'") {
                inString = ch;
            }
            else if (ch === "-" && i + 1 < line.length && line[i + 1] === "-") {
                return line.substring(0, i).trimEnd();
            }
        }
    }
    return line;
}
/**
 * Scan all .luau/.lua files under the given directories and extract
 * KirNet.RegisterService / KirNet.RegisterController definitions.
 */
function parseAll(workspaceRoot, servicePaths, isDebug) {
    var allServices = [];
    var allWarnings = [];
    // Deduplicate scan paths (e.g. both default to "src")
    var uniquePaths = __spreadArray([], new Set(servicePaths), true);
    for (var _i = 0, uniquePaths_1 = uniquePaths; _i < uniquePaths_1.length; _i++) {
        var rel = uniquePaths_1[_i];
        var dir = path.join(workspaceRoot, rel);
        if (!fs.existsSync(dir)) {
            continue;
        }
        var files = collectLuauFiles(dir);
        for (var _a = 0, files_1 = files; _a < files_1.length; _a++) {
            var filePath = files_1[_a];
            try {
                var content = fs.readFileSync(filePath, "utf-8");
                var result = parseFile(content, filePath, isDebug);
                allServices.push.apply(allServices, result.services);
                allWarnings.push.apply(allWarnings, result.warnings);
            }
            catch (e) {
                logger.error("Failed to parse ".concat(filePath, ": ").concat(e.message));
            }
        }
    }
    return { services: allServices, warnings: allWarnings };
}
function collectLuauFiles(dir) {
    var results = [];
    try {
        var entries = fs.readdirSync(dir, { withFileTypes: true });
        for (var _i = 0, entries_1 = entries; _i < entries_1.length; _i++) {
            var entry = entries_1[_i];
            var full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                results.push.apply(results, collectLuauFiles(full));
            }
            else if (/\.luau?$/.test(entry.name)) {
                results.push(full);
            }
        }
    }
    catch (_a) {
        // skip unreadable dirs
    }
    return results;
}
/**
 * Parse a single file for RegisterService / RegisterController calls.
 */
function parseFile(content, filePath, isDebug) {
    var services = [];
    var warnings = [];
    // Detect the variable name used for KirNet (e.g. KirNet, Kirnet, kirnet)
    var kirnetVar = detectKirNetVar(content);
    // Match VarName.RegisterService("Name", { ... }) and VarName.RegisterController("Name", { ... })
    var registerPattern = new RegExp("".concat(escapeForRegex(kirnetVar), "\\s*\\.\\s*(?:RegisterService|RegisterController)\\s*\\(\\s*[\"']([^\"']+)[\"']\\s*,\\s*\\{"), "g");
    var match;
    while ((match = registerPattern.exec(content)) !== null) {
        var serviceName = match[1];
        var braceStart = match.index + match[0].length - 1; // points at the {
        try {
            var tableBody = extractTableBody(content, braceStart);
            if (tableBody === null) {
                warnings.push({
                    filePath: filePath,
                    line: lineAt(content, match.index),
                    message: "Could not find matching closing brace for ".concat(serviceName, " definition"),
                });
                continue;
            }
            var fields = parseDefinitionTable(tableBody.text, serviceName, filePath, tableBody.startOffset, content, warnings, isDebug, kirnetVar);
            services.push({ name: serviceName, fields: fields, filePath: filePath });
            if (isDebug) {
                logger.debug("Parsed ".concat(serviceName, ": ").concat(fields.map(function (f) { return "".concat(f.name, ": ").concat(f.type); }).join(", ")), true);
            }
        }
        catch (e) {
            warnings.push({
                filePath: filePath,
                line: lineAt(content, match.index),
                message: "Error parsing ".concat(serviceName, ": ").concat(e.message),
            });
        }
    }
    return { services: services, warnings: warnings };
}
/**
 * Given an opening `{` at position `bracePos`, extract the inner text
 * up to the matching `}`, handling nested braces.
 */
function extractTableBody(content, bracePos) {
    var depth = 0;
    for (var i = bracePos; i < content.length; i++) {
        var ch = content[i];
        if (ch === "{") {
            depth++;
        }
        else if (ch === "}") {
            depth--;
            if (depth === 0) {
                var bodyStart = bracePos + 1;
                return {
                    text: content.slice(bodyStart, i),
                    startOffset: bodyStart,
                };
            }
        }
        else if (ch === "-" && content[i + 1] === "-") {
            // skip line comments
            var eol = content.indexOf("\n", i);
            if (eol === -1) {
                break;
            }
            i = eol;
        }
        else if (ch === '"' || ch === "'") {
            // skip string literals
            i = skipString(content, i, ch);
        }
        else if (ch === "[" && content[i + 1] === "[") {
            // skip multiline strings
            var end = content.indexOf("]]", i + 2);
            if (end === -1)
                break;
            i = end + 1;
        }
    }
    return null;
}
function skipString(content, start, quote) {
    for (var i = start + 1; i < content.length; i++) {
        if (content[i] === "\\") {
            i++; // skip escaped char
        }
        else if (content[i] === quote) {
            return i;
        }
    }
    return content.length - 1;
}
/**
 * Find the closing `)` that matches the `(` at openPos,
 * handling nesting, strings, and comments.
 */
function findMatchingParen(content, openPos) {
    var depth = 0;
    for (var i = openPos; i < content.length; i++) {
        var ch = content[i];
        if (ch === "(") {
            depth++;
        }
        else if (ch === ")") {
            depth--;
            if (depth === 0)
                return i;
        }
        else if (ch === '"' || ch === "'") {
            i = skipString(content, i, ch);
        }
        else if (ch === "-" && content[i + 1] === "-") {
            var eol = content.indexOf("\n", i);
            if (eol === -1)
                break;
            i = eol;
        }
        else if (ch === "[" && content[i + 1] === "[") {
            var end = content.indexOf("]]", i + 2);
            if (end === -1)
                break;
            i = end + 1;
        }
    }
    return -1;
}
/**
 * Find the closing `>` that matches the `<` at openPos,
 * handling nested angle brackets.
 */
function findMatchingAngle(content, openPos) {
    var depth = 0;
    for (var i = openPos; i < content.length; i++) {
        var ch = content[i];
        if (ch === "<")
            depth++;
        else if (ch === ">") {
            depth--;
            if (depth === 0)
                return i;
        }
    }
    return -1;
}
/**
 * Parse out the key = value entries from within a definition table body.
 * Supports nested sub-tables (e.g. Client = { ... }), bare functions, and
 * multi-line function bodies.
 */
function parseDefinitionTable(tableBody, serviceName, filePath, bodyOffset, fullContent, warnings, isDebug, kirnetVar) {
    var fields = [];
    var v = escapeForRegex(kirnetVar);
    var lines = tableBody.split("\n");
    var lineOffset = 0;
    var i = 0;
    while (i < lines.length) {
        var line = lines[i];
        var trimmed = stripInlineComment(line.trim());
        // Skip empty/comment lines
        if (!trimmed) {
            lineOffset += line.length + 1;
            i++;
            continue;
        }
        // ── CreateSignal: check fullContent-based first (handles multi-line + single-line) ──
        var createSignalStart = trimmed.match(new RegExp("^(\\w+)\\s*=\\s*".concat(v, "\\s*\\.\\s*CreateSignal\\s*\\(")));
        if (createSignalStart) {
            var fieldName = createSignalStart[1];
            var absOffset = bodyOffset + lineOffset;
            var csIdx = fullContent.indexOf("CreateSignal", absOffset);
            if (csIdx !== -1) {
                var parenOpen = fullContent.indexOf("(", csIdx);
                if (parenOpen !== -1) {
                    var parenClose = findMatchingParen(fullContent, parenOpen);
                    if (parenClose !== -1) {
                        var afterParen = fullContent.substring(parenClose + 1);
                        var castMatch = afterParen.match(new RegExp("^[\\s\\n]*::[\\s\\n]*(?:".concat(v, "[\\s\\n]*\\.[\\s\\n]*)?Signal[\\s\\n]*<")));
                        var signalField = void 0;
                        var exprEnd = void 0;
                        if (castMatch) {
                            var angleOpen = parenClose + 1 + castMatch[0].length - 1;
                            var angleClose = findMatchingAngle(fullContent, angleOpen);
                            if (angleClose !== -1) {
                                var typeArgs = fullContent
                                    .substring(angleOpen + 1, angleClose)
                                    .replace(/[\s\n]+/g, " ")
                                    .trim();
                                signalField = { name: fieldName, type: "Signal<".concat(typeArgs, ">") };
                                exprEnd = angleClose + 1;
                            }
                            else {
                                signalField = { name: fieldName, type: "Signal<any>" };
                                exprEnd = parenClose + 1;
                            }
                        }
                        else {
                            signalField = { name: fieldName, type: "Signal<any>" };
                            var absLine = lineAt(fullContent, absOffset);
                            warnings.push({
                                filePath: filePath,
                                line: absLine,
                                message: "[KirNet] ".concat(serviceName, ".").concat(fieldName, " is untyped \u2014 add :: ").concat(kirnetVar, ".Signal<T>"),
                            });
                            exprEnd = parenClose + 1;
                        }
                        fields.push(signalField);
                        if (isDebug) {
                            logger.debug("  ".concat(serviceName, ".").concat(signalField.name, " \u2192 ").concat(signalField.type), true);
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
        var createFuncStart = trimmed.match(new RegExp("^(\\w+)\\s*=\\s*".concat(v, "\\s*\\.\\s*CreateFunction\\s*\\(")));
        if (createFuncStart) {
            var fieldName = createFuncStart[1];
            var absOffset = bodyOffset + lineOffset;
            var cfIdx = fullContent.indexOf("CreateFunction", absOffset);
            if (cfIdx !== -1) {
                var outerParenOpen = fullContent.indexOf("(", cfIdx);
                if (outerParenOpen !== -1) {
                    var outerParenClose = findMatchingParen(fullContent, outerParenOpen);
                    if (outerParenClose !== -1) {
                        // Inside CreateFunction(...) find the function(params) signature
                        var inner = fullContent.substring(outerParenOpen + 1, outerParenClose);
                        var funcSigMatch = inner.match(/function\s*\(([^)]*)\)/);
                        if (funcSigMatch) {
                            var paramsRaw = funcSigMatch[1];
                            // Find return type: last ): ... before the function body
                            var sigEnd = inner.indexOf(")", inner.indexOf("function"));
                            var afterSig = inner.substring(sigEnd + 1);
                            var retMatch = afterSig.match(/^\s*:\s*([^\n]+)/);
                            var funcField = void 0;
                            if (retMatch) {
                                var returnType = retMatch[1].replace(/\s*,?\s*$/, "").trim();
                                var params = splitParams(paramsRaw);
                                var clientParams = params.slice(1);
                                if (clientParams.length === 0) {
                                    funcField = { name: fieldName, type: "() -> ".concat(returnType) };
                                }
                                else {
                                    funcField = { name: fieldName, type: "(".concat(clientParams.join(", "), ") -> ").concat(returnType) };
                                }
                            }
                            else {
                                var absLine = lineAt(fullContent, absOffset);
                                warnings.push({
                                    filePath: filePath,
                                    line: absLine,
                                    message: "[KirNet] ".concat(serviceName, ".").concat(fieldName, " has no return type annotation"),
                                });
                                funcField = { name: fieldName, type: "(...any) -> any" };
                            }
                            fields.push(funcField);
                            if (isDebug) {
                                logger.debug("  ".concat(serviceName, ".").concat(funcField.name, " \u2192 ").concat(funcField.type), true);
                            }
                            // Skip past the full expression in the line array
                            var exprEnd = outerParenClose + 1;
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
        var field = tryParseField(trimmed, serviceName, filePath, bodyOffset + lineOffset, fullContent, warnings, kirnetVar);
        if (field) {
            fields.push(field);
            if (isDebug) {
                logger.debug("  ".concat(serviceName, ".").concat(field.name, " \u2192 ").concat(field.type), true);
            }
            // If this line starts a multi-line function, skip to the matching end
            if (/\bfunction\s*\(/.test(trimmed) && !/\bend\b/.test(trimmed)) {
                var endIdx = skipToMatchingEnd(lines, i);
                for (var j = i + 1; j <= endIdx; j++) {
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
        var bareFuncMatch = trimmed.match(/^(\w+)\s*=\s*function\s*\(([^)]*)\)\s*(?::\s*(.+?))?$/);
        if (bareFuncMatch) {
            var funcField = parseBareFunction(bareFuncMatch[1], bareFuncMatch[2], bareFuncMatch[3], serviceName, filePath, bodyOffset + lineOffset, fullContent, warnings);
            if (funcField) {
                fields.push(funcField);
                if (isDebug) {
                    logger.debug("  ".concat(serviceName, ".").concat(funcField.name, " \u2192 ").concat(funcField.type), true);
                }
            }
            // Skip past the function body to the matching `end`
            var endIdx = skipToMatchingEnd(lines, i);
            for (var j = i; j <= endIdx; j++) {
                lineOffset += lines[j].length + 1;
            }
            i = endIdx + 1;
            continue;
        }
        // Check for nested sub-table: Key = {
        var nestedTableMatch = trimmed.match(/^(\w+)\s*=\s*\{/);
        if (nestedTableMatch) {
            // Find the { in the full content and extract the matching body
            var absBracePos = bodyOffset + lineOffset + line.indexOf("{");
            var nested = extractTableBody(fullContent, absBracePos);
            if (nested) {
                var nestedFields = parseDefinitionTable(nested.text, serviceName, filePath, nested.startOffset, fullContent, warnings, isDebug, kirnetVar);
                fields.push.apply(fields, nestedFields);
                // Skip past the closing } of the nested table
                var closingBracePos = nested.startOffset + nested.text.length;
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
function parseBareFunction(name, paramsRaw, returnTypeRaw, serviceName, filePath, offsetInContent, fullContent, warnings) {
    if (!returnTypeRaw) {
        var absLine = lineAt(fullContent, offsetInContent);
        warnings.push({
            filePath: filePath,
            line: absLine,
            message: "[KirNet] ".concat(serviceName, ".").concat(name, " has no return type annotation"),
        });
        return { name: name, type: "(...any) -> any" };
    }
    var returnType = returnTypeRaw.replace(/\s*,?\s*$/, "").trim();
    var params = splitParams(paramsRaw);
    // Remove first param (player)
    var clientParams = params.slice(1);
    if (clientParams.length === 0) {
        return { name: name, type: "() -> ".concat(returnType) };
    }
    else {
        return { name: name, type: "(".concat(clientParams.join(", "), ") -> ").concat(returnType) };
    }
}
/**
 * Skip lines from startLine until the matching `end` for a `function`.
 * Tracks nesting of function/if/for/while blocks.
 */
function skipToMatchingEnd(lines, startLine) {
    var depth = 0;
    for (var i = startLine; i < lines.length; i++) {
        var stripped = lines[i].replace(/--.*$/, "").trim();
        var words = stripped.split(/\W+/);
        for (var _i = 0, words_1 = words; _i < words_1.length; _i++) {
            var word = words_1[_i];
            if (word === "function" || word === "if" || word === "for" || word === "while") {
                depth++;
            }
            else if (word === "end") {
                depth--;
                if (depth <= 0) {
                    return i;
                }
            }
            else if (word === "repeat") {
                depth++;
            }
            else if (word === "until") {
                depth--;
                if (depth <= 0) {
                    return i;
                }
            }
        }
    }
    return lines.length - 1;
}
function tryParseField(line, serviceName, filePath, offsetInContent, fullContent, warnings, kirnetVar) {
    var v = escapeForRegex(kirnetVar);
    // Case 1/2: Typed signal — KeyName = VarName.CreateSignal(...) :: [VarName.]Signal<T>
    var typedSignalMatch = line.match(new RegExp("^(\\w+)\\s*=\\s*".concat(v, "\\s*\\.\\s*CreateSignal\\s*\\(.*?\\)\\s*::\\s*((?:").concat(v, "\\s*\\.\\s*)?Signal\\s*<(.+)>)\\s*,?\\s*$")));
    if (typedSignalMatch) {
        var name_1 = typedSignalMatch[1];
        var rawType = typedSignalMatch[2];
        // Normalize whitespace and strip module prefix so generated type uses local Signal<T>
        var type = rawType.replace(/\s+/g, " ").replace(new RegExp("".concat(v, "\\s*\\.\\s*"), "g"), "").trim();
        return { name: name_1, type: type };
    }
    // Case 3: Untyped signal — KeyName = VarName.CreateSignal(...)
    var untypedSignalMatch = line.match(new RegExp("^(\\w+)\\s*=\\s*".concat(v, "\\s*\\.\\s*CreateSignal\\s*\\(.*?\\)\\s*,?\\s*$")));
    if (untypedSignalMatch) {
        var name_2 = untypedSignalMatch[1];
        var absLine = lineAt(fullContent, offsetInContent);
        warnings.push({
            filePath: filePath,
            line: absLine,
            message: "[KirNet] ".concat(serviceName, ".").concat(name_2, " is untyped \u2014 add :: ").concat(kirnetVar, ".Signal<T>"),
        });
        return { name: name_2, type: "Signal<any>" };
    }
    // Case 4/5/6: Function — KeyName = VarName.CreateFunction(function(player: Player, ...) : ReturnType
    var funcMatch = line.match(new RegExp("^(\\w+)\\s*=\\s*".concat(v, "\\s*\\.\\s*CreateFunction\\s*\\(\\s*function\\s*\\((.+?)\\)")));
    if (funcMatch) {
        var name_3 = funcMatch[1];
        var paramsRaw = funcMatch[2];
        // Look for return type annotation: everything after ): up to the newline
        var returnMatch = line.match(/\)\s*:\s*(.+?)$/);
        if (!returnMatch) {
            var absLine = lineAt(fullContent, offsetInContent);
            warnings.push({
                filePath: filePath,
                line: absLine,
                message: "[KirNet] ".concat(serviceName, ".").concat(name_3, " has no return type annotation"),
            });
            return { name: name_3, type: "(...any) -> any" };
        }
        var returnType = returnMatch[1].replace(/\s*,?\s*$/, "").trim();
        var params = splitParams(paramsRaw);
        var clientParams = params.slice(1);
        if (clientParams.length === 0) {
            return { name: name_3, type: "() -> ".concat(returnType) };
        }
        else {
            return { name: name_3, type: "(".concat(clientParams.join(", "), ") -> ").concat(returnType) };
        }
    }
    // Case 7: Direct type annotation — KeyName: SomeType,
    var directTypeMatch = line.match(/^(\w+)\s*:\s*(.+?)\s*,?\s*$/);
    if (directTypeMatch) {
        var name_4 = directTypeMatch[1];
        var type = directTypeMatch[2].trim();
        return { name: name_4, type: type };
    }
    // Not a recognizable entry
    return null;
}
/**
 * Split a Luau parameter list respecting nested generics.
 */
function splitParams(raw) {
    var params = [];
    var depth = 0;
    var current = "";
    for (var _i = 0, raw_1 = raw; _i < raw_1.length; _i++) {
        var ch = raw_1[_i];
        if (ch === "<" || ch === "(" || ch === "{") {
            depth++;
            current += ch;
        }
        else if (ch === ">" || ch === ")" || ch === "}") {
            depth--;
            current += ch;
        }
        else if (ch === "," && depth === 0) {
            params.push(current.trim());
            current = "";
        }
        else {
            current += ch;
        }
    }
    if (current.trim()) {
        params.push(current.trim());
    }
    return params;
}
function lineAt(content, offset) {
    var line = 1;
    for (var i = 0; i < offset && i < content.length; i++) {
        if (content[i] === "\n") {
            line++;
        }
    }
    return line;
}
