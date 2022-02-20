//Processes flow information from USGS (United States Geological Survey)

//Returns an object containing siteCodes and associated sites.
function processUSGSResponse(obj) {
	//Some of obj.value.queryInfo may be useful for request management (requestDT if using modifiedSince, etc)

	let timeSeries = obj.value.timeSeries

	//USGS sends each data type seperately - we must iterate the list and associate them together.
	let usgsSites = {}

	for (let i=0;i<timeSeries.length;i++) {
	    let seriesItem = timeSeries[i]
	    let siteCode = seriesItem.sourceInfo.siteCode[0].value

	    let obj = usgsSites[siteCode] = usgsSites[siteCode] || {
	        name: seriesItem.sourceInfo.siteName,
			readings: new Map()
	    }

	    let values = seriesItem.values[0].value

	    //Filter out bad readings (usually -999999, caused by things like ice on sensors)
	    let noDataValue = seriesItem.variable.noDataValue
	    values = values.filter((value) => {
	        if (value.value == noDataValue) {return false}
	        return true
	    })

		let property;

		//TODO: Also check the codes.
		// let variableCode = seriesItem.variable.variableCode[0].value
		//00060 cfs, 00065 feet, 00010 temp (00011 for some like Yough), and 00045 precip
		let unitCode = seriesItem.variable.unit.unitCode
		switch (unitCode) {
			case "deg C":
				values.forEach((value) => {
					let tempInF = value.value * 1.8 + 32 //Convert to farenheit
					value.value = Math.round(tempInF * 100) / 100 //Round to 100ths place.
				})
			case "deg F":
				property = "temp"
				break;
			case "ft3/s":
				property = "cfs"
				break;
			case "ft":
				property = "feet"
				break;
			case "in":
				property = "precip"
				break;
			default:
				console.warn(`Unknown Unit ${unitCode}`)
				continue; //Continue loop - we can't process this one.
			}

		values.forEach((value) => {
			let dateTime = new Date(value.dateTime).getTime()

			let currentReading = obj.readings.get(dateTime)
			if (!currentReading) {
				currentReading = {}
				obj.readings.set(dateTime, currentReading)
			}
			currentReading[property] = Number(value.value)
		})
	}

	//Now combine the associated data into our format.
	for (let gaugeID in usgsSites) {
		let site = usgsSites[gaugeID]

		//Sort timestamps
		let timestamps = Array.from(site.readings.keys())
		timestamps.sort() //Ensure the list is sorted.

		let newReadings = []

		timestamps.forEach((timestamp) => {
			let newReading = site.readings.get(timestamp)
			newReading.dateTime = timestamp
			newReadings.push(newReading)
		})

		site.readings = newReadings

		site.source = {
			link: "https://waterdata.usgs.gov/nwis/uv?site_no=" + gaugeID,
			text: "View this gauge on USGS"
		}
	}

	return usgsSites
}

module.exports = processUSGSResponse
