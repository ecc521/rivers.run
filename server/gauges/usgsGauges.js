//Load flow information from USGS (United States Geological Survey)

const fs = require("fs")
const path = require("path")

const bent = require("bent")

const processUSGSResponse = require("./processUSGSResponse.js")

//TODO: Begin using modifiedSince. See https://waterservices.usgs.gov/rest/IV-Service.html
let getJSON = bent("json", "https://waterservices.usgs.gov/nwis/iv/")
async function loadSitesFromUSGS(siteCodes, timeInPast = 1000*60*60*24) {
	//USGS does not appear to send flow predictions at the moment.

    let period = "&period=PT" + Math.round(timeInPast / (1000*60*60)) + "H"

	let usgsData = await getJSON("?format=json&sites=" + siteCodes.join(",") + period + "&parameterCd=00060,00065,00010,00011,00045&siteStatus=all")

    //TODO: We should be able to consolidate these functions.
	let sites = processUSGSResponse(usgsData)

    for (let siteCode in sites) {
        sites[siteCode].source = {
            link: "https://waterdata.usgs.gov/nwis/uv?site_no=" + siteCode,
            text: "View this gauge on USGS"
        }
    }

    return sites
}


module.exports = {
	processUSGSResponse,
    loadSitesFromUSGS
}
