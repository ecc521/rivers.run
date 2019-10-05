const path = require("path")
const fs = require("fs")

const fetch = require("node-fetch")

const jsonShrinker = require("json-shrinker")

const utils = require(path.join(__dirname, "utils.js"))
const flowDataParser = require(path.join(__dirname, "flowDataParser.js"))

const shrinkUSGS = require(path.join(__dirname, "shrinkUSGS.js"))

const compressor = require(path.join(__dirname, "precompress.js"))

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

let timeToRequest = 1000*86400 //Milliseconds of time to request


async function _loadFromUSGS(siteCodes) {

	//TODO: Calls should be batched up. I believe that USGS has a url length limit of 4096 characters.
	//Probably use about 100-200 rivers per call due to performance reasons. When using 400, performance was almost 4 times worse.

	let startDT = "&startDT=" + new Date(Date.now()-timeToRequest).toISOString()
	let endDT = "&endDT=" + new Date().toISOString() //endDT is optional. Will default to current time. USGS gauge prediction may be used if date in the future.
    let url = "https://waterservices.usgs.gov/nwis/iv/?format=json&sites=" + siteCodes.join(",") +  startDT  + endDT + "&parameterCd=00060,00065,00010,00011,00045&siteStatus=all"

	let start = Date.now()

	let response = await fetch(url)
	let usgsData = await response.text()

	let time = Date.now() - start
	await fs.promises.appendFile(path.join(utils.getLogDirectory(), 'usgsloadingtime.log'), time + '\n');

	return flowDataParser.reformatUSGS(flowDataParser.parseUSGS(JSON.parse(usgsData)))
}

async function loadFromUSGS(siteCodes) {
	//Try up to 5 times.
	for (let i=0;i<5;i++) {
		try {
			return await _loadFromUSGS(siteCodes)
		}
		catch(e) {
			console.error(e)
			await new Promise((resolve, reject) => {setTimeout(resolve, 3000)}) //3 second delay before retrying.
		}
	}
	console.error("Unable to load codes " + siteCodes + " from USGS.")
	return {} //Return an empty object. We don't want to cause errors elsewhere.
}


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

	//TODO: Look for ways to minimize the burden on USGS. This is currently somewhat expensive on them, probably running ~10 MB per 15 minutes.
	//We may want to dynamically load more detailed information, or to simply use less except where requested for virtual gauges, etc.

	//Batch calls. I believe that USGS has a url length limit of 4096 characters, but they clearly have one (7000 cha/racters failed).
	//Using 150 rivers/call. When using 400, performance was almost 4 times worse than 100-200 rivers/call.

	//Don't ask USGS for non-USGS gauges.
	let usgsSites = siteCodes.filter((usgsID) => {
		return usgsID.length > 7 && usgsID.length < 16 && !isNaN(Number(usgsID))
	})

	let start = 0
	let sitesPerBatch = 150 //150 sites at once

	let currentWrites;

	//TODO: Allow loading in paralell.
	while (start < usgsSites.length) {
		let end = start + sitesPerBatch
		let arr = usgsSites.slice(start,end)
		console.log("Loading sites " + start + " through " + end + " of " + usgsSites.length + ".")
		let newGauges = await loadFromUSGS(arr)

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
				//If we do need to increase performance, we can use shrinkUSGS.shrinkGauge to shrink each gauge as it is written to disk.
				console.time("Shrink newGauges")
				newGauges = shrinkUSGS.shrinkUSGS(newGauges) //Shrink newGauges.
				console.timeEnd("Shrink newGauges")

				Object.assign(gauges, newGauges)
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
			newGauges = shrinkUSGS.shrinkUSGS(newGauges) //Shrink newGauges.
			Object.assign(gauges, newGauges)
		}
		catch (e) {console.log(e)}
		console.log("Virtual gauges computed...")
	}

	gauges.generatedAt = Date.now()
	return gauges
}



module.exports = {
	loadData
}
