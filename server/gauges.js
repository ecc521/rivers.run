const path = require("path")
const fs = require("fs")

const jsonShrinker = require("json-shrinker");

const utils = require(path.join(__dirname, "utils.js"))

const gaugeTrimmer = require(path.join(__dirname, "gaugeTrimmer.js"))

const compressor = require(path.join(__dirname, "precompress.js"))

const {loadSiteFromNWS} = require(path.join(__dirname, "gauges", "nwsGauges.js"))
const {loadSitesFromUSGS} = require(path.join(__dirname, "gauges", "usgsGauges.js"))
const {loadCanadianGauges} = require(path.join(__dirname, "gauges", "canadaGauges.js"))

let virtualGauges;

try {
	virtualGauges = require(path.join(__dirname, "virtualGauges.js"))
}
catch(e) {
	console.error(e)
	fs.appendFileSync(path.join(utils.getLogDirectory(), "virtualGaugeError.log"), e.toString() + "\n")
}

let readingsFile = path.join(utils.getSiteRoot(), "gaugeReadings")
if (!fs.existsSync(readingsFile)) {fs.mkdirSync(readingsFile, {recursive: true})}


async function writeBatchToDisk(newGauges) {
	//This should be done in paralell - however be careful not to run too much stuff at once...
	//Some systems REALLY don't like that (and kernel freezes at 100% CPU, 100% Disk Read).
	console.time("Write Files to Disk")
	for (let code in newGauges) {
		let filePath = path.join(readingsFile, code)
		await fs.promises.writeFile(filePath, jsonShrinker.stringify(newGauges[code]))
		//Don't bother compressing. Streaming Gzip or Brotli will do just fine for these files,
		//given how they will be tiny and infrequently accessed.
		//It would be nice if we could write less to the disk - perhaps store these partially or fully in memory?
		//We could also consider not offering an uncompressed version.
		//await compressor.compressFile(filePath, 3, {alwaysCompress: true})
	}
	console.timeEnd("Write Files to Disk")
}


async function loadData(siteCodes) {
	let gauges = {}

	if (virtualGauges) {
		try {
			siteCodes = siteCodes.concat(await virtualGauges.getRequiredGauges())
		}
		catch (e) {console.error(e)}
	}

	//Filter out duplicate site names.
	siteCodes = [...new Set(siteCodes)];

	let usgsSites = []
	let nwsSites = []
	let canadaSites = []

	siteCodes.forEach((code) => {
		let resCode = code.slice(code.indexOf(":") + 1).trim()
		if (code.toUpperCase().startsWith("USGS:")) {
			if (resCode.length > 7 && resCode.length < 16 && !isNaN(Number(resCode))) {usgsSites.push(resCode)}
		}
		else if (code.toUpperCase().startsWith("NWS:")) {
			//Appears to be 3-4 characters then number. Always 5 characters.
			if (resCode.length === 5 && (!isNaN(resCode[4])) && isNaN(resCode)) {
				nwsSites.push(resCode.toUpperCase()) //Although NWS codes are case insensitive, JavaScript is not, so we should standardize NWS on upperCase.
			}
			else {console.log(resCode + " appears to be an invalid NWS site code. ")}
		}
		else if (code.toLowerCase().startsWith("canada:")) {
			canadaSites.push(resCode)
		}
	})

	//For memory reasons, we don't want to hold more than ~1000 gauges worth of data at once.
	let start = 0
	let sitesPerBatch = 450

	let currentWrites;

	while (start < usgsSites.length) {
		let end = start + sitesPerBatch
		let arr = usgsSites.slice(start,end)
		console.log("Loading sites " + start + " through " + Math.min(end, usgsSites.length) + " of " + usgsSites.length + ".")
		let newGauges = await loadSitesFromUSGS(arr)

		for (let code in newGauges) {
			newGauges["USGS:" + code] = newGauges[code]
			delete newGauges[code]
		}

		//Lets try to avoid doing too much at once. Wait for previous batch to finish.
		let waitStart = process.hrtime.bigint()
		await currentWrites
		if (process.hrtime.bigint() - waitStart > BigInt(1e6)) {
			//If we waited more than 0.001 seconds (1 millisecond), tell the user.
			console.log("Waiting for Previous Batch: " + Number(process.hrtime.bigint() - waitStart) / Number(1e6) + "ms")
		}

		currentWrites = new Promise((resolve, reject) => {
			writeBatchToDisk(newGauges).then(() => {
				//We passed writeBatchToDisk a reference to newGauges, so we can't modify a gauge that writeBatchToDisk has not processed.
				//Cloning is a bit resource intensive, so let's not do that. Might as well just wait.
				//If we do need to increase performance, we can use gaugeTrimmer.shrinkGauge to shrink each gauge as it is written to disk.
				console.time("Shrink newGauges")
				newGauges = gaugeTrimmer.shrinkGauges(newGauges) //Shrink newGauges.
				console.timeEnd("Shrink newGauges")

				Object.assign(gauges, newGauges)
				resolve()
			})
		})

		start = end
	}

	//TODO: Multiple NWS calls should be made at once.
	for (let i=0;i<nwsSites.length;i++) {
		//We need to make sure that the same site doesn't appear multiple times, just with different casings
		//This will require adjusting the usgs property of the rivers.
		console.log("Loading NWS Site " + (i+1) + " of " + nwsSites.length + ".")
		let nwsID = nwsSites[i]
		let newGauge = await loadSiteFromNWS(nwsID)
		let obj = {}
		obj["NWS:" + nwsID] = newGauge
		await writeBatchToDisk(obj)
		gauges["NWS:" + nwsID] = gaugeTrimmer.shrinkGauge(newGauge)
	}


	start = 0
	sitesPerBatch = 100

	currentWrites = undefined;

	while (start < canadaSites.length) {
		let end = start + sitesPerBatch
		let arr = canadaSites.slice(start,end)
		console.log("Loading sites " + start + " through " + Math.min(end, canadaSites.length) + " of " + canadaSites.length + ".")
		let newGauges = await loadCanadianGauges(arr)

		for (let code in newGauges) {
			newGauges["canada:" + code] = newGauges[code]
			delete newGauges[code]
		}

		//Lets try to avoid doing too much at once. Wait for previous batch to finish (usually, it already has).
		let waitStart = process.hrtime.bigint()
		await currentWrites
		if (process.hrtime.bigint() - waitStart > BigInt(1e6)) {
			//If we waited more than 0.001 seconds (1 millisecond), tell the user.
			console.log("Waiting for Previous Batch: " + Number(process.hrtime.bigint() - waitStart) / Number(1e6) + "ms")
		}

		currentWrites = new Promise((resolve, reject) => {
			writeBatchToDisk(newGauges).then(() => {
				//We passed writeBatchToDisk a reference to newGauges, so we can't modify a gauge that writeBatchToDisk has not processed.
				//Cloning is a bit resource intensive, so let's not do that. Might as well just wait.
				//If we do need to increase performance, we can use gaugeTrimmer.shrinkGauge to shrink each gauge as it is written to disk.
				console.time("Shrink newGauges")
				newGauges = gaugeTrimmer.shrinkGauges(newGauges) //Shrink newGauges.
				console.timeEnd("Shrink newGauges")

				Object.assign(gauges, newGauges)
				resolve()
			})
		})

		start = end
	}


	await currentWrites

	//Question: Should virtualGauges be added as gauges to rivers.run? They would need to be added to riverarray if so.
	if (virtualGauges) {
		console.log("Computing virtual gauges...")
		try {
			let newGauges = await virtualGauges.getVirtualGauges()
			await writeBatchToDisk(newGauges)
			newGauges = gaugeTrimmer.shrinkGauges(newGauges) //Shrink newGauges.
			Object.assign(gauges, newGauges)
		}
		catch (e) {console.log(e)}
		console.log("Virtual gauges computed...")
	}

	gauges.generatedAt = Date.now()
	return gauges
}



module.exports = {
	loadData,
}
