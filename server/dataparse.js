const fs = require("fs")
const path = require("path")
const bent = require("bent")

const compressor = require(path.join(__dirname, "precompress.js"))

const getGaugeSites = require(path.join(__dirname, "siteDataParser.js"))

const utils = require(path.join(__dirname, "utils.js"))

const googlecloudrequestrate = 10;
const API_KEY = "AIzaSyD-MaLfNzz1BiUvdKKfowXbmW_v8E-9xSc"


function urlcreate(File_ID, mime="text/plain") {
	mime = encodeURIComponent(mime)
    return 'https://www.googleapis.com/drive/v3/files/' + File_ID + '/export?mimeType=' + mime + '&key=' + API_KEY
}

function wait(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
};

async function load(url, attempts = 0) {
	//TODO: Handle requests that take unreasonably long to reply (as of 15+ seconds)
	try {
		return await bent("string", url)()
	}
	catch (e) {
		if (attempts++ > 10) {
			console.error("Repeatedly Failed on " + url)
			throw "Repeatedly Failed on " + url
		}
		else if (e.statusCode == 404) {
			console.log("URL does not exist " + url)
			throw "URL does not exist " + url
		}
		else if (e.statusCode == 400) {
			console.log("400 Bad Request for " + url)
			throw "400 Bad Request for " + url
		}
		else {
			//e.statusCode == 403
			//e.statusCode == 500
			//ECONNRESET
			//ETIMEDOUT
			await wait(1000/googlecloudrequestrate * 1.5 ** attempts) //Mild exponential backoff.
			return await load(url, attempts) //We hit the quota. Time to retry.
		}
	}
}

async function loadFromDisk(id, lastModified = 0, mime="text/plain") {
	mime = mime.split("/").join("_")
    let filename = path.join(utils.getDataDirectory(), "drivecache", mime, id)
    //Add 5 minutes because it takes some time to download - so a file may be written to disk a minute or so after it is downloaded.
    //This is overly cautious - a freak scenario is required, and it should only be a few seconds for this to happen.
    if (fs.existsSync(filename) && fs.statSync(filename).mtime.getTime() > new Date(lastModified).getTime()+1000*60*5) {
        return await fs.promises.readFile(filename, "utf8")
    }
    else {return false} //The cache is old.
}

async function writeToDisk(data, id, mime="text/plain") {
	mime = mime.split("/").join("_")
    let directory = path.join(utils.getDataDirectory(), "drivecache", mime)
    if (!fs.existsSync(directory)) {fs.mkdirSync(directory, {recursive: true})}
    let filename = path.join(directory, id)
    //Avoid unneeded writes to the disk - although this may be done already.
    if (!fs.existsSync(filename) || data !== await fs.promises.readFile(filename, "utf8")) {
        await fs.promises.writeFile(filename, data)
    }
}



    async function getFilesInFolder(id, output = [], promises=[], wasFirst = true) {
        //Use fields=* to get all fields.
        //Do not cache directory requests - last modified dates of files inside will be wrong (folder last modified is when files last added/removed).
		//wasFirst is used so the Promise.all call only happens on the first invocation, which was not added to the promises list. Otherwise they all lock up waiting on each other.
		let text = await load("https://www.googleapis.com/drive/v3/files?fields=incompleteSearch,files(mimeType,modifiedTime,id,name)&pageSize=1000&q='" + id + "'+in+parents&key=" + API_KEY)
		let obj = JSON.parse(text)
        if (obj.incompleteSearch) {console.warn("Search may have been incomplete")}

        let files = obj.files

        for (let i=0;i<files.length;i++) {
            let file = files[i]

            if (file.mimeType === "application/vnd.google-apps.folder") {
                promises.push(getFilesInFolder(file.id, output, promises, false))
            }
			//Exports only support Google Docs
            else if (file.mimeType === "application/vnd.google-apps.document") {
                output.push(file)
            }
            else {
            	console.warn("Non Google Doc found in folder with name " + file.name + " and id " + file.id + ". MIME type was " + file.mimeType)
            }
        }
        if (wasFirst) {await Promise.all(promises)}
        return output
    }



function loadFiles(files, mime) {

	let complete = []
	let failed = []

    async function loadText(file, mime="text/plain") {
        try {
            let request = await loadFromDisk(file.id, file.modifiedTime, mime) //Load file from disk if it is cached, and hasn't been modified
            if (!request) {
                request = await load(urlcreate(file.id, mime))
                await writeToDisk(request, file.id, mime)
            }
            complete.push({id: file.id, request, name:file.name})
            process.stdout.write("\r\033[2K") //Clear current line
            process.stdout.write(complete.length + " of " + files.length + " items have now been loaded successfully!")
        }
        catch(e) {
            console.error(e)
            failed.push({id: file.id, request, name:file.name})
            console.warn("Requesting the file with a fild id of " + file.id + " failed. The response is below")
            console.warn(request)
        }
    }

	let promises = []
    for (let i=0;i<files.length;i++) {
        promises.push(loadText(files[i], mime))
    }

	return {promises, complete, failed}
}



async function loadOverviews() {
	console.log("Loading overviews")
	let overviewsFolder = "1U3S5oxwqtnKJrIy7iDChmak2hvjekBBr"
	let files = await getFilesInFolder(overviewsFolder)

    let directory = path.join(utils.getSiteRoot(), "overviews")
    if (!fs.existsSync(directory)) {fs.mkdirSync(directory)}

	let result = loadFiles(files, "text/html")
	await Promise.allSettled(result.promises)

	console.log("")

    for (let i=0;i<result.failed.length;i++) {
        console.error("Loading of file with file id of " + result.failed[i] + " failed.")
    }

	for (let i=0;i<result.complete.length;i++) {
		let item = result.complete[i]

		//Remove slashes from paths.
		item.name = item.name.trim().split("/").join("_")

		//Add edit this river link.
		let output = `<a href="https://docs.google.com/document/d/${item.id}" target="_blank">Edit this Overview</a><br><br>` + item.request

		//Resolve Google Open Redirect URLs
		output = output.replace(/(?:https:\/\/www.google.com\/url\?q=)(.+?)(?:&[^"']+)/g, function(matchedString, group1) {
			return decodeURIComponent(group1)
		})

		await fs.promises.writeFile(path.join(directory, item.name), output)
	}
	//TODO: Overviews should be served from a seperate domain so that they couldn't modify the site context, even if opened in a new tab.
	console.log("Overviews loaded successfully")
}



async function prepareRiverData({
	includeUSGSGauges = true,
	includeCanadianGauges = false,
	includeIrishGauges = false,
}) {

	await loadOverviews()

	console.log("Generating riverdata.json - this may take a while (should be no more than 200 milliseconds per river)\n")
    let writeupFolder = "1L4pDt-EWGv6Z8V1SlOSGG6QIO4l2ZVof"
    console.log("Getting List of Rivers...")
    let files = await getFilesInFolder(writeupFolder)

    await wait(1000) //Let quota refresh

    console.log("Loading Rivers...")

    let result = loadFiles(files, "text/plain")

    await Promise.allSettled(result.promises)

    console.log("") //Make sure the next statement starts on a new line.

    for (let i=0;i<result.failed.length;i++) {
        console.error("Loading of file with file id of " + result.failed[i] + " failed.")
    }

    console.log("Finished Loading Rivers...")

    let allowed = ["name","section","skill","rating","writeup","tags","state","gauge","aw","plat","plon","tlat","tlon","hidlat","hidlon","maxrun","minrun","lowflow","midflow","highflow","dam","relatedgauges","averagegradient","maxgradient","class"] //Property values to be included in output file


    for (let i=0;i<result.complete.length;i++) {
        let item = result.complete[i].request.split("\n")
        let obj = {}

        for (let i=0;i<item.length;i++) {
            let prop = item[i]
            let name = prop.slice(0,prop.indexOf(":")).trim().toLowerCase()
            let value = prop.slice(prop.indexOf(":") + 1).trim()

			value = value.replaceAll(`“`, `"`).replaceAll(`”`, `"`).replaceAll(`‘`, `'`).replaceAll(`’`, `'`) //Replace so called "smart-quotes"

            obj[name] = value
        }

		//Convert .usgs parameter to .gauge
		if (!obj.gauge && obj.usgs) {
			obj.gauge = "USGS:" + obj.usgs
		}

		if (obj.gauge) {
			obj.gauge = obj.gauge.split(/\s*:\s*/).join(":") //Remove the spaces next to the semicolon.
		}

		//Convert gauge IDs to upperCase.
		if (obj.gauge &&
			(
				obj.gauge.toUpperCase().startsWith("USGS:") ||
				obj.gauge.toUpperCase().startsWith("NWS:")
			)
		) {
			obj.gauge = obj.gauge.toUpperCase()
		}

		//Convert relatedusgs to relatedgauges
		if (obj.relatedusgs) {
			try {
				obj.relatedgauges = JSON.stringify(JSON.parse(obj.relatedusgs).map((gaugeID) => {
					return "USGS:" + gaugeID
				}))
			}
			catch(e) {console.error(e)}
		}

		if (obj.relatedgauges) {
			try {
				obj.relatedgauges = JSON.parse(obj.relatedgauges).map((gaugeID) => {
					gaugeID = gaugeID.split(/\s*:\s*/).join(":")
					if (
						gaugeID.toUpperCase().startsWith("NWS:")
						|| gaugeID.toUpperCase().startsWith("USGS:")
					) {return gaugeID.toUpperCase()}
					else {return gaugeID}
				})
				obj.relatedgauges = obj.relatedgauges.filter((gaugeID) => {
					//Remove all gauges that are empty (ex. "USGS:" or "NWS:")
					if (gaugeID.trim().indexOf(":") + 1 === gaugeID.length) {return false}
					return true
				})
				if (obj.relatedgauges.length === 0) {delete obj.relatedgauges} //If there are no gauges, don't bother with the property.
			}
			catch(e) {console.error(e);console.log(obj)}
		}

		if (obj.class) {
			obj.class = obj.class
				.replaceAll("1", "I")
				.replaceAll("2", "II")
				.replaceAll("3", "III")
				.replaceAll("4", "IV")
				.replaceAll("5", "V")
				.replaceAll("6", "VI")
		}


		for (let prop in obj) {
			if (!allowed.includes(prop)) {
				delete obj[prop]
			}
		}

        //Some properties need to be defined in file, even if blank.
        ["name", "section"].forEach((prop) => {
            if (!obj[prop]) {
                obj[prop] = ""
            }
        })

		obj.id = result.complete[i].id

        result.complete[i] = obj
    }

    allowed.forEach((name) => {
        console.log("There are " + result.complete.reduce((total,river) => {return total + Number(!!river[name])},0) + " rivers with the property " + name)
    })

	if (includeUSGSGauges) {
		console.log("Adding USGS gauge sites. Pass --noUSGSGauges to prevent this. ")
		result.complete = result.complete.concat(await getGaugeSites.getSites())
		console.log("There are now " + result.complete.length + " rivers.")
	}
	else {
		console.log("Not including USGS gauges since --includeUSGSGauges was not passed. ")
	}

	if (includeCanadianGauges) {
		console.log("Adding Canadian gauge sites. Pass --noCanadianGauges to prevent this. ")
		result.complete = result.complete.concat(await getGaugeSites.getCanadianGaugesInRiverFormat())
		console.log("There are now " + result.complete.length + " rivers.")
	}
	else {
		console.log("Not including Canadian gauges since --includeCanadianGauges was not passed. ")
	}

	if (includeIrishGauges) {
		console.log("Adding Irish gauge sites. Pass --noIrishGauges to prevent this. ")
		result.complete = result.complete.concat(await getGaugeSites.getIrishGaugesInRiverFormat())
		console.log("There are now " + result.complete.length + " rivers.")
	}
	else {
		console.log("Not including Irish gauges since --includeIrishGauges was not passed. ")
	}

	let riverDataPath = path.join(utils.getSiteRoot(), "riverdata.json")
    await fs.promises.writeFile(riverDataPath, JSON.stringify(result.complete))

	console.time("Initial compression run on riverdata.json")
	await compressor.compressFile(riverDataPath, 9, {ignoreSizeLimit: true, alwaysCompress: false})
	console.timeEnd("Initial compression run on riverdata.json")

	console.log("riverdata.json generated")
}

module.exports = prepareRiverData
