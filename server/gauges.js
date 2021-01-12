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

const DataSource = require(path.join(__dirname, "DataSource.js"))

class USGS extends DataSource {
	constructor(obj = {}) {
		let config = Object.assign({
			batchSize: 200,
			concurrency: 2,
		}, obj)
		super(config)
	}

	prefix = "USGS:"

	getValidCode(code) {
		code = this.removePrefix(code)
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

	prefix = "NWS:"

	getValidCode(code) {
		code = this.removePrefix(code)
		if (!code) {return} //Correct prefix did not exist
		//Appears to be 3-4 characters then number. Always 5 characters.
		//Although NWS codes are case insensitive, JavaScript is not, so we should standardize NWS on upperCase.
		if (code.length === 5 && (!isNaN(code[4])) && isNaN(code)) {return code.toUpperCase()}
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

	prefix = "canada:"

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

	prefix = "ireland:"

	_processBatch(batch) {
		return loadCanadianGauge(batch[0])
	}
}

function obtainDataFromSources(gauges, batchCallback) {
	//batchCallback is called with every gauge that is computed.
	//There, they can be compressed, stored, etc.

	//Filter out duplicate site names.
	gauges = [...new Set(gauges)];

	let datasources = [
		new USGS({batchCallback}),
		new NWS({batchCallback}),
		new MSC({batchCallback}),
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
			if (i === datasources.length - 1) {console.warn("No match for " + gaugeID)}
		}
	})

	let promises = []
	datasources.forEach((datasource) => {promises.push(datasource.flush())})
	return Promise.all(promises)
}





async function loadData(siteCodes) {
	let gauges = {}

	/*if (virtualGauges) {
		try {
			siteCodes = siteCodes.concat(await virtualGauges.getRequiredGauges())
		}
		catch (e) {console.error(e)}
	}*/

	console.log(siteCodes)
	await obtainDataFromSources(siteCodes, function(data) {
		console.log(data)
		let newGauges = gaugeTrimmer.shrinkGauges(newGauges) //Shrink newGauges.
		Object.assign(gauges, newGauges)
	})

	console.log(gauges)


	//Question: Should virtualGauges be added as gauges to rivers.run? They would need to be added to riverarray if so.
	/*if (virtualGauges) {
		console.log("Computing virtual gauges...")
		try {
			let newGauges = await virtualGauges.getVirtualGauges(gauges)
			newGauges = gaugeTrimmer.shrinkGauges(newGauges) //Shrink newGauges.
			Object.assign(gauges, newGauges)
		}
		catch (e) {console.log(e)}
		console.log("Virtual gauges computed...")
	}*/

	gauges.generatedAt = Date.now()
	return gauges
}



module.exports = {
	loadData,
}
