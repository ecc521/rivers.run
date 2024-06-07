//Processes flow data from NWS (National Weather Service)

function processNWSResponse(siteData, siteCode) {
	let readings = []

	function processStageflowSeries(series, forecast = false) {
		//Processes either the observed series or the forecast series.
		series.data.forEach((value) => {
			let reading = {}
			reading.dateTime = new Date(value.validTime).getTime()

			function processMeasurement(value, units) {
				if (units === "kcfs") {
					//Round in case of floating point error (ex, .0000000001)
					reading.cfs = Math.round(value * 1000000) / 1000
				}
				else if (units === "cfs") {
					reading.cfs = value
				}
				else if (units === "ft") {
					reading.feet = value
				}
				else {console.log(`Unknown units ${units} for gauge ${siteCode}`)}

				if (reading.cfs === -999000) {delete reading.cfs} //TODO: Does this happen still with the new API?
			}

			processMeasurement(value.primary, series.primaryUnits)
			if (value.secondary) {processMeasurement(value.secondary, series.secondaryUnits)}
			if (forecast === true) {reading.forecast = true} //Label forecasted values.
			readings.push(reading)
		})
	}

	if (!siteData.observed) {
		console.log("Gauge has no observed data. ", siteCode)
		return;
	}

	processStageflowSeries(siteData.observed)
	if (siteData.forecast) {processStageflowSeries(siteData.forecast, true)}

	readings.sort((a,b) => {return a.dateTime - b.dateTime})

	//name properly added separately will be added later.
	return {
		readings,
	}
}

module.exports = processNWSResponse
