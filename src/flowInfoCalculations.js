//These functions are used by River.js to calculate things based on a rivers flow.

function calculateDirection(usgsNumber) {
    let usgsData = usgsarray[usgsNumber]
    if (usgsData) {

        let data = usgsData.cfs || usgsData.feet

        if (data) {
            let current;
            let previous;

            //TODO: Ignore insignificant changes.

            //We will go back 4 datapoints (1 hour) if possible.
            //Do this because USGS sometimes does 1 hour intervals instead of 15 minutes
            let stop = Math.max(data.length-5, 0)
            for (let i=data.length;i>stop;i--) {
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


    let values = ["minrun", "lowflow", "midflow", "highflow", "maxrun"]

    let type; //Currently, we skip a value if one datapoint is cfs and another feet

    for (let i=0;i<values.length;i++) {

        let str = river[values[i]]
        if (!str) {
            values[i] = undefined
            continue;
        }
        str = str.split("(computer)").join("")
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

        values[i] = value
    }

    let flow;
    if (type === "cfs") {
        flow = river.cfs
    }
    else if (type === "feet" || type==="ft") {
        flow = river.feet
    }


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

    let minrun = values[0]
    let maxrun = values[4]
    //For midflow, use the nearest values to calculate midflow.
    let midflow = values[2] //Prefer the specified midflow.
    midflow = midflow || logDist(values[1], values[3]) //Average lowflow and highflow
    midflow = midflow || logDist(values[0], values[3], 2/3) // two-thirds of the way between minrun and highflow
    midflow = midflow || logDist(values[1], values[4], 1/3) // one-third of the way between lowflow and maxrun
    midflow = midflow || logDist(minrun, maxrun) //Average minrun and maxrun.
    let lowflow = values[1] || logDist(minrun, midflow)
    let highflow = values[3] || logDist(midflow, maxrun)

    //Add computer generated properties to the river object so that they will display and people can see the values used in calculations.
    values[1] || (river.lowflow = parseFloat(lowflow.toFixed(2)) + type + " (computer)")
    values[2] || (river.midflow = parseFloat(midflow.toFixed(2)) + type + " (computer)")
    values[3] || (river.highflow = parseFloat(highflow.toFixed(2)) + type + " (computer)")


    if (flow <= minrun) {
        //Too low
        river.running = 0
    }
    else if (flow >= maxrun) {
        //Too high
        river.running = 4
    }
    else {

        function calculateRatio(low, high, current) {
            low = Math.log(low)
            high = Math.log(high)

            current = Math.log(current)


            let range = high-low
            let value = current-low

            return value/range

        }

        if (flow < lowflow && minrun) {
            river.running = calculateRatio(minrun, lowflow, flow)
        }
        else if (flow < midflow && lowflow) {
            river.running = 1+calculateRatio(lowflow, midflow, flow)
        }
        else if (flow < highflow && midflow) {
            river.running = 2+calculateRatio(midflow, highflow, flow)
        }
        //Use else if and comparison against maxrun to go to the else in case of isNaN(maxrun)
        else if (flow < maxrun && highflow) {
            river.running = 3+calculateRatio(highflow, maxrun, flow)
        }
        else {
            return null //We can't calculate a ratio, as we lack information. Example: only have minrun and flow above minrun.
        }
    }
    return river.running
}


function calculateColor(river, options) {
    //hsla color values
    //hsla(hue, saturation, lightness, opacity)
    //Saturation hue is 0 red 120 green 240 blue
    //Saturation - use 100%
    //Lightness - use 50%
    //Opacity - Decimal 0 to 1

    let relativeFlow = calculateRelativeFlow(river)

    if (relativeFlow === null) {
        return ""
    }
    else if (relativeFlow === 0) {
        //Too low
	    let lightness = (options && options.highlighted)? (window.darkMode? "28%": "63%"):  window.darkMode? "23%": "67%"
        return "hsl(0,100%," + lightness + ")"
    }
    else if (relativeFlow === 4) {
        //Too high
    	let lightness = (options && options.highlighted)? (window.darkMode? "30%": "67%"):  window.darkMode? "20%": "69%"
        return "hsl(240,100%," + lightness + ")"
    }
    else {
		//Normal Flow lightness values
		//Tough to see a difference when highlighted amount the more middle values in light mode.
    	let lightness = (options && options.highlighted)? (window.darkMode? "30%": "65%"): window.darkMode? "25%": "70%"
        return "hsl(" + (0 + 60*relativeFlow) + ",100%," + lightness + ")"
    }
}

module.exports = {
	calculateColor,
	calculateAge,
	calculateDirection,
    calculateRelativeFlow
}
