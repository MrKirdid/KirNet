import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import TOML from "@iarna/toml";
import * as logger from "./logger";

export interface KirNetConfig {
	paths: {
		services: string;
		controllers: string;
		output: string;
		kirnet_package: string;
	};
	options: {
		kirnet_require_path: string;
		debug: boolean;
	};
}

const DEFAULTS: KirNetConfig = {
	paths: {
		services: "src",
		controllers: "",
		output: "src/ReplicatedStorage/Shared/Packages/KirNet/Types.luau",
		kirnet_package: "",
	},
	options: {
		kirnet_require_path: 'game:GetService("ReplicatedStorage").Shared.Packages.KirNet',
		debug: false,
	},
};

export function readConfig(workspaceRoot: string): KirNetConfig {
	const configPath = path.join(workspaceRoot, "kirnet.toml");

	if (!fs.existsSync(configPath)) {
		return structuredClone(DEFAULTS);
	}

	try {
		const raw = fs.readFileSync(configPath, "utf-8");
		const parsed = TOML.parse(raw) as Record<string, any>;

		const paths = parsed.paths ?? {};
		const options = parsed.options ?? {};

		return {
			paths: {
				services: typeof paths.services === "string" ? paths.services : DEFAULTS.paths.services,
				controllers: typeof paths.controllers === "string" ? paths.controllers : DEFAULTS.paths.controllers,
				output: typeof paths.output === "string" ? paths.output : DEFAULTS.paths.output,
				kirnet_package: typeof paths.kirnet_package === "string" ? paths.kirnet_package : DEFAULTS.paths.kirnet_package,
			},
			options: {
				kirnet_require_path:
					typeof options.kirnet_require_path === "string"
						? options.kirnet_require_path
						: DEFAULTS.options.kirnet_require_path,
				debug: typeof options.debug === "boolean" ? options.debug : DEFAULTS.options.debug,
			},
		};
	} catch (e: any) {
		logger.warn(`Failed to parse kirnet.toml: ${e.message ?? e} — using defaults`);
		return structuredClone(DEFAULTS);
	}
}
