//Load flow data from NWS (National Weather Service) - A United States Agency

const path = require("path")

const bent = require("bent")
let getXML = bent("https://water.weather.gov/ahps2/", "string")

const processNWSResponse = require("./processNWSResponse.js")

async function loadSiteFromNWS(siteCode) {
	let siteData = await getXML("hydrograph_to_xml.php?gage=" + siteCode + "&output=xml")

	let output = processNWSResponse(siteData)

	return output
}



module.exports = {
	loadSiteFromNWS
}
