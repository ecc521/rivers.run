const process = require("process")
const path = require("path")

const {runDev, runProd, watchDev} = require("./webpackbuild.js")
const {enableWatcher, processCSS} = require("./Gulpfile.js")

if (process.argv.includes("watch")) {
	enableWatcher()
	watchDev()
}
else if (process.argv.includes("prod")) {
	processCSS()
	runProd()
}
else {
	console.log(`Must pass either "watch" or "prod" as argument. `)
}
