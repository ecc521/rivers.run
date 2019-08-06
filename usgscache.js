#!/usr/bin/node

//Use crontab @reboot to make this file run on reboots.

//Loads the latest USGS data and writes it to usgscache.json every 15 minutes.
//TODO: Calculate virtual gauges here. Reccomend Pitboss npm module for sandboxing.
//Also runs dataparse.js periodically to update the data on rivers.run.

const fs = require("fs")
const path = require("path")
const fetch = require("node-fetch")
const sendNotifications = require("./sendnotifications.js")
const flowDataParser = require("./flowDataParser.js")

fs.chmodSync(__filename, 0o775) //Make sure this file is executable.


//On reboot, and every 24 hours, run dataparse.js to keep the data on rivers.run current.
require("./dataparse.js") //
setInterval(function() {
	require("./dataparse.js")
}, 1000*60*60*24)


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
	let usgsData = await response.text()

	let time = Date.now() - start
	fs.appendFileSync(path.join(__dirname, 'usgsloadingtime.log'), time + '\n');

	fs.writeFileSync(path.join(__dirname, "usgscache.json"), usgsData)
	fs.writeFileSync(path.join(__dirname, "flowdata.json"), JSON.stringify(flowDataParser.parseUSGS(JSON.parse(usgsData))))
	sendNotifications()


	//Run whenever the minutes on the hour is a multiple of 15.
	let currentTime = new Date()
	if (currentTime.getMinutes() === 0) {currentTime.setMinutes(15)}
	else {currentTime.setMinutes(Math.ceil(currentTime.getMinutes()/15)*15)}

	fs.appendFileSync(path.join(__dirname, 'executiontimer.log'), (currentTime.getTime() - Date.now() + 60*1000) + '\n');


	let timer = setTimeout(updateCachedData, currentTime.getTime() - Date.now() + 60*1000) //Add a 1 minute delay to try and make sure that usgs has time to update. Do not think this is needed.
	console.log(timer)
}


updateCachedData()


require("./notificationserver.js")
//On reboot, run notificationserver.js
