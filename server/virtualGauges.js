const fs = require("fs")
const path = require("path")

const Pitboss = require('pitboss-ng').Pitboss; //Used for sandboxing.

const utils = require(path.join(__dirname, "utils.js"))


const virtualGaugesPath = path.join(utils.getSiteRoot(), "../", "rivers.run-virtual-gauges")


let gaugeFiles = utils.getFilesInDirectory(virtualGaugesPath)
gaugeFiles = gaugeFiles.filter((src) => {return path.extname(src) === ".js" && !path.dirname(src).includes("utils")})

let gauges = JSON.parse(fs.readFileSync(path.join(utils.getSiteRoot(), "flowdata2.json"), {encoding:"utf8"}))


async function computeVirtualGauge(src) {
	var code = await fs.promises.readFile(src, {encoding: "utf8"});

	var sandbox = new Pitboss(code, {
		memoryLimit: 256*1024, // 256 MB memory limit.
		timeout: 5000, //5000 milliseconds to run.
		heartBeatTick: 100 //100 milliseconds between memory checks.
	});

	return await new Promise((resolve, reject) => {
		sandbox.run({
				context: {'gauges': gauges},
  				libraries: {
					"console": "console", //Allow virtual gauges to access console.
					"requireUtil": path.join(__dirname, "virtualGaugesRequire.js") //require stuff in the utils directory only.
				} 
			}, 
			function (err, result) {
				if (err !== null) {console.error(err)}
				resolve(result)
				sandbox.kill();
			}
		);
	})
}

//TODO: Make sure that console.error(), console.log(), etc, do something.
async function computeRequiredGauges(src) {
	var code = await fs.promises.readFile(src, {encoding: "utf8"});

	var sandbox = new Pitboss(code, {
		memoryLimit: 32*1024, // 32 MB memory limit.
		timeout: 500, //500 milliseconds to run.
		heartBeatTick: 100 //100 milliseconds between memory checks.
	});

	return await new Promise((resolve, reject) => {
		sandbox.run({}, function (err, result) {
			if (err !== null) {reject(err)}
			else {resolve(result)}
			sandbox.kill();
		});
	})
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

async function getVirtualGauges(usgsarray) {
	gauges = usgsarray
	
	for (let i=0;i<gaugeFiles.length;i++) {
		let src = gaugeFiles[i]
		let filename = path.basename(src, ".js")
		let gaugeIdentifier = "virtual:" + filename
		
		if (gauges[gaugeIdentifier]) {console.error("Naming conflict for " + gaugeIdentifier); continue;}
		
		try {
			gauges[gaugeIdentifier] = await computeVirtualGauge(src)
		}
		catch (e) {
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