//TODO: Need to restart with args like --includeCanadianGauges

const child_process = require("child_process")
const fs = require("fs")
const path = require("path")

const utils = require(path.join(__dirname, "utils.js"))

function isServerUp() {

	//If we rebooted within the past 90 minutes, don't run the checks.
	let lastRebooted = new Date(child_process.execSync("uptime -s").toString())
	if (Date.now() - lastRebooted < 90 * 60 * 1000) {return true}

	let processID;
	try {
		//Get the process ID that owns port 5329..
		processID = Number(child_process.execSync("netstat -nlp | grep 5329").toString().match(/\d+\/node/)[0].match(/\d+/)[0])
	}
	catch(e) {
		//No process owns port 5329. The server must be down.
		return processID || false
	}

	//Make sure that the flow data is recent
	let dataLastUpdated = fs.statSync(path.join(utils.getSiteRoot(), "flowdata3.json")).mtime

	if (Date.now() - dataLastUpdated > 90 * 60 * 1000) {
		//If the data is over 90 minutes old, the server is probably not working.
		return processID || false
	}

	return true
}


let status = isServerUp()

if (typeof status === "number" && !isNaN(status)) {
	fs.appendFileSync(path.join(utils.getLogDirectory(), "servercrashed.log"), "Killing server as it is not working\n")
	//Kill the current server.
	child_process.execSync("kill " + status)
}
if (status !== true) {
	//Start up a new server.
	fs.appendFileSync(path.join(utils.getLogDirectory(), "servercrashed.log"), "Restarting the server, as it is not running\n")

	let writeStream = fs.createWriteStream(path.join(utils.getLogDirectory(), "usgscache.log"), {flags:"a"})

	let process = child_process.spawn("node", [path.join(utils.getSiteRoot(), "server", "usgscache.js")], {
		detached: true
	})
	process.stdout.pipe(writeStream)
	process.stderr.pipe(writeStream)
}
