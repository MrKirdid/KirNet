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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readConfig = readConfig;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const toml_1 = __importDefault(require("@iarna/toml"));
const DEFAULTS = {
    paths: {
        services: "src/ServerScriptService/Services",
        controllers: "src/StarterPlayerScripts/Controllers",
        output: "src/ReplicatedStorage/Shared/Packages/KirNet/Types.luau",
    },
    options: {
        kirnet_require_path: 'game:GetService("ReplicatedStorage").Shared.Packages.KirNet',
        debug: false,
    },
};
function readConfig(workspaceRoot) {
    const configPath = path.join(workspaceRoot, "kirnet.toml");
    if (!fs.existsSync(configPath)) {
        return structuredClone(DEFAULTS);
    }
    try {
        const raw = fs.readFileSync(configPath, "utf-8");
        const parsed = toml_1.default.parse(raw);
        const paths = parsed.paths ?? {};
        const options = parsed.options ?? {};
        return {
            paths: {
                services: typeof paths.services === "string" ? paths.services : DEFAULTS.paths.services,
                controllers: typeof paths.controllers === "string" ? paths.controllers : DEFAULTS.paths.controllers,
                output: typeof paths.output === "string" ? paths.output : DEFAULTS.paths.output,
            },
            options: {
                kirnet_require_path: typeof options.kirnet_require_path === "string"
                    ? options.kirnet_require_path
                    : DEFAULTS.options.kirnet_require_path,
                debug: typeof options.debug === "boolean" ? options.debug : DEFAULTS.options.debug,
            },
        };
    }
    catch {
        return structuredClone(DEFAULTS);
    }
}
//# sourceMappingURL=config.js.map