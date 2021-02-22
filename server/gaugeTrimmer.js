//Provide only the last 1 hour of data.

function shrinkGauge(gauge) {
		if (!gauge) {return}

		//1 hour of precipitation data is almost useless. Just delete it.
		gauge.readings.forEach((reading) => {
			delete reading.precip
		})

		gauge.readings.forEach((reading) => {
			reading.dateTime = Number(reading.dateTime)
		})

		//TODO: What should we do with predictions?
		//Currently, we take all predictions, plus the last hour.
		let latestTime;
		for (let i=gauge.readings.length-1;i>=0;i--) {
			let latest = gauge.readings[i]
			if (latest.forecast) {continue;}
			latestTime = latest.dateTime
			break;
		}

		//TODO: Filter out readings that don't have any data.

		gauge.readings = gauge.readings.filter((reading) => {
			//If the reading is more than an hour older than the latest one, delete.
			if (latestTime - reading.dateTime > 1000*60*60) {
				return false
			}
			return true
		})

		if (gauge.readings.length > 5) {
			//After the first 15 minutes, give only 15 minute intervals
			let intervalsFilled = 1
			for (let i=gauge.readings.length - 1;i>=0;i--) {
				if (gauge.readings[i].forecast) {continue;}
				let age = latestTime - gauge.readings[i].dateTime
				if (age >= 1000*60*15) {
					if (age < intervalsFilled * 1000*60*15) {
						gauge.readings.splice(i, 1);
					}
					else {intervalsFilled++}
				}
			}
		}

		return gauge
}

module.exports = {
	shrinkGauge
}
