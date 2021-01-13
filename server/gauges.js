const path = require("path")
const fs = require("fs")

const jsonShrinker = require("json-shrinker");

const utils = require(path.join(__dirname, "utils.js"))

const gaugeTrimmer = require(path.join(__dirname, "gaugeTrimmer.js"))

const compressor = require(path.join(__dirname, "precompress.js"))

const {loadSiteFromNWS} = require(path.join(__dirname, "gauges", "nwsGauges.js"))
const {loadSitesFromUSGS} = require(path.join(__dirname, "gauges", "usgsGauges.js"))
const {loadCanadianGauge} = require(path.join(__dirname, "gauges", "canadaGauges.js"))
const {loadIrelandOPWGauge, isValidOPWCode} = require(path.join(__dirname, "gauges", "irelandGauges.js"))

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


const os = require("os")
const child_process = require("child_process")
//Store gaugeReadings in memory, just to reduce disk writes.
//We may want to store these before a reboot (tar.gz, etc), then restore them after, which would eliminate the downside of storing them in memory.
//As of now, we'll simply detect the system.

if (os.platform() === "darwin" && fs.statSync(__dirname).dev === fs.statSync(readingsFile).dev) {
	console.log("Initializing RAM Disk for gaugeReadings")

	let diskName = child_process.execSync("hdiutil attach -nomount ram://$((2 * 1024 * 2048))").toString().trim()

	//mountName is irrelevant, as long as it doesn't conflict, I believe.
	let mountName = "RiversRunTempDiskCanDelete"
	child_process.execSync(`diskutil eraseVolume HFS+ ${mountName} ${diskName}`)

	child_process.execSync(`umount ${diskName}`)

	child_process.execSync(`diskutil mount -mountPoint ${readingsFile} ${diskName}`)
}
else if (os.platform() === "linux") {
	//TODO: Symlink to /dev/shm. Or mount a tempfs/ramfs.
}

const DataSource = require(path.join(__dirname, "DataSource.js"))

class USGS extends DataSource {
	constructor(obj = {}) {
		let config = Object.assign({
			batchSize: 150,
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
		console.log("Loading NWS Batch")
		return loadSiteFromNWS(batch[0])
	}
}

//Meterological Service of Canada
class MSC extends DataSource {
	constructor(obj = {}) {
		let config = Object.assign({
			batchSize: 1,
			concurrency: 25,
		}, obj)
		super(config)
	}

	prefix = "canada:"

	_processBatch(batch) {
		return loadCanadianGauge(batch[0])
	}
}

//Ireland Office of Public Works
class OPW extends DataSource {
	constructor(obj = {}) {
		let config = Object.assign({
			batchSize: 1,
			concurrency: 12,
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

function obtainDataFromSources(gauges, batchCallback, checkBackpressure) {
	//batchCallback is called with every gauge that is computed.
	//There, they can be compressed, stored, etc.

	//Filter out duplicate site names.
	gauges = [...new Set(gauges)];

	let datasources = [
		new USGS({batchCallback, checkBackpressure}),
		new NWS({batchCallback, checkBackpressure}),
		new MSC({batchCallback, checkBackpressure, timeout: 15000}),
		new OPW({batchCallback, checkBackpressure})
	]

	gauges.forEach((gaugeID) => {
		for (let i=0;i<datasources.length;i++) {
			let datasource = datasources[i]
			let code = datasource.getValidCode(gaugeID)
			if (code) {
				datasource.add(code)
				break;
			}
			if (i === datasources.length - 1) {console.warn("No match for " + gaugeID)}
		}
	})

	let promises = []
	datasources.forEach((datasource) => {promises.push(datasource.flush())})
	promises[0].finally(() => {console.log("USGS Done!")})
	promises[1].finally(() => {console.log("NWS Done!")})
	promises[2].finally(() => {console.log("MSC Done!")})
	promises[3].finally(() => {console.log("OPW Done!")})

	return Promise.all(promises)
}

async function loadData(siteCodes) {
	let gauges = {}

	if (virtualGauges) {
		try {
			let requiredGauges = await virtualGauges.getRequiredGauges()
			siteCodes = siteCodes.concat(requiredGauges)
		}
		catch (e) {console.error(e)}
	}

	let writes = [] //TODO: Do we need to cap the maximum number of paralell writes?
	let totalLoaded = 0


	//Use a 30MB additional buffer, then 250KB per batch - probably excessive, and ignores the variance between batches and types, but should be plenty to avoid major issues.
	//Keep in mind that checkBackpressure does not instantly have an effect - the loader proceeds with the queue before calling us,
	//So things may already be batched up coming towards us before we begin to slow things down.

	/*function getMaxOpen(memPerBatch = 250000, additionalBuffer = 3e7) {
		let mem = Math.random() * 1e8
		return Math.max(1, Math.round((mem - additionalBuffer) / memPerBatch))
	}

	let open = 0
	let queue = []
	async function checkBackpressure() {
		//This function will resolve when batches may proceed again. This is used to regulate memory usage when needed.
		//Note that some batches will causse significantly more backpressure than others - one resolve doesn't mean
		//we can proceed. We need to wait until pressure subsides.
		console.log(open, getMaxOpen())
		if (open < getMaxOpen()) {return true}

		let a = Math.random()
		console.time("Waiting " + a)
		await new Promise((resolve, reject) => {
			//Shift is slower, but we want FIFO behavior, so some DataSources don't eat up all of their concurrent slots while others proceed full speed.
			queue.shift(function() {
				console.log(open, getMaxOpen())
				if (open < getMaxOpen()) {
					//If we are being called, we must be the last one in the queue.
					queue.pop()
					resolve()
				}
			})
		})
		console.timeEnd("Waiting " + a)
		return true
	}*/

	await obtainDataFromSources(siteCodes, async function(data, gaugeID) {
		//open++
		//try {
			let filePath = path.join(readingsFile, gaugeID)
			await new Promise((resolve, reject) => {setTimeout(resolve, 2000)})
			await fs.promises.writeFile(filePath, jsonShrinker.stringify(data))
			let shrunkenData = gaugeTrimmer.shrinkGauge(data)
			gauges[gaugeID] = data
			totalLoaded++
			if (totalLoaded % 512 === 0) {console.log("Loaded " + totalLoaded + " gauges. ")}
		/*}
		finally {
			open--
			if (queue.length > 0) {
				queue[queue.length - 1]()
			}
		}*/
	}, /*checkBackpressure*/)

	console.log("Waiting on Writes")
	await Promise.allSettled(writes)
	console.log("Loaded " + totalLoaded + " gauges. ")

	//Question: Should virtualGauges be added as gauges to rivers.run? They would need to be added to riverarray if so.
	if (virtualGauges) {
		console.log("Computing virtual gauges...")
		try {
			let newGauges = await virtualGauges.getVirtualGauges(gauges)
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
