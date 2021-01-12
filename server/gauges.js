const path = require("path")
const fs = require("fs")

const jsonShrinker = require("json-shrinker");

const utils = require(path.join(__dirname, "utils.js"))

const gaugeTrimmer = require(path.join(__dirname, "gaugeTrimmer.js"))

const compressor = require(path.join(__dirname, "precompress.js"))

const {loadSiteFromNWS} = require(path.join(__dirname, "gauges", "nwsGauges.js"))
const {loadSitesFromUSGS} = require(path.join(__dirname, "gauges", "usgsGauges.js"))
const {loadCanadianGauge} = require(path.join(__dirname, "gauges", "canadaGauges.js"))
const {loadIrelandOPWGauge} = require(path.join(__dirname, "gauges", "irelandGauges.js"))

let virtualGauges;

try {
	virtualGauges = require(path.join(__dirname, "virtualGauges.js"))
}
catch(e) {
	console.error(e)
	fs.appendFileSync(path.join(utils.getLogDirectory(), "virtualGaugeError.log"), e.toString() + "\n")
}



const DataSource = require(path.join(__dirname, "DataSource.js"))

class USGS extends DataSource {
	constructor(obj = {}) {
		let config = Object.assign({
			batchSize: 200,
			concurrency: 2,
		}, obj)
		super(config)
	}

	static prefix = "USGS:"

	getValidCode(code) {
		code = removePrefix(code)
		if (!code) {return} //Correct prefix did not exist
		if (code.length > 7 && code.length < 16 && !isNaN(Number(code))) {return code}
	}

	_processBatch(batch) {
		return loadSitesFromUSGS(batch)
	}
}

class NWS extends DataSource {
	constructor(obj = {}) {
		let config = Object.assign({
			batchSize: 1,
			concurrency: 10,
		}, obj)
		super(config)
	}

	static prefix = "NWS:"

	getValidCode(code) {
		code = removePrefix(code)
		if (!code) {return} //Correct prefix did not exist
		//Appears to be 3-4 characters then number. Always 5 characters.
		//Although NWS codes are case insensitive, JavaScript is not, so we should standardize NWS on upperCase.
		if (resCode.length === 5 && (!isNaN(resCode[4])) && isNaN(resCode)) {return code.toUpperCase()}
	}
	_processBatch(batch) {
		return loadSiteFromNWS(batch[0])
	}
}

//Meterological Service of Canada
class MSC extends DataSource {
	constructor(obj = {}) {
		let config = Object.assign({
			batchSize: 1,
			concurrency: 20,
		}, obj)
		super(config)
	}

	static prefix = "canada:"

	_processBatch(batch) {
		return loadIrelandOPWGauge(batch[0])
	}
}

//Ireland Office of Public Works
class OPW extends DataSource {
	constructor(obj = {}) {
		let config = Object.assign({
			batchSize: 1,
			concurrency: 10,
		}, obj)
		super(config)
	}

	static prefix = "ireland:"

	_processBatch(batch) {
		return loadCanadianGauge(batch[0])
	}
}

function loadData(gauges, batchCallback) {
	//batchCallback is called with every gauge that is computed.
	//There, they can be compressed, stored, etc.

	//Filter out duplicate site names.
	gauges = [...new Set(gauges)];

	let datasources = [
		new USGS({batchCallback}),
		new NWS({batchCallback})
		new MSC({batchCallback})
		new OPW({batchCallback})
	]

	gauges.forEach((gaugeID) => {
		for (let i=0;i<datasources.length;i++) {
			let datasource = datasources[i]
			let code = datasource.getValidCode(gaugeID)
			if (code) {
				datasource.add(gaugeID)
				break;
			}
		}
	})

	let promises = []
	datasources.forEach((datasource) => {promises.push(datasource.flush())})
	return Promise.all(promises)
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
	let irelandOPWSites = []

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
		else if (code.toLowerCase().startsWith("ireland:")) {
			irelandOPWSites.push(resCode)
		}
	})

	//Use gaugeTrimmer.shrinkGauges on batches to prevent memory usage from getting too extreme.
	let sitesPerBatch = 450

	while (start < usgsSites.length) {
		let end = start + sitesPerBatch
		let arr = usgsSites.slice(start,end)
		console.log("Loading sites " + start + " through " + Math.min(end, usgsSites.length) + " of " + usgsSites.length + ".")
		let newGauges = await loadSitesFromUSGS(arr)

		for (let code in newGauges) {
			newGauges["USGS:" + code] = newGauges[code]
			delete newGauges[code]
		}

		newGauges = gaugeTrimmer.shrinkGauges(newGauges) //Shrink newGauges.

		Object.assign(gauges, newGauges)
	}

	for (let i=0;i<nwsSites.length;i++) {
		//We need to make sure that the same site doesn't appear multiple times, just with different casings
		//This will require adjusting the usgs property of the rivers.
		console.log("Loading NWS Site " + (i+1) + " of " + nwsSites.length + ".")
		let nwsID = nwsSites[i]

		try {
			let newGauge = await loadSiteFromNWS(nwsID)
			gauges["NWS:" + nwsID] = gaugeTrimmer.shrinkGauge(newGauge)
		}
		catch(e) {
			console.error("Error loading NWS gauge " + nwsID)
			console.error(e)
		}
	}


	for (let i=0;i<irelandOPWSites.length;i++) {
		//We need to make sure that the same site doesn't appear multiple times, just with different casings
		//This will require adjusting the usgs property of the rivers.
		console.log("Loading Ireland OPW Site " + (i+1) + " of " + irelandOPWSites.length + ".")
		let irelandId = irelandOPWSites[i]

		try {
			let newGauge = await loadIrelandOPWGauge(irelandId)
			gauges["ireland:" + irelandId] = gaugeTrimmer.shrinkGauge(newGauge)
		}
		catch(e) {
			console.error("Error loading Ireland OPW gauge " + irelandId)
			console.error(e)
		}
	}


	sitesPerBatch = 100

	while (start < canadaSites.length) {
		let end = start + sitesPerBatch
		let arr = canadaSites.slice(start,end)
		console.log("Loading sites " + start + " through " + Math.min(end, canadaSites.length) + " of " + canadaSites.length + ".")
		let newGauges = await loadCanadianGauges(arr)

		for (let code in newGauges) {
			newGauges["canada:" + code] = newGauges[code]
			delete newGauges[code]
		}

		newGauges = gaugeTrimmer.shrinkGauges(newGauges) //Shrink newGauges.
		console.timeEnd("Shrink newGauges")

		Object.assign(gauges, newGauges)
	}



	//Question: Should virtualGauges be added as gauges to rivers.run? They would need to be added to riverarray if so.
	//TODO: Provide the data virtualGauges need in an unshrunken manner.
	if (virtualGauges) {
		console.log("Computing virtual gauges...")
		try {
			let newGauges = await virtualGauges.getVirtualGauges(gauges)
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
