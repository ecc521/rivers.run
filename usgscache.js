#!/usr/bin/node
const fs = require("fs")
const path = require("path")
const fetch = require("node-fetch")

fs.chmodSync(__filename, 0o775) //Make sure this file is executable.

//TODO: Use crontab to schedule this to run on reboot.
//@reboot + " " + __filename

let riverarray;
{
	let window = {}
	eval(fs.readFileSync(path.join(__dirname, "riverarray.js")).toString()) //Defines window.riverarray.
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

	let start = Date.now()

	let response = await fetch(url)
	fs.writeFileSync(path.join(__dirname, "usgscache.json"), await response.text())

	let time = Date.now() - start
	fs.appendFileSync(path.join(__dirname, 'usgsloadingtime.log'), time + '\n');

	//Run whenever the minutes on the hour is a multiple of 15.
	let currentTime = new Date()
	if (currentTime.getMinutes() === 0) {currentTime.setMinutes(15)}
	else {currentTime.setMinutes(Math.ceil(currentTime.getMinutes/15)*15)}
	setTimeout(updateCachedData, currentTime.getTime() - Date.now() + 60*1000) //Add a 1 minute delay to try and make sure that usgs has time to update. Do not think this is needed.
}


updateCachedData()
