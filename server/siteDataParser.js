const fs = require("fs")
const path = require("path")

const bent = require("bent")

const utils = require(path.join(__dirname, "utils.js"))

const zlib = require("zlib")

const csvParser = require("csv-parser")
const toDecimalDegrees = require("../src/toDecimalDegrees.js")

const stateLookupTable = require(path.join(__dirname, "stateCodeLookupTable.js"))

const {getMetadata} = require(path.join(__dirname, "gauges", "irelandGauges.js"))


let sitesFilePath = path.join(utils.getDataDirectory(), "usgsSites.txt")

function fixCasing(str) {
   var splitStr = str.toLowerCase().split(' ');
   for (var i = 0; i < splitStr.length; i++) {
       splitStr[i] = splitStr[i].charAt(0).toUpperCase() + splitStr[i].substring(1);
   }
   return splitStr.join(' ');
}


let stateCodeToName = {}
for (let prop in stateLookupTable) {
    let stateCode = stateLookupTable[prop][0]
    let stateName = stateLookupTable[prop][1]
    stateCodeToName[stateCode] = stateName
}

stateCodeToName["FLA"] = "Florida" //USGS likes using this one in the gauge names, even though FL is correct.

function replaceStateNamesWithCodes(sentence, options = {}) {
    for (let stateCode in stateCodeToName) {
        if (stateCode === "FLA") {continue} //Officially FL. See above. Also, FLA contains FL.

        let stateName = stateCodeToName[stateCode]
        let expressionText = "\\b" + stateName + "\\b"
        //The following two options are used so that only the ending portion of things like Mississippi River At Example Mississippi is changed.
        if (options.onlyAtEnd) {expressionText += "$"} //State Name must be at end of sentence (don't match "North Fork Mississippi River")
        if (options.notStart) {expressionText = "(?!^)" + expressionText} //State name may not be at the start (don't match "Mississippi").
        sentence = sentence.split(new RegExp(expressionText,"i")).join(stateCode)
    }
    return sentence
}

function fixSiteName(siteName, options = {}) {
    siteName = siteName.split(/\bnr\b/i).join("near").split(/\bbl\b/i).join("below").split(/\bdnstrm\b/i).join("downstream").split(/\babv\b/i).join("above")
        .split(/\b@\b/).join("at").split(/\bS\b/).join("South").split(/\bN\b/).join("North").split(/\bE\b/).join("East").split(/\bW\b/).join("West")
        .split(/\bCr\b/i).join("Creek").split(/\bCk\b/i).join("Creek").split(/\bR\b/i).join("River").split(/\bCYN\b/i).join("Canyon").split(/\bSTA\b/i).join("Station")
        .split(/\bRv\b/i).join("River")

    siteName = fixCasing(siteName)
    //TODO: Add a way to convert from state name to state codes. This would help with searches where the user says the state name.
    if (siteName.endsWith(".")) {siteName = siteName.slice(0,-1)}

    let stateCode = siteName.split(/[ ,]+/)
    stateCode = stateCode[stateCode.length - 1].toUpperCase()
    let stateName = stateCodeToName[stateCode]
    //Make stateCode upperCase if convertStateCode is false. Otherwise, replace with stateName.
    if (stateName) {
        siteName = siteName.slice(0, -stateCode.length)
        if (options.convertStateCodeToName) {
            siteName += stateName
        }
        else {
            siteName += stateCode
        }
    }

    return siteName
}


async function downloadSitesFile() {
        //I believe we can get this url from https://waterdata.usgs.gov/nwis/current?submitted_form=introduction
        //Did not confirm that is the form to download a gauge list, however. 
		console.log("Downloading Gauge List from USGS (May take a while)")
		let url = "https://waterdata.usgs.gov/nwis/inventory?data_type=rt&data_type=peak&group_key=NONE&format=sitefile_output&sitefile_output_format=rdb_gz&column_name=site_no&column_name=station_nm&column_name=dec_lat_va&column_name=dec_long_va&column_name=state_cd&list_of_search_criteria=data_type"
        //The file is gzipped, so we have to unzip it.
		let unzipper = zlib.createGunzip()
		await new Promise((resolve, reject) => {
            bent(url)().then((stream) => {
				//TODO: Response is Gzipped. decompress.
				let dest = fs.createWriteStream(sitesFilePath)
				let writeStream = stream.pipe(unzipper).pipe(dest)
				writeStream.on("finish", resolve)
			})
		})
		console.log("Gauge List Downloaded")
}



async function getSites() {
	//Make sure we have the sites file.
	if (!fs.existsSync(sitesFilePath)) {
		console.log("Gauge sites file is not available. Running download script...")
		await downloadSitesFile()
	}

	//If the sites file is over 7 days old, download it again.
	let age = Date.now() - (await fs.promises.stat(sitesFilePath)).mtime

	if (age > 1000*60*60*24*7) {
		console.log("Gauge sites file is over " + Math.floor(age/1000/60/60) + " hours old. Running download script...")
		try {
			await downloadSitesFile()
		}
		catch(e) {
			console.error(e)
		}
	}

	let data = await fs.promises.readFile(sitesFilePath, {encoding: "utf8"})
	let lines = data.split("\n")
	let legendIndex = lines.lastIndexOf(lines[0]) + 1
	let somethingWeirdIndex = legendIndex + 1 //Looks like time durations - but not sure at all.
	let dataStartIndex = legendIndex + 2

	lines = lines.map((line) => line.split("\t"))

	let legend = lines[legendIndex]
	let riverData = lines.slice(dataStartIndex, -1) //The last line is messed up. It only has agency_cd defined.


	let newArr = []

	riverData.forEach((line) => {
		let obj = {}
		line.forEach((value, index) => {
			obj[legend[index]] = value
		})
		newArr.push(obj)
	})

	newArr.forEach((obj, index) => {
		let reducedObj = {}

		let siteName = obj.station_nm

		siteName = fixSiteName(siteName)

		let splitIndex = siteName.search(/ (?:below|above|near|at|downstream|north of|east of|south of|west of) /i)

        if (splitIndex === -1) {
            reducedObj.name = siteName
            reducedObj.section = ""
        }
        else {
            reducedObj.name = siteName.slice(0, splitIndex).trim()
    		reducedObj.section = siteName.slice(splitIndex).trim()
        }
		let stateCode = obj.state_cd
		if (stateLookupTable[stateCode]) {
			//The lookup table doesn't handle the very rare things like gauges in other countires.
			reducedObj.state = stateLookupTable[obj.state_cd][0]
		}
        reducedObj.gauge = "USGS:" + obj.site_no
        reducedObj.access = [{
            name: "Gauge",
            lat: toDecimalDegrees(obj.dec_lat_va),
            lon: toDecimalDegrees(obj.dec_long_va)
        }]
		newArr[index] = reducedObj
	})

	console.log(newArr.length + " sites found.")

	return newArr
}

//Canadaian Flow Data Gauges List
//https://wateroffice.ec.gc.ca/services/map_data
let canadaGaugesList = path.join(utils.getDataDirectory(), "canadaGaugesList.csv")

async function downloadCanadianGaugesList() {
    console.log("Downloading Canadian Gauges List...")
    let dest = fs.createWriteStream(canadaGaugesList)
    let stream = await bent("https://wateroffice.ec.gc.ca/services/map_data")()
    await new Promise((resolve, reject) => {
        let writeStream = stream.pipe(dest)
        writeStream.on("finish", resolve)
    })
    console.log("Canada gauges list downloaded")
}

async function getCanadianGauges(returnArray = false) {
    //Make sure we have the sites file.
    if (!fs.existsSync(canadaGaugesList)) {
        console.log("Canadian Gauges List is not available. Running download script...")
        await downloadCanadianGaugesList()
    }

    //If the sites file is over 7 days old, download it again.
    let age = Date.now() - (await fs.promises.stat(canadaGaugesList)).mtime

    if (age > 1000*60*60*24*7) {
        console.log("Canadian Gauges List is over " + Math.floor(age/1000/60/60) + " hours old. Running download script...")
        try {
            await downloadCanadianGaugesList()
        }
        catch(e) {
            console.error(e)
        }
    }


    let stationList = JSON.parse(await fs.promises.readFile(canadaGaugesList, {encoding: "utf8"}))
    let results = stationList.map((station) => {
      return {
        "id": station["station_id"],
        "name": station["station_name"],
        "lat": station["latitude"],
        "lon": station["longitude"],
        "province": station["province"],
      }
    })

    //Return the array of stations if requested
    if (returnArray) {return results}

    //Restructure the array into an object mapping station ID to the station details
    let obj = {}
    for (let prop in results) {
        obj[results[prop].id] = results[prop]
        delete obj[results[prop].id].id
    }
    return obj
}

async function getCanadianGaugesInRiverFormat() {
    //Convert the gauges to the site used in riverarray.
    let arr = await getCanadianGauges(true)
    arr = arr.map((site) => {
        site.state = site.province
        delete site.province
        site.name = fixCasing(site.name)

        let splitIndex = site.name.search(/ (?:below|above|near|at|downstream|north of|east of|south of|west of) /i)

        if (splitIndex === -1) {
            site.section = ""
        }
        else {
            site.section = site.name.slice(splitIndex).trim()
            site.name = site.name.slice(0, splitIndex).trim()
        }

        site.access = [{
            name: "Gauge",
            lat: toDecimalDegrees(site.lat),
            lon: toDecimalDegrees(site.lon),
        }]

        delete site.lat
        delete site.lon

        site.gauge = "canada:" + site.id
        delete site.id
        return site
    })
    return arr
}

async function getIrishGaugesInRiverFormat() {
    let metadata = await getMetadata()
    let arr = []
    for (let gaugeID in metadata) {
        let gauge = metadata[gaugeID]
        gauge.section = gauge.name
        gauge.gauge = "ireland:" + gaugeID
        gauge.name = "" //TODO: We currently have the Gauge location name, not the river name.
        arr.push(gauge)
    }
    return arr
}

module.exports = {
	getSites,
    fixSiteName,
	fixCasing,
    replaceStateNamesWithCodes,
    getCanadianGauges,
    getCanadianGaugesInRiverFormat,
    getIrishGaugesInRiverFormat
}
