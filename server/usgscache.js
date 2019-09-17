#!/usr/bin/node

//Use crontab @reboot to make this file run on reboots.

//Loads the latest USGS data and writes it to usgscache.json every 15 minutes.
//TODO: Calculate virtual gauges here. Reccomend Pitboss npm module for sandboxing.
//Also runs dataparse.js periodically to update the data on rivers.run.

const fs = require("fs")
const path = require("path")
const fetch = require("node-fetch")
const child_process = require("child_process")

//On reboot, and every 24 hours, run dataparse.js to keep the data on rivers.run current.
//Use child_process.execSync to allow for synchronus execution.
process.stdout.write("Generating riverdata.json - this may take a while (should be no more than 200 milliseconds per river)\n")
child_process.execSync("node " + path.join(__dirname, "dataparse.js"))
process.stdout.write("riverdata.json generated.\n")
setInterval(function() {
	child_process.execSync("node " + path.join(__dirname, "dataparse.js"))
}, 1000*60*60*24)


//Some actions should be performed at installation, but there is no need to start the server.
//Although I used to always start the server, an error in server.listen because of the port already being uesd
//lead to the entire program being terminated.
let notificationServer = require(path.join(__dirname, "notificationserver.js")) //On reboot, run notificationserver.js
if (process.argv[2] !== "--install") {notificationServer()}

const sendNotifications = require(path.join(__dirname, "sendnotifications.js"));

const flowDataParser = require(path.join(__dirname, "flowDataParser.js"))

const precompress = require(path.join(__dirname, "precompress.js")).compressFiles

const utils = require(path.join(__dirname, "utils.js"))


let virtualGauges;

try {
	virtualGauges = require(path.join(__dirname, "virtualGauges.js"))
}
catch(e) {
	console.error(e)
	fs.appendFileSync(path.join(utils.getLogDirectory(), "virtualGaugeError.log"), e.toString() + "\n")
}



fs.chmodSync(__filename, 0o775) //Make sure this file is executable. This will help prevent crontab setup issues.


async function updateCachedData() {
	console.log("Preparing flow data.\n")
	
	let riverarray = JSON.parse(await fs.promises.readFile(path.join(utils.getSiteRoot(), "riverdata.json"), {encoding:"utf8"}))

	let timeToRequest = 1000*86400 //Milliseconds of time to request

    var sites = []
    for (let i=0;i<riverarray.length;i++) {
		let values = [riverarray[i].usgs]
		riverarray[i].relatedusgs && values.concat(riverarray[i].relatedusgs)
		for (let i=0;i<values.length;i++) {
			let usgsID = values[i]
			if (!usgsID) {continue}
			sites.push(usgsID)
		}
    }
	
	//Don't ask USGS for non-USGS gauges.
	sites = sites.filter((usgsID) => {
		return usgsID.length > 7 && usgsID.length < 16 && !isNaN(Number(usgsID))
	})
	
	if (virtualGauges) {
		sites = sites.concat(await virtualGauges.getRequiredGauges())
	}

	//Filter out duplicate site names.
	sites = [...new Set(sites)];
	
	//TODO: Calls should be batched up. I believe that USGS has a url length limit of 4096 characters.
	//Probably use about 100-200 rivers per call due to performance reasons. When using 400, performance was almost 4 times worse.
    let url = "https://waterservices.usgs.gov/nwis/iv/?format=json&sites=" + sites.join(",") +  "&startDT=" + new Date(Date.now()-timeToRequest).toISOString()  + "&parameterCd=00060,00065,00010,00011,00045&siteStatus=all"

	let start = Date.now()

	let response = await fetch(url)
	let usgsData = await response.text()

	let time = Date.now() - start
	await fs.promises.appendFile(path.join(utils.getLogDirectory(), 'usgsloadingtime.log'), time + '\n');

	let flowdata2 = flowDataParser.reformatUSGS(flowDataParser.parseUSGS(JSON.parse(usgsData)))
	flowdata2.generatedAt = Date.now()
	
	if (virtualGauges) {
		console.log("Computing virtual gauges...")
		flowdata2 = await virtualGauges.getVirtualGauges(flowdata2)
		console.log("Virtual gauges computed...")
	}
	
	await fs.promises.writeFile(path.join(utils.getSiteRoot(), "flowdata2.json"), JSON.stringify(flowdata2))

	console.log("Flow data prepared.\n")
	
	//Run whenever the minutes on the hour is a multiple of 15.
	let currentTime = new Date()
	if (currentTime.getMinutes() === 0) {currentTime.setMinutes(15)}
	else {currentTime.setMinutes(Math.ceil(currentTime.getMinutes()/15)*15)}

	await fs.promises.appendFile(path.join(utils.getLogDirectory(), 'executiontimer.log'), (currentTime.getTime() - Date.now() + 60*1000) + '\n');


	//End install script
	if (process.argv[2] === "--install") {
		console.log("To update river and flow data in the future, run node usgscache.js --install (if you are running the server, data automatically updates).")
		process.exit()
	}
	
	sendNotifications()
	
	console.log("Precompressing files...")
	precompress(utils.getSiteRoot())
	
	let timer = setTimeout(updateCachedData, currentTime.getTime() - Date.now() + 60*1000) //Add a 1 minute delay to try and make sure that usgs has time to update. Do not think this is needed.
	console.log(timer)
}

updateCachedData()
