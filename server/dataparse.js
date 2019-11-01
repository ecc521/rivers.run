const fs = require("fs")
const path = require("path")
const fetch = require("node-fetch")

const getGaugeSites = require(path.join(__dirname, "siteDataParser.js"))

const utils = require(path.join(__dirname, "utils.js"))

const googlecloudrequestrate = 10;
const API_KEY = "AIzaSyD-MaLfNzz1BiUvdKKfowXbmW_v8E-9xSc"


function urlcreate(File_ID) {
    return 'https://www.googleapis.com/drive/v3/files/' + File_ID + '/export?mimeType=text%2Fplain&key=' + API_KEY
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

async function loadFromDisk(id, lastModified = 0) {
    let filename = path.join(utils.getDataDirectory(), "drivecache", id)
    //Add 5 minutes because it takes some time to download - so a file may be written to disk a minute or so after it is downloaded.
    //This is overly cautious - a freak scenario is required, and it should only be a few seconds for this to happen.
    if (fs.existsSync(filename) && fs.statSync(filename).mtime.getTime() > new Date(lastModified).getTime()+1000*60*5) {
        return await fs.promises.readFile(filename, "utf8")
    }
    else {return false} //The cache is old.
}

async function writeToDisk(data, id) {
    let directory = path.join(utils.getDataDirectory(), "drivecache")
    if (!fs.existsSync(directory)) {fs.mkdirSync(directory)}
    let filename = path.join(directory, id)
    //Avoid unneeded writes to the disk - although this may be done already.
    if (!fs.existsSync(filename) || data !== await fs.promises.readFile(filename, "utf8")) {
        await fs.promises.writeFile(filename, data)
    }
}

(async function() {

    async function getFilesInFolder(id, output = [], promises=[], wasFirst = true) {
        //Use fields=* to get all fields.
        //Do not cache directory requests - last modified dates of files inside will be wrong (folder last modified is when files last added/removed).

        let response = await load("https://www.googleapis.com/drive/v3/files?fields=incompleteSearch,files(mimeType,modifiedTime,id)&pageSize=1000&q='" + id + "'+in+parents&key=" + API_KEY)
        let obj = await response.json()

        if (obj.incompleteSearch) {console.warn("Search may have been incomplete")}

        let files = obj.files

        for (let i=0;i<files.length;i++) {
            let file = files[i]

            if (file.mimeType === "application/vnd.google-apps.folder") {
                promises.push(getFilesInFolder(file.id, output, promises, false))
            }
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

    let writeupFolder = "1L4pDt-EWGv6Z8V1SlOSGG6QIO4l2ZVof"
    console.log("Getting List of Rivers...")
    let files = await getFilesInFolder(writeupFolder)

    await wait(1000) //Let quota refresh

    globalThis.complete = []
    globalThis.failed = []

    //TODO: Use modifiedTime to avoid loading some files.

    async function loadText(file) {
        try {
            let request;
            request = await loadFromDisk(file.id, file.modifiedTime)
            if (!request) {
                request = await load(urlcreate(file.id))
                request = await request.text()
                await wait(1000/googlecloudrequestrate)
                await writeToDisk(request, file.id)
            }
            complete.push({id: file.id, request})
            process.stdout.write("\r\033[2K") //Clear current line
            process.stdout.write(complete.length + " of " + files.length + " items have now been loaded successfully!")
        }
        catch(e) {
            console.error(e)
            failed.push({id: file.id, request})
            console.warn("Requesting the file with a fild id of " + file.id + " failed. The response is below")
            console.warn(request)
        }
    }

    console.log("Loading Rivers...")

    let promises = []
    for (let i=0;i<files.length;i++) {
        promises.push(loadText(files[i]))
    }

    await Promise.all(promises)

    process.stdout.write("\n") //Make sure the next statement starts on a new line.

    for (let i=0;i<failed.length;i++) {
        console.error("Loading of file with file id of " + failed[i] + " failed.")
    }

    console.log("Finished Loading Rivers...")

    let allowed = ["name","section","skill","rating","writeup","tags","state","usgs","aw","plat","plon","tlat","tlon","hidlat","hidlon","maxrun","minrun","lowflow","midflow","highflow","dam","relatedusgs","averagegradient","maxgradient","class"] //Property values to be included in output file

    for (let i=0;i<complete.length;i++) {
        let item = complete[i].request.split("\n")
        let obj = {}
        obj.id = complete[i].id
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
        complete[i] = obj
    }

    allowed.forEach((name) => {
        console.log("There are " + complete.reduce((total,river) => {return total + Number(!!river[name])},0) + " rivers with the property " + name)
    })

	if (process.argv[2] !== "--nogauges") {
		console.log("Adding gauge sites")
		complete = complete.concat(await getGaugeSites.getSites())
		console.log("There are now " + complete.length + " rivers.")
	}

    await fs.promises.writeFile(path.join(utils.getSiteRoot(), "riverdata.json"), JSON.stringify(complete))
}())
