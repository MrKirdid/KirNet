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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getChannel = getChannel;
exports.log = log;
exports.warn = warn;
exports.error = error;
exports.debug = debug;
exports.dispose = dispose;
var vscode = __importStar(require("vscode"));
var channel;
function getChannel() {
    if (!channel) {
        channel = vscode.window.createOutputChannel("KirNet Type Generator");
    }
    return channel;
}
function log(message) {
    var ts = new Date().toISOString();
    getChannel().appendLine("[".concat(ts, "] ").concat(message));
}
function warn(message) {
    log("\u26A0 ".concat(message));
}
function error(message) {
    log("\u2716 ".concat(message));
}
function debug(message, isDebug) {
    if (isDebug) {
        log("[DEBUG] ".concat(message));
    }
}
function dispose() {
    channel === null || channel === void 0 ? void 0 : channel.dispose();
    channel = undefined;
}
