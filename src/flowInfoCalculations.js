//These functions are used by River.js to calculate things based on a rivers flow.

function calculateDirection(usgsNumber, prop="cfs") {
	//We will try first using cfs. If there is no conclusion, try feet. 
    let usgsData = usgsarray[usgsNumber]
    if (usgsData) {

        let data = usgsData[prop]

        if (data) {
            let current;
            let previous;

            //TODO: Ignore insignificant changes.

            //We will go back 2 datapoints (usually 30 minutes) if possible.
            let stop = Math.max(data.length-2, 0)
            for (let i=data.length;i>=stop;i--) {
                let item = data[i]
                if (!item) {continue}
                let value = item.value
                if (!current) {
                    current = value
                }
                else {
                    previous = value
                }
            }

            if (current > previous) {
                //Water level rising
                return "⬆"
            }
            else if (previous > current) {
                //Water level falling
                return "⬇"
            }
            else if (current === previous) {
                //Water level stable
                return " –" //En dash preceeded by a thin space.
            }
        }
    }
	
	if (prop === "cfs") {return calculateDirection(usgsNumber, "feet")}
    return; //If we got here, there is not enough USGS data.
}





function calculateAge(usgsNumber) {
	//Returns millseconds old that USGS data is
    let usgsData = window.usgsarray[usgsNumber]
    if (usgsData) {
        let data = usgsData.cfs || usgsData.feet || usgsData.temp || usgsData.precip;

        if (data) {
            for (let i=data.length;i>=0;i--) {
                let item = data[i]
                if (!item) {continue}
                return Date.now() - Number(new Date(item.dateTime))
            }
        }
    }
    return null; //If we got here, there is not enough USGS data.
}


function calculateRelativeFlow(river) {
    //Defines river.running
    //0-4
    //0 is too low, 4 is too high, other values in between
	
	if (river.relativeFlowType) {
		return;
	}

    let values = ["minrun", "lowflow", "midflow", "highflow", "maxrun"]

    let type; //Currently, we skip a value if one datapoint is cfs and another feet

	let currentMax;
	
    for (let i=0;i<values.length;i++) {

        let str = river[values[i]]
        if (!str) {
            values[i] = undefined
            continue;
        }
        str = str.trim()
        let value = parseFloat(str)
        let currentType = str.match(/[^\d|.]+/) //Match a series of non-digits

        if (currentType) {
            currentType = currentType[0].trim().toLowerCase() //Use the first match
        }
        if (!type && currentType) {
            type = currentType
        }
        else if (type !== currentType && !isNaN(value)) {
            console.warn(values[i] + " on " + river.name + " " + river.section + " has a different extension and has been skipped")
            values[i] = undefined
            continue;
        }
		
		if (value < currentMax) {
            console.warn(values[i] + " is smaller than a value that comes before it on " + river.name + " " + river.section + " and has been skipped")
            values[i] = undefined
            continue;
		}
		
		currentMax = value
        values[i] = value
    }

	if (values.filter((value) => {return value !== undefined}).length === 0) {
		return null //If no relative flow values exist, return. This should help improve performance with gauges (lots of gauges, none have relative flows)
	}
	
	river.relativeFlowType = type	


    //Use or equal to
    //While that technically may not be correct (says that river is too low at minrun), it makes no significant difference
    //In addition, values equal to minrun or maxrun result in a river.running of 0 or 4
    //Meaning that they may be included in the middle of a darker highlighted rivers
    //When sorting by runnability is used.

    //It would be better if rivers that are too high or too low are still given river.running values
    //related to their level. This would also help in determining if something is just barely
    //too low, and may come up with rain, or is truely too low.

    //If we don't have some values, fill them in using logarithms
    //Although these calculations are not needed when flow is below minrun or above maxrun. they can be useful in
    //alerting people what values are being used, so that they can

	//TODO: Estmate all values, even if we do not have values on each side of them. This is actually quite accurate, although maxrun is usually too high to
	//calculate the other values correctly. (the calculated maxruns are reasonable, but the provided maxruns are too high)
    function logDist(low, high, ratio = 0.5) {
        //ratio is how a decimal between 0 and 1. 0.5 means to factor lowLog and highLog evenly. Values greater than 0.5 factor in highLog more, vice versa.
        let lowLog = Math.log10(low)
        let highLog = Math.log10(high)
        if (lowLog > highLog) {
            console.error("Low greater than high on " + river.name + " " + river.section)
            return;
        }
        return 10**(lowLog + (highLog - lowLog)*ratio)
    }

    river.minrun = values[0]
    river.maxrun = values[4]
	
	//Use getters so that we only compute a property when neccessary.
	if (values[2]) {river.midflow = values[2]}
	else {
	    Object.defineProperty(river, "midflow", {
			configurable: true,
			get: function getMidflow() {
				//Use nearest values to calculate midflow
				let midflow = logDist(values[1], values[3])//Average lowflow and highflow
					|| logDist(values[0], values[3], 2/3) // two-thirds of the way between minrun and highflow
					|| logDist(values[1], values[4], 1/3) // one-third of the way between lowflow and maxrun
					|| logDist(river.minrun, river.maxrun) //Average minrun and maxrun.
				delete river.midflow
				return river.midflow = midflow
			}
		})
	}
	
	if (values[1]) {river.lowflow = values[1]}
	else {
		Object.defineProperty(river, "lowflow", {
			configurable: true,
			get: function getLowflow() {
				delete river.lowflow
				return river.lowflow = logDist(river.minrun, river.midflow)
			}
		})
	}
	
	if (values[3]) {river.highflow = values[3]}
	else {
		Object.defineProperty(river, "highflow", {
			configurable: true,
			get: function getHighflow() {
				delete river.highflow
				return river.highflow = logDist(river.midflow, river.maxrun)
			}
		})
	}
	
	function calculateRatio(low, high, current) {
		low = Math.log(low)
		high = Math.log(high)

		current = Math.log(current)


		let range = high-low
		let value = current-low

		return value/range
	}
	
	let oldFlow;
	let oldRunning;
	
	Object.defineProperty(river, "running", {
		//TODO: Remember old result, and return it if flow hasn't changed.
		get: function getRunning() {
			
			let flowLevel;
			
			if (river.relativeFlowType === "cfs") {
				flowLevel = river.cfs
			}
			else if (river.relativeFlowType === "feet" || river.relativeFlowType === "ft") {
				flowLevel = river.feet
			}
			
			if (oldFlow === flowLevel) {
				return oldRunning
			}
			
			let running;
			
			//TODO: Consider ordering rivers, even if above/below minrun/maxrun.
			if (flowLevel <= river.minrun) {
				running = 0
			}
			else if (flowLevel >= river.maxrun) {
				running = 4
			}
			else if (flowLevel < river.lowflow && river.minrun) {
				running = calculateRatio(river.minrun, river.lowflow, flowLevel)
			}
			else if (flowLevel < river.midflow && river.lowflow) {
				running = 1+calculateRatio(river.lowflow, river.midflow, flowLevel)
			}
			else if (flowLevel < river.highflow && river.midflow) {
				running = 2+calculateRatio(river.midflow, river.highflow, flowLevel)
			}
			//Use else if and comparison against maxrun to go to the else in case of isNaN(maxrun)
			else if (flowLevel < river.maxrun && river.highflow) {
				running = 3+calculateRatio(river.highflow, river.maxrun, flowLevel)
			}
			else {
				running = null //We can't calculate a ratio, as we lack information. Example: only have minrun and flow above minrun.
			}
			
			oldRunning = running
			oldFlow = flowLevel
			
			return running
		}
	})
}


function calculateColor(river) {
    calculateRelativeFlow(river)

	if (river.running == null) {
		return ""
	}
	
	//Normal Flow lightness values
    let lightness = window.darkMode? "22%": "70%"	
	return "hsl(" + (0 + 60*river.running) + ",100%," + lightness + ")"
}

module.exports = {
	calculateColor,
	calculateAge,
	calculateDirection,
    calculateRelativeFlow
}
