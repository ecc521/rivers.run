//Load flow data from NWS (National Weather Service) - A United States Agency

const path = require("path")

const fetch = require("node-fetch")
const xmlParser = require("fast-xml-parser");

const siteDataParser = require(path.join(__dirname, "../", "siteDataParser.js"))

let nwsToName;
async function loadSiteFromNWS(siteCode) {
	//NWS does not compress their data, so these requests are absurdly large (XML is ~120KB, HTML (output=tabular) is ~50KB)
	//NWS offers flow predictions though, so can be a very useful tool.
	//TODO: See if there is a way to request less data, or to get it compressed.

	let url = "https://water.weather.gov/ahps2/hydrograph_to_xml.php?gage=" + siteCode + "&output=xml"

	let response = await fetch(url)
	let siteData = await response.text()
	var jsonObj = xmlParser.parse(siteData, {
		attrNodeName: "attributes",
		ignoreAttributes : false,
		attributeNamePrefix : "",
		textNodeName : "value",
	});

	//Grab the name conversions table so that we can get the name of this gauge.
	if (!nwsToName) {
		nwsToName = (await siteDataParser.getConversionsForNWS()).nwsToName
	}

	let readings = []


	function processValues(values, forecast = false) {
		values.forEach((value) => {
			let reading = {}
			reading.dateTime = new Date(value.valid.value).getTime()

			function processMeasurement(measurement, pedts = value.pedts) {
				if (measurement.attributes.units === "kcfs") {
					reading.cfs = measurement.value * 1000
					//In case of freak issues with useless digits (ex. 2.01 * 1000 = 2009.9999999998), round
					reading.cfs = Math.round(reading.cfs * 100000) / 100000
				}
				else if (measurement.attributes.units === "ft") {
					pedts = pedts.toUpperCase()
					//See https://hads.ncep.noaa.gov/cgi-bin/hads/interactiveDisplays/displaySHEF.pl?table=shef_desc&shef_code=
					//for term definitions (put the term after code=)
					if (pedts === "HGIRG") {
						//River stage/height. Good to go!
						reading.feet = measurement.value
					}
					else if (pedts === "HTIRG") {
						//Not quite as sure about how to handle this one. The term stands for Project Tailwater Stage Elevation.
						//I believe that we can convert this to feet by subtracting the datum. The datum appears to have been rounded for these calculations.
						reading.feet = measurement.value - Math.round(jsonObj.site.zerodatum.value)
						//Floating point precision loss can lead to ugly decimals. Round to get rid of them.
						reading.feet = Math.round(reading.feet * 100000) / 100000
						if (reading.feet < 0) {console.warn("Reading was negative after subtracting datum. Something probably went wrong. ")}
					}
					else if (pedts === "HGIFF") {
						//Also not sure what to do here. The term is not defined by NWS, however is used on the forecasted values.
						//Looks to be the same as HGIRG, though not totally sure.
						reading.feet = measurement.value
					}
					else {console.log("Unknown pedts " + pedts)}
				}
				else {console.log("Unknown units " + measurement.attributes.units)}
			}

			processMeasurement(value.primary)
			if (value.secondary) {processMeasurement(value.secondary)}
			if (forecast === true) {reading.forecast = true} //Label forecasted values. 
			readings.push(reading)
		})
	}

	processValues(jsonObj.site.observed.datum)
	if (jsonObj.site.forecast.datum) {processValues(jsonObj.site.forecast.datum, true)}

	readings.sort((a,b) => {return a.dateTime - b.dateTime})


	let output = {
		readings,
		name: nwsToName[siteCode],
		source: {
			link: "https://water.weather.gov/ahps2/hydrograph.php?gage=" + siteCode + "&wfo=rlx",
			text: "View this gauge on NWS"
		}
	}


	return output
}



module.exports = {
	loadSiteFromNWS
}
