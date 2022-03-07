//These functions are used by River.js to calculate things based on a rivers flow.

function calculateDirection(siteCode, prop = "cfs") {
    if (gauges[siteCode]) {
        let trend = gauges[siteCode].calculateTrendDirection()

        if (trend > 0) {
            return "⬆"
        }
        else if (trend < 0) {
            return "⬇"
        }
        else {
            return " –" //En dash preceeded by a thin space.
        }
    }
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
	//calculate the other values correctly. (the calculated maxruns given midrun, etc, are reasonable, but the provided maxruns are too high to calculate other values)

	function calculateArrayPosition(arr, pos) {
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

		if (bottomPos == undefined) {bottomPos = positiveOptions[1]}
		if (topPos == undefined) {topPos = negativeOptions[1]}

		if (topPos == undefined || bottomPos == undefined) {
			//We don't have enough datapoints - we need at least 2.
			return undefined;
		}

		//Note: topPos is not neccessarily greater than bottomPos
        //This can occur when all values are either above or below.
		let denominator = Math.abs(topPos - bottomPos)
		let numerator = pos - Math.min(bottomPos, topPos)

		return logDist(arr[topPos], arr[bottomPos], numerator/denominator)
	}


function calculateRelativeFlow(river) {
    //Defines river.running
    //0-4
    //0 is too low, 4 is too high, other values in between

    if (river.relativeflowtype === null) {
        return;
    }


    let values = ["minrun", "lowflow", "midflow", "highflow", "maxrun"]

    //If the river does not have a relative flow type, calculate one.
    if (!river.relativeflowtype) {
        //THIS CODE CAN NOT MODIFY THE "values" ARRAY!
        let type; //Currently, we skip a value if one datapoint is cfs and another feet

        for (let i=0;i<values.length;i++) {
            let str = river[values[i]]
            if (!str) {continue;}

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
                continue;
            }

            river[values[i]] = value
        }

        river.relativeflowtype = type || null
    }


    if (!river.relativeflowtype) {
		return null //If no relative flow values exist, return. This should help improve performance with gauges (lots of gauges, none have relative flows)
	}
    else if (river.relativeflowtype === "ft") {
        river.relativeflowtype = "feet"
    }
    else if (river.relativeflowtype === "m") {
        river.relativeflowtype = "meters"
    }

    let currentMax; //Used to confirm values are not decreasing.

    //Every item has the same units.
    for (let i=0;i<values.length;i++) {
        let prop = values[i]
        values[i] = undefined

        let value = parseFloat(river[prop])
        if (!isNaN(value)) {
            if (value < currentMax) {
                console.warn(prop + " is smaller than a value that comes before it on " + river.name + " " + river.section + " and has been skipped")
                continue;
            }
            values[i] = currentMax = value
        }
    }


    ;["minrun", "lowflow", "midflow", "highflow", "maxrun"].forEach((prop, index) => {
        if (values[index]) {
            //We already have the value - no need to calculate, etc.
            river[prop] = values[index]
        }
        else {
            //Estimate value - leave as non-enumerable so that it is not indexed by writeupmaker, etc.
            Object.defineProperty(river, prop, {
                enumerable: false,
                value: calculateArrayPosition(values, index)
            })
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

			if (river.relativeflowtype === "cfs") {
				flowLevel = river.cfs
			}
			else if (river.relativeflowtype === "feet") {
				flowLevel = river.feet
			}
            else if (river.relativeflowtype === "meter"){
                flowLevel = river.meters
            }
            else if (river.relativeflowtype === "cms") {
                flowLevel = river.cms
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


function calculateColor(running) {
    //Returns color given decimal between 0 and 4, inclusive.
	if (running == null) {
		return ""
	}

    if (window.colorBlindMode) {
        //Orange Blue scale
        //Uses HSLs from legend, converted to RGB.
        let orange, blue;

        if (window.darkMode) {
            orange = [112, 56, 0]
            blue = [0, 0, 112]
        }
        else {
            orange = [255, 189, 122]
            blue = [153, 153, 255]
        }

        let res = orange.map((o, index) => {
            let b = blue[index]
            return (o * (4 - running) + b * running) / 4
        })

        return `rgb(${res.join(",")})`
    }
    else {
        let lightness;
        if (window.darkMode) {
            lightness = 22
        }
        else {
            lightness = 70

            //Dark blue is 80, dark red 74.
            if (running > 3) {
                lightness += 10 * (running - 3)
            }
            else if (running < 1) {
                lightness += 4 * (1 - running)
            }
        }
        return "hsl(" + (0 + 60 * running) + ",100%," + lightness + "%)"
    }
}

module.exports = {
	calculateColor,
	calculateDirection,
    calculateRelativeFlow
}
