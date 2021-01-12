//Load gauges from the Canada Wateroffice
const path = require("path")

const bent = require("bent")
const csvParser = require("csv-parser")

const siteDataParser = require(path.join(__dirname, "../", "siteDataParser.js"))

let canadianGaugesPromise;

//TODO: Instead of loading all gauges individually, load the file containing data for each region.
async function loadCanadianGauge(gaugeID) {
	//https://dd.weather.gc.ca/hydrometric/csv/

	if (!canadianGaugesPromise) {
		canadianGaugesPromise = siteDataParser.getCanadianGauges()
	}
	canadianGauges = await canadianGaugesPromise

	let gaugeInfo = canadianGauges[gaugeID]
	let province = gaugeInfo.province
	//Using daily instead of hourly gives a longer duration of data.
	let url = `https://dd.weather.gc.ca/hydrometric/csv/${province}/hourly/${province}_${gaugeID}_hourly_hydrometric.csv`
	let stream = await (bent(url)())

	let results = [];
    await new Promise((resolve, reject) => {
        stream.pipe(csvParser({
            mapHeaders: function({header, index}) {
                if (header === "Water Level / Niveau d'eau (m)") {return "meters"}
				else if (header === "Discharge / Débit (cms)") {return "cms"} //cubic meters per second.
				else if (header === "Date") {return "dateTime"}
				else {return null}
            }
        }))
        .on('data', (data) => results.push(data))
        .on('end', resolve);
    })

	let meterInFeet = 3.2808399
	let cubicMeterInFeet = meterInFeet**3

	for (let prop in results) {
		//When converting, we will round the measurements slightly.
		let reading = results[prop]
		//Reformat timestamps.
		reading.dateTime = new Date(reading.dateTime).getTime()
		if (reading.cms) {
			reading.cfs = Number(reading.cms) * cubicMeterInFeet
			reading.cfs = Math.round(reading.cfs * 10)/10
			delete reading.cms
		}
		if (reading.meters) {
			reading.feet = Number(reading.meters) * meterInFeet
			reading.feet = Math.round(reading.feet * 100)/100
			delete reading.meters
		}
	}

	//Sort so that newest values are last.
	results.sort((a,b) => {return a.dateTime - b.dateTime})

	let output = {
		readings: results,
		name: gaugeInfo.name,
		units: "m",
		source: {
			text: "View this data on the Meteorological Service of Canada",
			link: url //TODO: Try to find a better source url.
		}
	}

	return output
}


module.exports = {
	loadCanadianGauge,
}
