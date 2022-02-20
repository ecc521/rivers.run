class Gauge {
	constructor(combinedCode, gaugeInfo) {
		this.units = gaugeInfo.units
		this.setReadings(gaugeInfo.readings)
		this.name = gaugeInfo.name

		let splitCode = combinedCode.split(":")
		this.combinedCode = combinedCode
		this.prefix = splitCode[0]
		this.gaugeID = splitCode[1]

		switch (this.prefix) {
			case "USGS":
				this.source = {
					link: "https://waterdata.usgs.gov/nwis/uv?site_no=" + this.gaugeID,
					text: "View this gauge on USGS"
				}
				break;
			case "NWS":
				this.source = {
					link: "https://water.weather.gov/ahps2/hydrograph.php?gage=" + this.gaugeID,
					text: "View this gauge on NWS"
				}
				break;
			case "canada":
				this.source = {
					text: "View this data on the Meteorological Service of Canada",
					link: `https://wateroffice.ec.gc.ca/report/real_time_e.html?stn=` + this.gaugeID
				}
				break;
			case "streambeam":
				this.source = {
					text: "View this data on StreamBeam",
					link: `https://www.streambeam.net/Home/Gauge?siteID=${this.gaugeID}`
				}
				break;
			case "ireland":
				this.source = {
					text: "View this data from Ireland's Office of Public Works",
					link: "https://waterlevel.ie/00000" + this.gaugeID + "/"
				}
				break;
			case "virtual":
				break;
			default:
				console.warn("Unknown Prefix " + this.prefix)
				break;
		}
	}

	setReadings(readings) {
		this.readings = readings
	}

	getLatestReading(prop) {
		//prop is optional - if passed, find the latest reading with this prop.
		let data = this.readings
		if (data) {
			for (let i=data.length;i>=0;i--) {
				let item = data[i]
				if (!item) {continue}
				if (prop) {
					if (item[prop] === undefined) {continue}
				}
				if (item.forecast) {continue}
				return item
			}
		}
	}

	msSinceLatestReading() {
		let lastReading = this.getLatestReading()
		if (!lastReading) {return null}

		return Date.now() - Number(new Date(lastReading.dateTime))
	}

	//Returns negative for decreasing, 0 for stable, and positive for increasing.
	calculateTrendDirection(siteCode, prop = "cfs") {
	    let data = this.readings
	    if (data) {
	        let current;
	        let previous;
	        //We will go back 2 datapoints (usually 30 minutes) if possible.
	        let stop = Math.max(data.length-3, 0)
	        for (let i=data.length - 1;i>=Math.max(stop, 0);i--) {
	            let item = data[i]
	            if (!item) {stop--; continue;}
				if (item.forecast) {stop--; continue;}

	            let value = item[prop]
	            if (current == undefined) {
	                current = value
	            }
	            else {
	                previous = value
	            }
	        }

	        //TODO: Ignore insignificant changes.
	        //Insignificant changes should be changes that are not part of a trend (flow changing directions),
	        //and involve only a small portion of the rivers flow.
	        if (current > previous) {
	            //Water level rising
	            return 1
	        }
	        else if (previous > current) {
	            //Water level falling
	            return -1
	        }
	        else if (current === previous && current != undefined) {
	            //Water level stable
	            return 0
	        }
	    }
		//If we were unsuccessful in calculating a trend with cfs, try again with feet.
	    if (prop === "cfs") {return this.calculateTrendDirection(siteCode, "feet")}
	}
}

module.exports = Gauge
