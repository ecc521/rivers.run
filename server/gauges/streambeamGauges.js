//Load gauges from StreamBeam
const path = require("path")

const bent = require("bent")

async function loadStreamBeamGauge(gaugeID) {
	let url = `https://www.streambeam.net/Gauge/GetGauge72HourLevelData?siteID=${gaugeID}`
	let json = await (bent("json", url)())

	let results = json.xData.map((timestamp) => {
		//These timestamps don't have any information about timezones, however all current gauges are Central Time.
		timestamp += "-06:00"
		return {dateTime: new Date(timestamp).getTime()}
	})

	json.datasets.forEach((dataset) => {
		if (dataset.unit === "ft" && dataset.name === "Level") {
			dataset.data.forEach((value, index) => {
				results[index]["feet"] = value
			})
		}
	})

	//Sort so that newest values are last.
	//Note that this isn't really neccessary - the data is already sorted this way. We'll still run the sort just to make sure.
	results.sort((a,b) => {return a.dateTime - b.dateTime})

	let output = {
		readings: results,
		name: "StreamBeam " + gaugeID, //TODO: We need to HTML scrape to get names and gauge list. That should be relatively easy (https://www.streambeam.net/Gauge/GaugeList)
		units: "feet",
		source: {
			text: "View this data on StreamBeam",
			link: `https://www.streambeam.net/Home/Gauge?siteID=${gaugeID}`
		}
	}

	return output
}


module.exports = {
	loadStreamBeamGauge,
}
