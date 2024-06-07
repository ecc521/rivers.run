//Load flow data from NWS (National Weather Service)
const bent = require("bent")

// Flow data for a gauge.
// https://api.water.noaa.gov/nwps/v1/gauges/{sidecode}/stageflow
let getFlowInfoJSON = bent("https://api.water.noaa.gov/nwps/v1/gauges/", "json")

const processNWSResponse = require("./processNWSResponse.js")

async function loadSiteFromNWS(siteCode) {
	let siteData = await getFlowInfoJSON(siteCode + "/stageflow")

	let output = processNWSResponse(siteData, siteCode)
	output.name = await getSiteName(siteCode)
	console.log("NAME", output.name)

	return output
}


//Info about a gauge:
// https://api.water.noaa.gov/nwps/v1/gauges/{sidecode}
let getSiteDataJSON = bent("https://api.water.noaa.gov/nwps/v1/gauges/", "json")

//We will assume that site names will not change while the server it up.
let siteNameCache = {}
async function getSiteName(siteCode) {
	if (!siteNameCache[siteCode]) {
		let obj = await getSiteDataJSON(siteCode)
		siteNameCache[siteCode] = obj.name
	}

	return siteNameCache[siteCode]
}


module.exports = {
	loadSiteFromNWS
}
