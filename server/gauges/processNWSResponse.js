//Processes flow data from NWS (National Weather Service)

const fastXMLParser = require("fast-xml-parser");
const xmlParser = new fastXMLParser.XMLParser({
	attributesGroupName: "attributes",
	ignoreAttributes: false,
	attributeNamePrefix: "",
	textNodeName : "value",
})

//Returns object for this specific site.
function processNWSResponse(siteData) {
	let jsonObj = xmlParser.parse(siteData);

	let siteCode = jsonObj.site.attributes.id

	let readings = []

	//TODO: If conversion tables are supplied, but not used, should we exterpolate CFS from feet?
	//Example with SUMW2 (Gauley River AT Summersville Lake)

	function processValues(values, forecast = false) {
		values.forEach((value) => {
			let reading = {}
			reading.dateTime = new Date(value.valid.value).getTime()

			function processMeasurement(measurement, pedts = value.pedts) {
				if (measurement.attributes.units === "kcfs") {
					//Round in case of floating point error (ex, .0000000001)
					reading.cfs = Math.round(measurement.value * 1000000) / 1000
				}
				else if (measurement.attributes.units === "cfs") {
					reading.cfs = measurement.value
				}
				else if (measurement.attributes.units === "ft") {
					reading.feet = measurement.value
				}
				else {console.log("Unknown units " + measurement.attributes.units + ". Gauge is " + siteCode)}

				if (reading.cfs === -999000) {delete reading.cfs}
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
		name: jsonObj.site.attributes.name, //These names are REALLY weird. May need to revert back to using nwsToName if we can get it working.
	}

	return output
}

module.exports = processNWSResponse
