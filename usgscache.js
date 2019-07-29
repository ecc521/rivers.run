const fs = require("fs")
const fetch = require("node-fetch")

let riverarray;
{
	let window = {}
	eval(fs.readFileSync("./riverarray.js").toString()) //Defines window.riverarray.
	riverarray = window.riverarray
}

async function updateCachedData() {
	let timeToRequest = 1000*86400 //Milliseconds of time to request

    var sites = []
    for (let i=0;i<riverarray.length;i++) {
		let values = [riverarray[i].usgs]
		riverarray[i].relatedusgs && values.concat(riverarray[i].relatedusgs)
		for (let i=0;i<values.length;i++) {
			let usgsID = values[i]
			if (!usgsID) {continue}
			//Gauges used by virtual gauges should be in relatedusgs
			//Basic value validation (throws out virtual gauges and clearly incorrect numbers.)
	        if (usgsID.length > 7 && usgsID.length < 16 && !isNaN(Number(usgsID))) {
	            (sites.indexOf(usgsID) === -1) && sites.push(usgsID) //Add the site if it doesn't exist in the list.
	        }
		}
    }
    let url = "https://waterservices.usgs.gov/nwis/iv/?format=json&sites=" + sites.join(",") +  "&startDT=" + new Date(Date.now()-timeToRequest).toISOString()  + "&parameterCd=00060,00065,00010,00045&siteStatus=all"

	let response = await fetch(url)
	fs.writeFileSync("./usgscache.json", await response.text())

	//Run whenever the minutes on the hour is a multiple of 15.
	let currentTime = new Date()
	if (currentTime.getMinutes() === 0) {currentTime.setMinutes(15)}
	else {currentTime.setMinutes(Math.ceil(currentTime.getMinutes/15)*15)}
	setTimeout(updateCachedData, currentTime.getTime() - Date.now() + 60*1000) //Add a 1 minute delay to try and make sure that usgs has time to update. Do not think this is needed.
}


updateCachedData()
