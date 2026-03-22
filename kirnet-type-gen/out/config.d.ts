export interface KirNetConfig {
    paths: {
        services: string;
        controllers: string;
        output: string;
    };
    options: {
        kirnet_require_path: string;
        debug: boolean;
    };
}
export declare function readConfig(workspaceRoot: string): KirNetConfig;
