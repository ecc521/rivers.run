const path = require("path")
const fs = require("fs")

const bent = require("bent")
const csvParser = require("csv-parser")

let getCSV = bent("https://waterlevel.ie/data/day/")

const utils = require(path.join(__dirname, "../", "utils.js"))

//Site names and coordinates in file at http://waterlevel.ie/geojson/
let gaugeMetadataPath = path.join(utils.getDataDirectory(), "ireland-geojson.json")


async function downloadMetadata() {
	let json = await bent("https://waterlevel.ie/geojson/", "string")()
	return await fs.promises.writeFile(gaugeMetadataPath, json)
}

async function getMetadata() {
	//Make sure we have the sites file.
	if (!fs.existsSync(gaugeMetadataPath)) {
		console.log("Ireland gauge metadata is not available. Running download script...")
		await downloadMetadata()
	}

	//If the sites file is over 7 days old, download it again.
	let age = Date.now() - (await fs.promises.stat(gaugeMetadataPath)).mtime

	if (age > 1000*60*60*24*7) {
		console.log("Ireland gauge metadata is over " + Math.floor(age/1000/60/60) + " hours old. Running download script...")
		try {
			await downloadMetadata()
		}
		catch(e) {
			console.error(e)
		}
	}

	let metadata = JSON.parse(await fs.promises.readFile(gaugeMetadataPath, {encoding: "utf-8"}))

	//Reformat metadata for easy usage.
	let obj = {}
	metadata.features.forEach((value) => {
		try {
			let gauge = {}
			gauge.name = value.properties.name
			gauge.plat = value.geometry.coordinates[1]
			gauge.plon = value.geometry.coordinates[0]
			let gaugeID = value.properties.ref.slice(5)
			if (Number(gaugeID) < 41000 && Number(gaugeID) > 1) {
				obj[gaugeID] = gauge //Other gauge IDs are stated to be unsuitable for re-publication.
			}
		}
		catch (e) {
			console.error(e)
		}
	})
	return obj
}


let metadataPromise;
async function loadIrelandOPWGauge(gaugeID, sensorCode = 1) {
	//Load gauges from the Ireland Office of Public Works.
	//API info at https://waterlevel.ie/page/api/

	if (!metadataPromise) {
		metadataPromise = getMetadata()
	}
	metadata = await metadataPromise

	//sensorCode must be a four digit string. Code 0001 is for flow levels, temperature is 0002.
	sensorCode = String(sensorCode)
	sensorCode = ("0".repeat(4 - sensorCode.length)) + sensorCode

	if (sensorCode !== "0001") {throw "Sensor codes other than code 1 are not supported. "}

	let stream = await getCSV(gaugeID + "_" + sensorCode + ".csv")

	let results = [];
    await new Promise((resolve, reject) => {
        stream.pipe(csvParser({
            mapHeaders: function({header, index}) {
                if (header === "datetime") {return "dateTime"}
				return header
            }
        }))
        .on('data', (data) => results.push(data))
        .on('end', resolve);
    })

	results = results.map((reading) => {
		reading.dateTime = new Date(reading.dateTime).getTime()

		let meterInFeet = 3.2808399
		if (!isNaN(reading.value)) {
			reading.feet = Number(reading.value) * meterInFeet
			//Round to 2 digits
			reading.feet = Math.round(reading.feet * 100) / 100
		}
		delete reading.value

		return reading
	})

	//Sort so that newest values are last.
	//Note that this isn't really neccessary - the data is already sorted this way. We'll still run the sort just to make sure.
	results.sort((a,b) => {return a.dateTime - b.dateTime})

	let output = {
		readings: results,
		units: "m",
		name: "Ireland OPW " + gaugeID, //TODO: Add site name.
	}

	if (metadata[gaugeID]) {
		output.name = metadata[gaugeID].name
	}

	return output
}

module.exports = {
	loadIrelandOPWGauge,
	getMetadata,
	isValidOPWCode: function(gaugeID) {
		//gaugeID must be a five character string. Usually all digits.

		//Only gaugeIDs between 00001 and 41000 are reccomended for re-publication, and it appears to be exclusive. (https://waterlevel.ie/faq/)
		if (isNaN(gaugeID)) {
			return false
		}
		gaugeID = String(gaugeID)
		gaugeID = ("0".repeat(5 - gaugeID.length)) + gaugeID

		if (Number(gaugeID) >= 41000 || Number(gaugeID) <= 1) {return false}
		return true
	}
}
