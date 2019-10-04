const path = require("path")
const fs = require("fs")

const fetch = require("node-fetch")

const jsonShrinker = require("json-shrinker")

const utils = require(path.join(__dirname, "utils.js"))
const flowDataParser = require(path.join(__dirname, "flowDataParser.js"))


let virtualGauges;

try {
	virtualGauges = require(path.join(__dirname, "virtualGauges.js"))
}
catch(e) {
	console.error(e)
	fs.appendFileSync(path.join(utils.getLogDirectory(), "virtualGaugeError.log"), e.toString() + "\n")
}



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
	//TODO: Allow loading in paralell.
	while (start < usgsSites.length) {
		let end = start + sitesPerBatch
		let arr = usgsSites.slice(start,end)
		console.log("Loading sites " + start + " through " + end + " of " + usgsSites.length + ".")
		Object.assign(gauges, await loadFromUSGS(arr)) //Objects are referenced (so gauges is modified)
		start = end
	}
	
	
	if (virtualGauges) {
		console.log("Computing virtual gauges...")
		try {
			gauges = await virtualGauges.getVirtualGauges(gauges)
		}
		catch (e) {console.log(e)}
		console.log("Virtual gauges computed...")
	}
	
	let readingsFile = path.join(utils.getSiteRoot(), "gaugeReadings")
	if (!fs.existsSync(readingsFile)) {fs.mkdirSync(readingsFile, {recursive: true})}
	for (let code in gauges) {
		//May want to try to come up with a system that uses less files with more information apiece.
		//Also consider compressing before writing to disk.
		await fs.promises.writeFile(path.join(readingsFile, code), jsonShrinker.stringify(gauges[code]))
	}
	
	gauges.generatedAt = Date.now()
	return gauges
}



module.exports = {
	loadData
}