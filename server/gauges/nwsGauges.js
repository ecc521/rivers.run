//Load flow data from NWS (National Weather Service) - A United States Agency

const path = require("path")

const bent = require("bent")
const xmlParser = require("fast-xml-parser");

let getXML = bent("https://water.weather.gov/ahps2/", "string")

const siteDataParser = require(path.join(__dirname, "../", "siteDataParser.js"))

let nwsToNamePromise;
async function loadSiteFromNWS(siteCode) {
	//NWS enabled GZIP after I repeatedly informed them of the issue, so we might be able to take advantage of their predictions a bit more.
	//That said, they still run ~5KB per gauge, and parsing ~100KB of XML is painfully slow. 

	let siteData = await getXML("hydrograph_to_xml.php?gage=" + siteCode + "&output=xml")

	var jsonObj = xmlParser.parse(siteData, {
		attrNodeName: "attributes",
		ignoreAttributes : false,
		attributeNamePrefix : "",
		textNodeName : "value",
	});

	//Grab the name conversions table so that we can get the name of this gauge.
	if (!nwsToNamePromise) {
		nwsToNamePromise = siteDataParser.getConversionsForNWS()
	}
	let nwsToName = (await nwsToNamePromise).nwsToName

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
				else if (measurement.attributes.units === "cfs") {
					reading.cfs = measurement.value
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
					else if (pedts === "HGIFF" || "HGIFE") {
						//Also not sure what to do here. The term is not defined by NWS, however is used on the forecasted values.
						//Looks to be the same as HGIRG, though not totally sure.
						//HGIFE looks to be a typo.
						reading.feet = measurement.value
					}
					else {console.log("Unknown pedts " + pedts + ". Gauge is " + siteCode)}
				}
				else {console.log("Unknown units " + measurement.attributes.units + ". Gauge is " + siteCode)}

				if (reading.cfs === "-999000") {delete reading.cfs}
			}

			processMeasurement(value.primary)
			if (value.secondary) {processMeasurement(value.secondary)}
			if (forecast === true) {reading.forecast = true} //Label forecasted values.
			readings.push(reading)
		})
	}

	if (!jsonObj.site.observed) {
		console.log(siteCode + " has no observed data. ")
		return;
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
