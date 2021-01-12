//Load flow information from USGS (United States Geological Survey)

const fs = require("fs")
const path = require("path")

const bent = require("bent")

const utils = require(path.join(__dirname, "../", "utils.js"))

function parseUSGS(usgsdata) {

    let usgsarray = {}
    //Iterate through all known conditions
    usgsdata.value.timeSeries.forEach(function(event){
        let obj2 = {}
        obj2.values = event.values[0].value //The values - ex. Gauge Height Array

        if (obj2.values.length === 0) {
            return;
        }

        obj2.units = event.variable.variableDescription //Units of values

        let sitecode = event.sourceInfo.siteCode[0].value
        //See if the site is already in the array.
        //If the site code is not in the array, add it.
        if (!usgsarray[sitecode]) {
            let obj3 = {}
            obj3.name = event.sourceInfo.siteName
            usgsarray[sitecode] = obj3
        }

        let variablecode = event.variable.variableCode[0].value

        //Convert celcius to farenheight
        let tempConvert;
        if (variablecode === "00010" && obj2.units === "Temperature, water, degrees Celsius") {
            obj2.units = "Temperature, water, degrees Fahrenheit"
            tempConvert = true
        }

        let valid = false;
          for (let i=0;i<obj2.values.length;i++) {
              //Make sure the value is a number.
			  	obj2.values[i].value = Number(obj2.values[i].value)

              //If the value is clearly a messed up value (usually because USGS intentially made it absurd to alert of an issue), discard it.
			  //USGS usually uses -999999 to mark these (I don't think this happens all the time)- however some tidal gauges will go negative for inflow, so
			  //we can't just check for values below -50, etc.
				if (obj2.values[i].value === -999999 || isNaN(obj2.values[i].value)) {
					delete obj2.values[i]
                    continue;
				}

            if (tempConvert) {
                obj2.values[i].value = obj2.values[i].value * 1.8 + 32 //Convert celcius to farenheight
                obj2.values[i].value = Math.round(obj2.values[i].value*100)/100 ///Make sure we don't get xx.000000000001 or the like by rounding to 100ths place.
            }
            delete obj2.values[i].qualifiers //rivers.run doesn't check this. Always seen it saying data is provisional, and nothing else.
            obj2.values[i].dateTime = new Date(obj2.values[i].dateTime).getTime() //Reformat to decimal based time.

            valid = true
          }

          if (!valid) {return}

		//Some rivers have code 00011 instead of 00010 (like the Yough).
		//00011 is farenheit, instead of celcius like 00010, so we don't need to
		//run any conversions on 00011. Just use instead of 00010.
		//TODO: Check code. Probably "Temperature, water, degrees Fahrenheit"
        if (variablecode === "00011") {
			//console.log("Using code 00011 to fill temperature")
            variablecode = "00010" //We use 00010 to represent farenhiet.
        }

        //Add the values onto the site code object
        usgsarray[sitecode][variablecode] = obj2
    })

    return usgsarray
}


function reformatUSGS(usgsarray) {
	for (let gaugeID in usgsarray) {
		let gauge = usgsarray[gaugeID]

		if (gauge["00060"]) {
			gauge.cfs = gauge["00060"].values
			delete gauge["00060"]
		}

		if (gauge["00065"]) {
			gauge.feet = gauge["00065"].values
			delete gauge["00065"]
		}

		if (gauge["00010"]) {
			gauge.temp = gauge["00010"].values
			delete gauge["00010"]
		}

		if (gauge["00045"]) {
			gauge.precip = gauge["00045"].values
			delete gauge["00045"]
		}
	}
	return usgsarray
}

//Reformat for flowdata3.json
//This combines the cfs, feet, temp, and precip properties into one array.

function reformatGauge(gauge) {
	let times = {}
	let toCombine = ["cfs", "feet", "temp", "precip"]
	toCombine.forEach((prop) => {
		if (!gauge[prop]) {return}
		gauge[prop].forEach((value) => {
			times[value.dateTime] = times[value.dateTime] || {}
			times[value.dateTime][prop] = value.value
		})
	})

	toCombine.forEach((prop) => {delete gauge[prop]})

	gauge.readings = []
	for (let prop in times) {
        let reading = {}
        reading.dateTime = Number(prop) //Prop appears to be getting converted to a string. Convert it back to a number.
		Object.assign(reading, times[prop])
		gauge.readings.push(reading)
	}
	return gauge
}

function reformatGauges(gauges) {
	for (let id in gauges) {
		gauges[id] = reformatGauge(gauges[id])
	}
	return gauges
}


let getJSON = bent("json", "https://waterservices.usgs.gov/nwis/iv/")
async function _loadSitesFromUSGS(siteCodes, timeInPast) {
	//USGS does not appear to send flow predictions at the moment.

    let period = "&period=" + Math.round(timeInPast / (1000*60*60)) + "H"

	let usgsData = await getJSON("?format=json&sites=" + siteCodes.join(",") + period + "&parameterCd=00060,00065,00010,00011,00045&siteStatus=all")

    //TODO: We should be able to consolidate these functions.
	return reformatGauges(reformatUSGS(parseUSGS(usgsData)))
}

async function loadSitesFromUSGS(siteCodes, timeInPast = 1000*60*60*24) {
    siteCodes = [...new Set(siteCodes)]; //Remove duplicate IDs
    let output = {}

    //Batch calls. I believe that USGS has a url length limit of 4096 characters, but they clearly have one (7000 characters failed).
	//Use ~150 rivers/call. When using 400, performance was almost 4 times worse than 100-200 rivers/call.

    let start = 0
    let sitesPerBatch = 150
    while (start < siteCodes.length) {
        let end = start + sitesPerBatch
        let arr = siteCodes.slice(start,end)
        console.log("Loading sites " + start + " through " + Math.min(end, siteCodes.length) + " of batch of " + siteCodes.length + " gauges.")

        //Try up to 5 times.
    	for (let i=0;i<5;i++) {
    		try {
                let newSites = await _loadSitesFromUSGS(siteCodes, timeInPast)
                Object.assign(output, newSites)
                break;
    		}
    		catch(e) {
    			console.error(e)
    			await new Promise((resolve, reject) => {setTimeout(resolve, 2000)}) //2 second delay before retrying.
    		}
    	}

        start = end
    }

    for (let siteCode in output) {
        output[siteCode].source = {
            link: "https://waterdata.usgs.gov/nwis/uv?site_no=" + siteCode,
            text: "View this gauge on USGS"
        }
    }

    return output
}

//TODO: Add a function to load a single site.


module.exports = {
	parseUSGS,
	reformatUSGS,
    loadSitesFromUSGS
}
