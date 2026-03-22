// Intercept require('vscode') with a stub
const Module = require('module');
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
	if (request === 'vscode') {
		return __filename; // resolve to this file itself
	}
	return origResolve.call(this, request, parent, isMain, options);
};
// Export a stub that satisfies logger.ts
module.exports = {
	window: {
		createOutputChannel: () => ({
			appendLine: () => {},
			dispose: () => {},
		}),
	},
};
