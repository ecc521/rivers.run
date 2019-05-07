self.usgsarray = {}

window.updateOldDataWarning = function() {
	
		let toDelete = document.getElementById("topOldDataWarning")
		if (toDelete) {toDelete.remove()}
	
		//No reason to make an old data warning when data is new (within 1 hour)
		if (window.usgsDataAge < 1000*60*60 || !window.usgsDataAge) {
			return;
		}
	
		let oldDataWarning = document.createElement("p")
		oldDataWarning.id = "topOldDataWarning"
		
		oldDataWarning.innerHTML = "All river data is more than " + Math.floor(window.usgsDataAge/1000/60/60) + " hours old! "
		oldDataWarning.innerHTML += "(" + window.loadNewUSGS + ") "
		
					let reloadButton = document.createElement("button")

						reloadButton.addEventListener("click", function() {
							window.loadNewUSGS = "Trying to Load Data"
							require("./loadUSGS.js").loadUSGS()
							window.updateOldDataWarning()
						})
						reloadButton.innerHTML = "Try Again"
					

					oldDataWarning.appendChild(reloadButton)
		
		
		let legend = document.getElementById("legend")
		legend.parentNode.insertBefore(oldDataWarning, legend)
}




let loadUSGS = async function() {
	
	//Gaurd against infinite recursion. Ignores calls when data is new. (within 1 hour)
	if (window.usgsDataAge < 1000*60*60) {
		return;
	}

	let timeToRequest = 1000*86400 //Milliseconds of time to request
	
    var sites = []
    for (let i=0;i<riverarray.length;i++) {
        let val = riverarray[i].usgs
        //Check for accuracy
        if (val && val.length > 7 && val.length < 16) {
            sites.push(val)
        }
    }
    let url = "https://waterservices.usgs.gov/nwis/iv/?format=json&sites=" + sites.join(",") +  "&startDT=" + new Date(Date.now()-timeToRequest).toISOString()  + "&parameterCd=00060,00065,00010,00045&siteStatus=all"

    let usgsdata;
    if (window.fetch) {
        let response = await fetch(url)
        usgsdata = await response.json()
    }
    else {
        //For browsers that don't support fetch
        let request = new XMLHttpRequest()
        let response = await new Promise((resolve, reject) => {
            request.onload = function(event) {resolve(event.target.response)};
            request.open("GET", url);
            request.send()
        })
        usgsdata = JSON.parse(response)
    }

	
	window.usgsDataAge = Date.now() - new Date(usgsdata.value.queryInfo.note[3].value).getTime() //TODO: Iterate through note and find requestDT
	window.updateOldDataWarning()
	
	
    //Iterate through all known conditions
    usgsdata.value.timeSeries.forEach(function(event){
        let obj2 = {}
        obj2.values = event.values[0].value //The values - ex. Gauge Height Array

        if (obj2.values.length === 0) {
            console.log("Empty Array. Skipping")
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
        if (variablecode === "00010" && obj2.units === "Temperature, water, degrees Celsius") {
            for (let i=0;i<obj2.values.length;i++) {
                obj2.values[i].value = obj2.values[i].value * 1.8 + 32
            }

            obj2.units = "Temperature, water, degrees Fahrenheit"
        }


        //Add the values onto the site code object
        usgsarray[sitecode][variablecode] = obj2
    })

    //Add USGS Data to Graph
    for (let i=0;i<ItemHolder.length;i++) {
        let item = ItemHolder[i]
        let data = usgsarray[item.usgs]

        if (data) {
            let cfs = data["00060"]
            let feet = data["00065"]

            //Prevent "TypeError: Can't Read Property 'values' of undefined"
            if (cfs) {cfs = cfs.values}
            if (feet) {feet = feet.values}


            let latestCfs, latestFeet;
            if (cfs) {
                latestCfs = cfs[cfs.length - 1].value
            }
            if (feet) {
                latestFeet = feet[feet.length - 1].value
            }

            item.feet = latestFeet
            item.cfs = latestCfs

            if (latestCfs && latestFeet) {
                item.flow = latestCfs + "cfs " + latestFeet + "ft"
            }
            else if (latestCfs) {
                item.flow = cfs[cfs.length - 1].value + " cfs"
            }
            else if (latestFeet) {
                item.flow = feet[feet.length - 1].value + " ft"
            }

            //item.create(true) will force regeneration of the button
            //Replace the current button so that the flow info shows
            let elem = document.getElementById(item.base + "1")
            let expanded = item.expanded
            console.log(expanded)
            let replacement = item.create(true) //Update the version in cache
            try {
                elem.parentNode.replaceChild(replacement, elem)
                //If the river was expanded before, keep it expanded
                if (expanded) {
                    replacement.dispatchEvent(new Event("click"))
                    replacement.dispatchEvent(new Event("click"))
                }
            }
            catch (e) {} //The list must have been sorted - the node was not currently in list
        }
    }

}


export {
loadUSGS
}
