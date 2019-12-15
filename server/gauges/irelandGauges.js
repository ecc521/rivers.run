const fetch = require("node-fetch")
const csvParser = require("csv-parser")

async function loadIrelandOPWGauge(gaugeID, sensorCode = 1) {
	//Load gauges from the Ireland Office of Public Works. 
	//API info at https://waterlevel.ie/page/api/
	
	//TODO: Site names and coordinates in file at http://waterlevel.ie/geojson/
		
	
	//sensorCode must be a four digit string. Code 0001 is for flow levels, temperature is 0002. 
	sensorCode = String(sensorCode)
	sensorCode = ("0".repeat(4 - sensorCode.length)) + sensorCode
	
	if (sensorCode !== "0001") {throw "Sensor codes other than code 1 are not supported. "}
	

	//gaugeID must be a five character string. Usually all digits. 
	if (!isNaN(gaugeID)) {
		gaugeID = String(gaugeID)
		gaugeID = ("0".repeat(5 - gaugeID.length)) + gaugeID
	}
	
	let url = "https://waterlevel.ie/data/day/" + gaugeID + "_" + sensorCode + ".csv"
	
	let response = await fetch(url)

	let results = [];
    await new Promise((resolve, reject) => {
        response.body.pipe(csvParser({
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
		//TODO: Add site name.
		source: {
			text: "View this data from Ireland's Office of Public Works",
			link: url //TODO: Try to find a better source url.
		}
	}
	
	return output
}



async function loadIrelandOPWGauges(gaugeIDs, maxParalell = 10) {
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
					output[id] = await loadIrelandOPWGauge(id)
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
	loadIrelandOPWGauge,
	loadIrelandOPWGauges
}