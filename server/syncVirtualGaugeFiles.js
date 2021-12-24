const fs = require("fs")
const path = require("path")

const utils = require(path.join(__dirname, "utils.js"))

//Automatically sync gauges from the rivers.run-virtual-gauges GitHub.
const child_process = require("child_process")
const virtualGaugeProjectName = "rivers.run-virtual-gauges"
const virtualGaugeProjectUrl = `https://github.com/ecc521/${virtualGaugeProjectName}`

const virtualGaugeDirectory = path.join(utils.getSiteRoot(), virtualGaugeProjectName)

function syncVirtualGaugeFiles() {
	//We'll clone if absent, otherwise fetch/pull.
	let process;

	if (fs.existsSync(virtualGaugeDirectory)) {
		//Fetch + Pull
		process = child_process.exec("git fetch && git pull", {cwd: virtualGaugeDirectory})
	}
	else {
		//Clone
		process = child_process.spawn("git", ["clone", virtualGaugeProjectUrl], {cwd: utils.getSiteRoot()})
	}

	return new Promise((resolve, reject) => {
		process.on('close', resolve);
	})
}

module.exports = {syncVirtualGaugeFiles, virtualGaugeDirectory}
