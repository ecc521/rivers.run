const path = require("path")

const DataSource = require("./DataSource.js")

const {loadSiteFromNWS} = require(path.join(__dirname, "gauges", "nwsGauges.js"))
const {loadSitesFromUSGS} = require(path.join(__dirname, "gauges", "usgsGauges.js"))
const {loadStreamBeamGauge} = require(path.join(__dirname, "gauges", "streambeamGauges.js"))
const {loadCanadianFile, getGaugeDetails} = require(path.join(__dirname, "gauges", "canadaGauges.js"))
const {loadIrelandOPWGauge} = require(path.join(__dirname, "gauges", "irelandGauges.js"))

const {isValidNWSCode, isValidUSGSCode, isValidOPWCode} = require(path.join(__dirname, "gauges", "codeValidators.js"))

class USGS extends DataSource {
	constructor(obj = {}, timeToRequest) {
		let config = Object.assign({
			batchSize: 120, //USGS gets seemingly quadratically slower above ~200
			concurrency: 2 //Can do more, but let's not do too much.
		}, obj)
		super(config)

		this.timeToRequest = timeToRequest //Optional parameter to specify time duration.
	}

	prefix = "USGS:"

	getValidCode(code) {
		code = this.removePrefix(code)
		if (!code) {return} //Correct prefix did not exist
		if (isValidUSGSCode(code)) {return code}
	}

	_processBatch(batch) {
		return loadSitesFromUSGS(batch, this.timeToRequest)
	}
}

class NWS extends DataSource {
	constructor(obj = {}) {
		let config = Object.assign({
			batchSize: 1,
			concurrency: 4, //Don't really know how much this can take. Don't have many gauges for it.
		}, obj)
		super(config)
	}

	prefix = "NWS:"

	getValidCode(code) {
		code = this.removePrefix(code)
		if (!code) {return} //Correct prefix did not exist
		//Although NWS codes are case insensitive, JavaScript is not, so we should standardize NWS on upperCase.
		if (isValidNWSCode(code)) {return code.toUpperCase()}
	}

	_processBatch(batch) {
		console.log("Loading NWS Batch")
		return loadSiteFromNWS(batch[0])
	}
}

//StreamBeam
class StreamBeam extends DataSource {
	constructor(obj = {}) {
		let config = Object.assign({
			batchSize: 1,
			concurrency: 1, //There aren't many of these at all. No problems here.
		}, obj)
		super(config)
	}

	prefix = "streambeam:"

	_processBatch(batch) {
		console.log("Loading StreamBeam Batch")
		return loadStreamBeamGauge(batch[0])
	}
}

//Meterological Service of Canada
class MSC extends DataSource {
	constructor(obj = {}) {
		let config = Object.assign({
			batchSize: 1,
			concurrency: 8, //This can easily handle more (15+), but we're going to spread the CPU load a bit.
		}, obj)
		super(config)
	}

	prefix = "canada:"

	_processBatch(batch) {
		return loadCanadianFile(batch[0])
	}
}

//This MSC will download province files instead of gauge files.
//Therefore, it overrides the batching code to avoid repeatedly requesting provinces.

//TODO: If we only want a few gauges for a province, switch to regular MSC for that province. 
class MSCProvince extends MSC {
	constructor(obj = {}) {
		let config = Object.assign({
			batchSize: Infinity,
			concurrency: 1,
			timeout: 120000 //120 seconds
		}, obj)
		super(config)
	}

	async dispatchCallbacks(result, batch, callback) {
		//This must be an object of gauges, as at least one gaugeID existed in the object.
		for (let gaugeID in result) {
			try {
				await callback(result[gaugeID], this.prefix + gaugeID)
			}
			catch (e) {console.error(e)}
		}
	}

	async getBatches(onlyFull) {
		if (onlyFull) {return []}

		let provinces = new Map()

		while (this.gaugeIDCache.length > 0) {
			let gaugeID = this.gaugeIDCache.pop()
			//Batch every gauge into it's respective province, then run.
			let gaugeInfo = await getGaugeDetails(gaugeID)
			let province = gaugeInfo?.province

			if (!province) {
				console.warn("Unable to determining province for gauge. Skipping. ", gaugeID)
				continue;
			}

			if (!provinces.get(province)) {
				provinces.set(province, [])
			}

			provinces.get(province).push(gaugeID)
		}
		return Array.from(provinces.keys()).map((province) => {return [province]}) //Create batches of a single province.
	}
}

//Ireland Office of Public Works
class OPW extends DataSource {
	constructor(obj = {}) {
		let config = Object.assign({
			batchSize: 1,
			concurrency: 4, //We'll go light here, although this should be similar to MSC/Canada.
		}, obj)
		super(config)
	}

	prefix = "ireland:"

	getValidCode(code) {
		code = this.removePrefix(code)
		if (!code) {return} //Correct prefix did not exist
		if (isValidOPWCode(code)) {return code}
	}

	_processBatch(batch) {
		return loadIrelandOPWGauge(batch[0])
	}
}

module.exports = {USGS, NWS, StreamBeam, MSC, MSCProvince, OPW}
