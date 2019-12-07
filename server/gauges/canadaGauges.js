//Load gauges from the Canada Wateroffice
const path = require("path")

const fetch = require("node-fetch")
const csvParser = require("csv-parser")

const siteDataParser = require(path.join(__dirname, "../", "siteDataParser.js"))

let canadianGauges;

async function loadCanadianGauge(gaugeID) {
	//https://dd.weather.gc.ca/hydrometric/csv/

	if (!canadianGauges) {
		canadianGauges = await siteDataParser.getCanadianGauges()
	}
	let gaugeInfo = canadianGauges[gaugeID]
	let province = gaugeInfo.province
	//Using daily instead of hourly gives a longer duration of data.
	let url = "https://dd.weather.gc.ca/hydrometric/csv/" + province + "/hourly/" + province + "_" + gaugeID + "_hourly_hydrometric.csv"

	let response = await fetch(url)

	let results = [];
    await new Promise((resolve, reject) => {
        response.body.pipe(csvParser({
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
		source: {
			text: "View this data on the Meteorological Service of Canada",
			link: url //TODO: Try to find a better source url.
		}
	}

	return output
}


async function loadCanadianGauges(gaugeIDs, maxParalell = 10) {
	gaugeIDs = [...new Set(gaugeIDs)]; //Remove duplicate IDs

	let output = {}
	let running = 0
	let counter = 0

	//TODO: Handle case where a gauge errors while loading.
	return await new Promise((resolve, reject) => {
		async function loadGauge(id) {
			running++
			for (let i=0;i<5;i++) {
				try {
					output[id] = await loadCanadianGauge(id)
					break;
				}
				catch(e) {
					console.error(e)
				}
			}
			running--
			if (counter < gaugeIDs.length - 1) {
				loadGauge(gaugeIDs[++counter])
			}
			else if (running === 0){resolve(output)}
		}

		for (;counter<Math.min(maxParalell, gaugeIDs.length);counter++) {
			loadGauge(gaugeIDs[counter])
		}
	})
}


module.exports = {
	loadCanadianGauge,
	loadCanadianGauges
}
