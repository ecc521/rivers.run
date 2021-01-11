const fs = require("fs")
const path = require("path")

const {VM} = require("vm2")

const utils = require(path.join(__dirname, "utils.js"))

const virtualGaugesPath = path.join(utils.getSiteRoot(), "../", "rivers.run-virtual-gauges")

let gaugeFiles = utils.getFilesInDirectory(virtualGaugesPath)
gaugeFiles = gaugeFiles.filter((src) => {return path.extname(src) === ".js" && !path.dirname(src).includes("utils")})

async function computeVirtualGauge(src) {
	var code = await fs.promises.readFile(src, {encoding: "utf8"});

	let requiredGauges = await computeRequiredGauges(src)

	//Only provide the virtual gauge with the gauges it asked for. Was done for perf and memory, but read only objects with vm2 might fix it.
	let providedGauges = {}
	for (let i=0;i<requiredGauges.length;i++) {
		let gaugeID =  requiredGauges[i]
		let filePath = path.join(utils.getSiteRoot(), "gaugeReadings", gaugeID)
		providedGauges[gaugeID] = JSON.parse(await fs.promises.readFile(filePath, {encoding:"utf8"}))
	}

	const vm = new VM({
	    timeout: 2000,
	    sandbox: {
			gauges: providedGauges,
			console
		}
	});

	let res = vm.run(code)
	return res
}

async function computeRequiredGauges(src) {
	var code = await fs.promises.readFile(src, {encoding: "utf8"});

	const vm = new VM({
	    timeout: 500,
	    sandbox: {
			gauges: false,
			console
		}
	});

	let res = vm.run(code)

	if (!(res instanceof Array) || !res.every((item) => {return typeof item === "string"})) {
		throw "Virtual Gauge did not return an array of strings. "
	}

	return res
}



async function getRequiredGauges() {
	//TODO: Consider going through riverarray and finding the ones that we actually use.
	let required = []
	for (let i=0;i<gaugeFiles.length;i++) {
		let src = gaugeFiles[i]
		try {
			let needsGauges = await computeRequiredGauges(src)
			required = required.concat(needsGauges)
		}
		catch(e) {console.error(e)}
	}
	return required
}

async function getVirtualGauges() {
	let gauges = {}
	for (let i=0;i<gaugeFiles.length;i++) {
		let src = gaugeFiles[i]
		let filename = path.basename(src, ".js")
		let gaugeIdentifier = "virtual:" + filename

		if (gauges[gaugeIdentifier]) {console.error("Naming conflict for " + gaugeIdentifier); continue;}

		try {
			gauges[gaugeIdentifier] = await computeVirtualGauge(src)
		}
		catch (e) {
			console.log(`Virtual Gauge Failed: ${src}`)
			console.error(e)
			continue;
		}

		if (!gauges[gaugeIdentifier]) {
			console.error(gaugeIdentifier + " returned undefined.")
			continue;
		}

		//If a name is not specified, choose one for them.
		if (gauges[gaugeIdentifier].name) {gauges[gaugeIdentifier].name = "Virtual: " + gauges[gaugeIdentifier].name}
		else {gauges[gaugeIdentifier].name = "Virtual: " + filename}
	}

	return gauges
}

module.exports = {
	getRequiredGauges, //Get all gauges for directory
	getVirtualGauges, //Updates usgsarray with all gauges
	computeRequiredGauges, //Needed gauges for one river.
	computeVirtualGauge, //Returns computed data for one river.
	virtualGaugesPath
}
