const fs = require("fs")
const path = require("path")
const fetch = require("node-fetch")

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
    //TODO: Handle 500, internal server errors too. Google sends them somewhat commonly.
	//TODO: Handle requests that take unreasonably long to reply (as of 15+ seconds)
    let request = await fetch(url)
    if (request.ok) {
        return request
    }
    else if (attempts > 10) {
        console.error("Repeatedly 403'ed on " + url)
        throw "Repeatedly 403'ed on " + url
    }
    else if (request.status == 403) {
        await wait(1000/googlecloudrequestrate) //A queue should be used instead, but oh well.
        return await load(url, attempts++) //We hit the quota. Time to retry.
    }
    else {
        console.log("Failed to load " + url)
        console.error(request)
        throw "Failed to request " + url
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
    if (!fs.existsSync(directory)) {fs.mkdirSync(directory)}
    let filename = path.join(directory, id)
    //Avoid unneeded writes to the disk - although this may be done already.
    if (!fs.existsSync(filename) || data !== await fs.promises.readFile(filename, "utf8")) {
        await fs.promises.writeFile(filename, data)
    }
}



    async function getFilesInFolder(id, output = [], promises=[], wasFirst = true) {
        //Use fields=* to get all fields.
        //Do not cache directory requests - last modified dates of files inside will be wrong (folder last modified is when files last added/removed).
		//wasFirst is used so the Promise.all call only happens on the first invocation, which was not added to the primises list.
        let response = await load("https://www.googleapis.com/drive/v3/files?fields=incompleteSearch,files(mimeType,modifiedTime,id,name)&pageSize=1000&q='" + id + "'+in+parents&key=" + API_KEY)
        let obj = await response.json()

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
            let request;
            request = await loadFromDisk(file.id, file.modifiedTime, mime) //Load file from disk if it is cached, and hasn't been modified
            if (!request) {
                request = await load(urlcreate(file.id, mime))
                request = await request.text()
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
	
	/*let overviews = {}
	files.forEach((file) => {
		let name = file.name.trim()
		//Trim off extensions.
		name = name.match(/[^.]+/)[0]
		if (overviews[name]) {console.warn("Multiple writups had the same name of " + name + ". ")}
		overviews[name] = file.id
	})
    await fs.promises.writeFile(path.join(utils.getSiteRoot(), "overviews.json"), JSON.stringify(overviews))*/
	
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
	//TODO: Overviews should be served from a seperate domain so that they couldn't execute scripts, even if opened directly.
	console.log("Overviews loaded successfully")
}


(async function() {
	
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

    let allowed = ["name","section","skill","rating","writeup","tags","state","usgs","aw","plat","plon","tlat","tlon","hidlat","hidlon","maxrun","minrun","lowflow","midflow","highflow","dam","relatedusgs","averagegradient","maxgradient","class"] //Property values to be included in output file

    for (let i=0;i<result.complete.length;i++) {
        let item = result.complete[i].request.split("\n")
        let obj = {}
        obj.id = result.complete[i].id
        for (let i=0;i<item.length;i++) {
            let prop = item[i]
            let name = prop.slice(0,prop.indexOf(":")).trim().toLowerCase()
            let value = prop.slice(prop.indexOf(":") + 1).trim()

            obj[name] = value

            if (!allowed.includes(name)) {
                delete obj[name]
            }
        }

        //Some properties need to be defined in file, even if blank.
        ["name", "section"].forEach((prop) => {
            if (!obj[prop]) {
                obj[prop] = ""
            }
        })

        //console.log(complete[i].id + ": " + obj.name + " " + obj.section)
        result.complete[i] = obj
    }

    allowed.forEach((name) => {
        console.log("There are " + result.complete.reduce((total,river) => {return total + Number(!!river[name])},0) + " rivers with the property " + name)
    })

	if (process.argv[2] !== "--nogauges") {
		console.log("Adding gauge sites")
		result.complete = result.complete.concat(await getGaugeSites.getSites())
		console.log("There are now " + result.complete.length + " rivers.")
	}

    await fs.promises.writeFile(path.join(utils.getSiteRoot(), "riverdata.json"), JSON.stringify(result.complete))
	console.log("riverdata.json generated")
}())
