const path = require("path")
const fs = require("fs")

const fetch = require("node-fetch")

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


async function loadFromUSGS(siteCodes) {
	
	//TODO: Calls should be batched up. I believe that USGS has a url length limit of 4096 characters.
	//Probably use about 100-200 rivers per call due to performance reasons. When using 400, performance was almost 4 times worse.
    let url = "https://waterservices.usgs.gov/nwis/iv/?format=json&sites=" + siteCodes.join(",") +  "&startDT=" + new Date(Date.now()-timeToRequest).toISOString()  + "&parameterCd=00060,00065,00010,00011,00045&siteStatus=all"

	let start = Date.now()

	let response = await fetch(url)
	let usgsData = await response.text()

	let time = Date.now() - start
	await fs.promises.appendFile(path.join(utils.getLogDirectory(), 'usgsloadingtime.log'), time + '\n');

	return flowDataParser.reformatUSGS(flowDataParser.parseUSGS(JSON.parse(usgsData)))
}



async function loadData(siteCodes) {	
	let gauges = {}
	
	if (virtualGauges) {
		siteCodes = siteCodes.concat(await virtualGauges.getRequiredGauges())
	}

	//Filter out duplicate site names.
	siteCodes = [...new Set(siteCodes)];
	
	
	
	//Batch calls. I believe that USGS has a url length limit of 4096 characters, but they clearly have one (7000 cha/racters failed).
	//Using 150 rivers/call. When using 400, performance was almost 4 times worse than 100-200 rivers/call.	
	
	//Don't ask USGS for non-USGS gauges.
	let usgsSites = siteCodes.filter((usgsID) => {
		return usgsID.length > 7 && usgsID.length < 16 && !isNaN(Number(usgsID))
	})
	
	let start = 0
	let sitesPerBatch = 150 //150 sites at once
	while (start < usgsSites.length) {
		let end = start + sitesPerBatch
		let arr = usgsSites.slice(start,end)
		console.log("Loading sites " + start + " through " + end + " of " + usgsSites.length + ".")
		Object.assign(gauges, await loadFromUSGS(arr)) //Objects are referenced (so gauges is modified)
		start = end
	}
	
	
	if (virtualGauges) {
		console.log("Computing virtual gauges...")
		gauges = await virtualGauges.getVirtualGauges(gauges)
		console.log("Virtual gauges computed...")
	}
	
	gauges.generatedAt = Date.now()
	return gauges
}



module.exports = {
	loadData
}