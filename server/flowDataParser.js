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

          for (let i=0;i<obj2.values.length;i++) {
            if (tempConvert) {
                obj2.values[i].value = obj2.values[i].value * 1.8 + 32 //Convert celcius to farenheight
                obj2.values[i].value = Math.round(obj2.values[i].value*100)/100 ///Make sure we don't get xx.000000000001 or the like by rounding to 100ths place.
            }
            delete obj2.values[i].qualifiers //rivers.run doesn't check this. Always seen it saying data is provisional, and nothing else.
            obj2.values[i].dateTime = new Date(obj2.values[i].dateTime).getTime() //Reformat to decimal based time.

			  //Convert the value to a number if it is a string.
			  if (!isNaN(Number(obj2.values[i].value))) {
			  	obj2.values[i].value = Number(obj2.values[i].value)
			  }

			  //If the value is clearly a messed up value (usually because USGS intentially made it absurd to alert of an issue), discard it.
			  //USGS usually uses -999999 to mark these (I don't think this happens all the time)- however some tidal gauges will go negative for inflow, so
			  //we can't just check for values below -50, etc.
				if (obj2.values[i].value === -999999) {
					delete obj2.values[i]
				}
          }

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




module.exports = {
	parseUSGS,
	reformatUSGS
}
