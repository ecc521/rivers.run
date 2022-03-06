const path = require("path")
const fs = require("fs")

const utils = require(path.join(__dirname, "utils.js"))

const gaugeTrimmer = require(path.join(__dirname, "gaugeTrimmer.js"))

const compressor = require(path.join(__dirname, "precompress.js"))

const {USGS, NWS, StreamBeam, MSC, MSCProvince, OPW} = require(path.join(__dirname, "datasources.js"))

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

function obtainDataFromSources(gauges, batchCallback) {
	//batchCallback is called with every gauge that is computed.
	//There, they can be compressed, stored, etc.

	//Filter out duplicate site names.
	gauges = [...new Set(gauges)];

	let datasources = [
		new USGS({batchCallback}),
		new NWS({batchCallback}),
		new MSCProvince({batchCallback}),
		new OPW({batchCallback}),
		new StreamBeam({batchCallback})
	]

	gauges.forEach((gaugeID) => {
		for (let i=0;i<datasources.length;i++) {
			let datasource = datasources[i]
			let code = datasource.getValidCode(gaugeID)
			if (code) {
				datasource.add(code)
				break;
			}
			//TODO: We need a good way to track down bad gauge codes to source rivers.
			if (i === datasources.length - 1) {console.warn("No match for " + gaugeID)}
		}
	})

	let promises = []
	datasources.forEach((datasource) => {promises.push(datasource.flush(false, true))})
	promises[0].finally(() => {console.log("USGS Done!")})
	promises[1].finally(() => {console.log("NWS Done!")})
	promises[2].finally(() => {console.log("MSC Done!")})
	promises[3].finally(() => {console.log("OPW Done!")})
	promises[4].finally(() => {console.log("StreamBeam Done!")})

	return Promise.allSettled(promises)
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

	let writes = []
	let startedLoading = 0
	let totalLoaded = 0

	async function writeFile(data, gaugeID) {
		let filePath = path.join(readingsFile, gaugeID)
		await fs.promises.writeFile(filePath, JSON.stringify(data))
	}

	await obtainDataFromSources(siteCodes, function(data, gaugeID) {
		startedLoading++
		writes.push((async function() {
			await writeFile(data, gaugeID)
			gaugeTrimmer.shrinkGauge(data)
			gauges[gaugeID] = data
			totalLoaded++
			if (totalLoaded % 512 === 0) {console.log("Finished writing " + totalLoaded + " gauges. (" + (startedLoading - totalLoaded) + " more in progress)")}
		}()))
	})

	console.log("Waiting on Writes")
	await Promise.allSettled(writes)
	console.log("Loaded " + totalLoaded + " gauges. ")

	//TODO: Get 7 days of USGS data for virtual gauge gauges.
	//Question: Should virtualGauges be added as gauges to rivers.run? They would need to be added to riverarray if so.
	if (virtualGauges) {
		console.log("Computing virtual gauges...")
		try {
			let newGauges = await virtualGauges.getVirtualGauges(gauges)
			for (let gaugeID in newGauges) {
				let data = newGauges[gaugeID]
				await writeFile(data, gaugeID)
				gaugeTrimmer.shrinkGauge(gauge)
				gauges[gaugeID] = gauge
			}
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
