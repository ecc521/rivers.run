const fs = require("fs")
const path = require("path")

const Pitboss = require('pitboss-ng').Pitboss; //Used for sandboxing.

const utils = require(path.join(__dirname, "utils.js"))


const virtualGaugesPath = path.join(utils.getSiteRoot(), "../", "rivers.run-virtual-gauges")


let gaugeFiles = utils.getFilesInDirectory(virtualGaugesPath)
gaugeFiles = gaugeFiles.filter((src) => {return path.extname(src) === ".js"})

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
				context: {'gauges': gauges}
			}, 
			function (err, result) {
				if (err !== null) {console.error(err)}
				resolve(result)
				sandbox.kill();
			}
		);
	})
}


async function computeRequiredGauges(src) {
	var code = await fs.promises.readFile(src, {encoding: "utf8"});

	var sandbox = new Pitboss(code, {
		memoryLimit: 32*1024, // 32 MB memory limit.
		timeout: 500, //500 milliseconds to run.
		heartBeatTick: 100 //100 milliseconds between memory checks.
	});

	return await new Promise((resolve, reject) => {
		sandbox.run({}, function (err, result) {
			if (err !== null) {console.error(err);}
			resolve(result)
			sandbox.kill();
		});
	})
}



async function getRequiredGauges() {
	//TODO: Consider going through riverarray and finding the ones that we actually use.
	let required = []
	for (let i=0;i<gaugeFiles.length;i++) {
		let src = gaugeFiles[i]
		required = required.concat(await computeRequiredGauges(src))
	}
	return required
}

async function getVirtualGauges(usgsarray) {
	gauges = usgsarray
	
	for (let i=0;i<gaugeFiles.length;i++) {
		let src = gaugeFiles[i]
		let fallbackGaugeName = path.basename(src, ".js")
		
		if (gauges[fallbackGaugeName]) {console.error("Naming conflict for " + fallbackGaugeName); continue;}
		
		gauges[fallbackGaugeName] = await computeVirtualGauge(src)
		
		//If a name is not specified, choose one for them.
		if (gauges[fallbackGaugeName].name) {gauges[fallbackGaugeName].name = "Virtual: " + gauges[fallbackGaugeName]}
		else {gauges[fallbackGaugeName] = "Virtual " + fallbackGaugeName}
	}
	
	return gauges
}

module.exports = {
	getRequiredGauges,
	getVirtualGauges 
}