//These functions are used by River.js to calculate things based on a rivers flow.


function calculateDirection(siteCode, prop = "cfs") {
    let data = (usgsarray[siteCode] && usgsarray[siteCode].readings)
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
            return "⬆"
        }
        else if (previous > current) {
            //Water level falling
            return "⬇"
        }
        else if (current === previous && current != undefined) {
            //Water level stable
            return " –" //En dash preceeded by a thin space.
        }
    }
    if (prop === "cfs") {return calculateDirection(siteCode, "feet")}
}




function calculateAge(usgsNumber) {
	//Returns millseconds old that USGS data is
    let usgsData = window.usgsarray[usgsNumber]
    if (usgsData) {
        let data = usgsData.readings
        if (data) {
            for (let i=data.length;i>=0;i--) {
                let item = data[i]
                if (!item) {continue}
                if (item.forecast) {continue}
                return Date.now() - Number(new Date(item.dateTime))
            }
        }
    }
    return null; //If we got here, there is not enough USGS data.
}

    //If we don't have some values, fill them in using logarithms
    //Although these calculations are not needed when flow is below minrun or above maxrun. they can be useful in
    //alerting people what values are being used, so that they can edit them if neccessary.



function logDist(low, high, ratio = 0.5) {
    //ratio is how a decimal between 0 and 1. 0.5 means to factor lowLog and highLog evenly. Values greater than 0.5 factor in highLog more, vice versa.
    let lowLog = Math.log10(low)
    let highLog = Math.log10(high)
    if (lowLog > highLog) {
        let temp = lowLog
		lowLog = highLog
		highLog = temp
    }
    return 10**(lowLog + (highLog - lowLog)*ratio)
}


	//Estmate all values, even if we do not have values on each side of them. This is actually quite accurate, although sometimes maxrun is far too high to
	//calculate the other values correctly. (the calculated maxruns are reasonable, but the provided maxruns are too high)
//TODO: Consider if we should blacklist the provided maxrun

	function calculateArrayPosition(arr, pos) {
		if (arr[pos]) {return arr[pos]} //The value is already in the array!

		//Find closest values on either side.
		let negativeOptions = []
		let positiveOptions = []
		arr.forEach((value, index) => {
			if (value) {
				let optionNum = index - pos
				if (optionNum > 0) {
					positiveOptions.push(index)
				}
				if (optionNum < 0) {
					negativeOptions.push(index)
				}
			}
		})

		//Sort positiveOptions ascending.
		positiveOptions = positiveOptions.sort((a,b) => {return a-b})
		//Sort negativeOptions descending.
		negativeOptions = negativeOptions.sort((a,b) => {return b-a})

		//Get closest values, with one on each side if possible.
		let bottomPos = negativeOptions[0]
		let topPos = positiveOptions[0]

		bottomPos = bottomPos ?? positiveOptions[1]
		topPos = topPos ?? negativeOptions[1]

		if (topPos == undefined || bottomPos == undefined) {
			//We don't have enough datapoints - we need at least 2.
			return undefined;
		}

		//Note: topPos is not neccessarily greater than bottomPos
		let denominator = Math.abs(topPos - bottomPos)
		let numerator = pos-bottomPos

		return logDist(arr[topPos], arr[bottomPos], numerator/denominator)
	}


function calculateRelativeFlow(river) {
    //Defines river.running
    //0-4
    //0 is too low, 4 is too high, other values in between

	if (river.relativeFlowType || river.relativeFlowType === null) {
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

	river.relativeFlowType = type || null

	if (!type) {
		return null //If no relative flow values exist, return. This should help improve performance with gauges (lots of gauges, none have relative flows)
	}


    river.minrun = calculateArrayPosition(values, 0)
    river.maxrun = calculateArrayPosition(values, 4)

	//Use getters so that we only compute a property when neccessary.
	    Object.defineProperty(river, "midflow", {
			configurable: true,
			get: function getMidflow() {
				delete river.midflow
				return river.midflow = calculateArrayPosition(values, 2)
			}
		})


		Object.defineProperty(river, "lowflow", {
			configurable: true,
			get: function getLowflow() {
				delete river.lowflow
				return river.lowflow = calculateArrayPosition(values, 1)
			}
		})

		Object.defineProperty(river, "highflow", {
			configurable: true,
			get: function getHighflow() {
				delete river.highflow
				return river.highflow = calculateArrayPosition(values, 3)
			}
		})


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
    		//This would also help in determining if something is just barely
    		//too low, and may come up with rain, or is truely too low. (when using flow sort)


			//Use or equal to
			//While that technically may not be correct (says that river is too low at minrun), it makes no significant difference
			//In addition, values equal to minrun or maxrun result in a river.running of 0 or 4
			//Meaning that they may be included in the middle of a darker highlighted rivers
			//When sorting by runnability is used.

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
				running = null //We can't calculate a ratio, as we lack information.
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
