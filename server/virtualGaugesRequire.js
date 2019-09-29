//This module can be accessed by virtual gauges. It is used to require files in the utils directory (and ONLY the utils directory).
const path = require("path")

const virtualGaugesPath = require("./virtualGauges.js").virtualGaugesPath
const utilsDir = path.join(virtualGaugesPath, "utils")

function safeRequire(relativePath) {
	let filePath = path.join(utilsDir, relativePath)
	let relative = path.relative(utilsDir, filePath)
	if (relative.startsWith("..")) {
		throw "Unable to require " + relativePath + " for security reasons."
	}
	return require(filePath)
}


module.exports = safeRequire