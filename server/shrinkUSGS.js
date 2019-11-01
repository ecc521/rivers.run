//Provide only the last 1 hour of data.
//TODO: Consider only initial view, or one hour only for cfs and feet.


//TODO: We will need to handle gauge prediction.


function shrinkGauge(gauge) {
		if (!gauge) {return}

		//1 hour of precipitation data is pretty much useless - don't bother with any.
		delete gauge.precip

		let shrink = ["cfs", "feet", "temp"]
		for (let i=0;i<shrink.length;i++) {
			let arr = gauge[shrink[i]]
			if (!arr) {continue}
			let latest = arr[arr.length - 1]
			if (latest == null) {
				//USGS probably intentionally disabled the gauge because of issues. Delete the whole array.
				delete gauge[shrink[i]]
				continue
			}
			let latestTime = latest.dateTime
			//TODO: What should happen if latestTime is in the future?
			//console.log(arr)
			let previousTime;
			arr = arr.filter((reading) => {return reading != null}) //Delete null and undefined readings
			arr = arr.filter((reading) => {
				//If the reading is more than an hour older than the latest one, delete.
				if (latestTime - reading.dateTime > 1000*60*60) {
					return false
				}
				return true
			})

			if (arr.length > 5) {
				//After the first 15 minutes, give only 15 minute intervals
				let intervalsFilled = 1
				for (let i=arr.length - 1;i>=0;i--) {
					let age = latestTime - arr[i].dateTime
					if (age >= 1000*60*15) {
						if (age < intervalsFilled * 1000*60*15) {
							arr.splice(i, 1);
						}
						else {intervalsFilled++}
					}
				}
			}

			gauge[shrink[i]] = arr
			//console.log(arr)
		}
		return gauge
}


function shrinkUSGS(usgsarray) {
	for (let gaugeID in usgsarray) {
		usgsarray[gaugeID] = shrinkGauge(usgsarray[gaugeID])
	}
	return usgsarray
}

module.exports = {
	shrinkGauge,
	shrinkUSGS
}
