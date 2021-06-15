#!/usr/bin/node

//Loads the latest USGS data and writes it to usgscache.json every 15 minutes.
//TODO: Calculate virtual gauges here. Reccomend Pitboss npm module for sandboxing.
//Also runs dataparse.js periodically to update the data on rivers.run.

const fs = require("fs")
const path = require("path")
const child_process = require("child_process")

const jsonShrinker = require("json-shrinker")
const prepareRiverData = require(path.join(__dirname, "dataparse.js"))

process.on('uncaughtException', function(e) {
	console.log("Uncaught Exception: ")
	console.trace(e)
})

async function updateRiverData() {
	//Use undefined so defaults still work.
	//TODO: This code could be a bit more consise and extensible. Very repetitive. Should also warn if a includeGauge also has noGauge.
	let obj = {
		includeUSGSGauges: process.argv.includes("--includeUSGSGauges")?true:undefined,
		includeCanadianGauges: process.argv.includes("--includeCanadianGauges")?true:undefined,
		includeIrishGauges: process.argv.includes("--includeIrishGauges")?true:undefined,
	}

	Object.assign(obj, {
		includeUSGSGauges: process.argv.includes("--noUSGSGauges")?false:obj.includeUSGSGauges,
		includeCanadianGauges: process.argv.includes("--noCanadianGauges")?false:obj.includeCanadianGauges,
		includeIrishGauges: process.argv.includes("--noIrishGauges")?false:obj.includeIrishGauges,
	})

	await prepareRiverData(obj)
}

//On reboot, and every 6 hours, run dataparse.js to keep the data on rivers.run current.
let riverDataPromise;
if (!process.argv.includes("--noriverdata")) {
	riverDataPromise = updateRiverData()
	setInterval(updateRiverData, 1000*60*60*2)
}

//Some actions should be performed at installation, but there is no need to start the server (and starting the server can lead to port errors).
let notificationServer = require(path.join(__dirname, "notificationserver.js")) //On reboot, run notificationserver.js
if (!process.argv.includes("--install")) {notificationServer()}

const sendNotifications = require(path.join(__dirname, "sendnotifications.js"));

const compressor = require(path.join(__dirname, "precompress.js"))

const utils = require(path.join(__dirname, "utils.js"))

const gaugeUtils = require(path.join(__dirname, "gauges.js"))

//TODO: Is this actually needed?!?!??!?!!?!?!?!
fs.chmodSync(__filename, 0o775) //Make sure this file is executable. This will help prevent crontab setup issues (this runs on npm install).

let riverDataPath = path.join(utils.getSiteRoot(), "riverdata.json")

async function updateCachedData() {
	if (!fs.existsSync(riverDataPath) || process.argv.includes("--waitforriverdata")) {
		if (riverDataPromise) {
			await riverDataPromise;
			riverDataPromise = null
		}
		else {
			//Even if the user told us not to load data, we are currently forced to.
			console.warn("No river data available. Running updateRiverData once to permit usgscache.js to continue.")
			await updateRiverData()
		}
	}

	console.log("Preparing flow data.\n")
	let riverarray = JSON.parse(await fs.promises.readFile(riverDataPath, {encoding:"utf8"}))

    var sites = []
    for (let i=0;i<riverarray.length;i++) {
		let values = [riverarray[i].gauge]
		riverarray[i].relatedgauges && (values = values.concat(riverarray[i].relatedgauges))
		for (let i=0;i<values.length;i++) {
			let gaugeID = values[i]
			if (!gaugeID) {continue}
			sites.push(gaugeID)
		}
    }

	let gauges = await gaugeUtils.loadData(sites)
	let flowDataPath = path.join(utils.getSiteRoot(), "flowdata3.json")

	await fs.promises.writeFile(flowDataPath, jsonShrinker.stringify(gauges))

	console.log("Flow data prepared.\n")


	if (!process.argv.includes("--install")) {
		console.time("Initial compression run on flowdata3.json")
		await compressor.compressFile(flowDataPath, 9, {ignoreSizeLimit: true, alwaysCompress: true})
		console.timeEnd("Initial compression run on flowdata3.json")
		//Level 11 could take a while... Get level 9 done first.
		console.time("Max compression on flowdata3.json")
		await compressor.compressFile(flowDataPath, 11, {ignoreSizeLimit: true, alwaysCompress: true})
		console.timeEnd("Max compression on flowdata3.json")
	}


	//Run whenever the minutes on the hour is a multiple of 15.
	let currentTime = new Date()
	if (currentTime.getMinutes() === 0) {currentTime.setMinutes(15)}
	else {currentTime.setMinutes(Math.ceil(currentTime.getMinutes()/15)*15)}

	//End install script
	if (process.argv.includes("--install")) {
		console.log("To update river and flow data in the future, run node usgscache.js --install (if you are running the server, data automatically updates).")
		process.exit()
	}

	try {
		sendNotifications(gauges)
	}
	catch (e) {
		console.log("ERROR: sendNotifications errored")
		console.log(error)
	}

	console.log("Precompressing files...")
	compressor.compressFiles(utils.getSiteRoot())

	let timer = setTimeout(updateCachedData, currentTime.getTime() - Date.now() + 60*1000) //Add a 1 minute delay to try and make sure that usgs has time to update. Do not think this is needed.
}

updateCachedData()
