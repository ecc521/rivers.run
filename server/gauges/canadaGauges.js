//Load gauges from the Canada Wateroffice
const path = require("path")

const bent = require("bent")
const csvParser = require("csv-parser")

const siteDataParser = require("../siteDataParser.js")

const meterInFeet = 3.2808399
const cubicMeterInFeet = meterInFeet**3


let canadianGaugesPromise;

async function getGaugeDetails(gaugeID) {
	if (!canadianGaugesPromise) {
		canadianGaugesPromise = siteDataParser.getCanadianGauges()
	}
	canadianGauges = await canadianGaugesPromise

	let gaugeInfo = canadianGauges[gaugeID]
	return gaugeInfo
}


function reformatReadings(readingsArr) {
	//All edits in-place.
	for (let i=0;i<readingsArr.length;i++) {
		//When converting, we will round the measurements slightly.
		let reading = readingsArr[i]
		//Reformat timestamps.
		reading.dateTime = new Date(reading.dateTime).getTime()

		//The properties might exist, but just be empty.
		//parseFloat handles strings that are numbers, but returns NaN on things like "" instead of 0.
		if (!isNaN(parseFloat(reading.cms))) {
			reading.cfs = Number(reading.cms) * cubicMeterInFeet
			reading.cfs = Math.round(reading.cfs * 10)/10
		}
		delete reading.cms
		if (!isNaN(parseFloat(reading.meters))) {
			reading.feet = Number(reading.meters) * meterInFeet
			reading.feet = Math.round(reading.feet * 100)/100
		}
		delete reading.meters
	}

	//Sort so that newest values are last.
	readingsArr.sort((a,b) => {return a.dateTime - b.dateTime})
}


async function loadCanadianFile(code) {
	//Returns an object with every gauge in the file.
	//Supports provinces and gaugeIDs.
	let province = code
	if (code.length > 2) {
		console.log(code)
		console.log(await getGaugeDetails(code))
		province = (await getGaugeDetails(code)).province
	}
	let url = `https://dd.weather.gc.ca/hydrometric/csv/${province}/hourly/${province}_${code.length > 2 ? `${code}_` : ""}hourly_hydrometric.csv`
	console.log(code, url)

	let stream;
	try {
		stream = await (bent(url)())
	}
	catch (e) {
		//If 404, return false to indicate no value - the gauge is probably seasonal and currently down. 
		if (e.statusCode === 404) {
			return false
		}
		throw e
	}

	let gaugeReadings = {};

    await new Promise((resolve, reject) => {
        stream.pipe(csvParser({
            mapHeaders: function({header, index}) {
                if (header === "Water Level / Niveau d'eau (m)") {return "meters"}
				else if (header === "Discharge / Débit (cms)") {return "cms"} //cubic meters per second.
				else if (header === "Date") {return "dateTime"}
				else if (header === "﻿ ID") {return "ID"}
				else {return null}
            }
        }))
        .on('data', (data) => {
			gaugeReadings[data.ID] = gaugeReadings[data.ID] || []
			gaugeReadings[data.ID].push(data)
			delete data.ID
		})
        .on('end', resolve);
    })


	let gauges = {}

	for (let gaugeID in gaugeReadings) {
		let results = gaugeReadings[gaugeID]

		reformatReadings(results)

		let gaugeInfo = await getGaugeDetails(gaugeID)

		let output = {
			readings: results,
			name: gaugeInfo.name,
			units: "m",
		}

		gauges[gaugeID] = output
	}

	return gauges
}


module.exports = {
	loadCanadianFile,
}
