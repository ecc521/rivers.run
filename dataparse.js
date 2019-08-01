const fs = require("fs")
const path = require("path")

const fetch = require("node-fetch")

    let googlecloudrequestrate = 10;
    let API_KEY = "AIzaSyD-MaLfNzz1BiUvdKKfowXbmW_v8E-9xSc"


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
        let request = await fetch(url)
        if (request.ok) {
            return request
        }
        else if (attempts > 20) {
            console.error("Repeatedly 403'ed on " + url)
            throw "Repeatedly 403'ed on " + url
        }
        else if (request.status == 403) {
            await wait(1000/googlecloudrequestrate) //A queue should be used instead, but oh well.
            return load(url, attempts++) //We hit the quota. Time to retry.
        }
        else {
            console.log("Failed to load " + url)
            console.error(request)
            throw "Failed to request " + url
        }
    }

    function loadFromDisk(id, lastModified = 0) {
        let filename = path.join(__dirname, "drivecache", id)
        //Add 5 minutes because it takes some time to download - so a file may be written to disk a minute or so after it is downloaded.
        //This is overly cautious - a freak scenario is required, and it should only be a few seconds for this to happen.
        if (fs.existsSync(filename) && fs.statSync(filename).mtime.getTime() > new Date(lastModified).getTime()+1000*60*5) {
            return fs.readFileSync(filename, "utf8")
        }
        else {return false} //The cache is old.
    }

    function writeToDisk(data, id) {
        let directory = path.join(__dirname, "drivecache")
        if (!fs.existsSync(directory)) {fs.mkdirSync(directory)}
        let filename = path.join(directory, id)
        //Avoid unneeded writes to the disk - although this may be done already.
        if (!fs.existsSync(filename) || data !== fs.readFileSync(filename, "utf8")) {
            fs.writeFileSync(filename, data)
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
        let files = await getFilesInFolder(writeupFolder)
        console.log(files)

        await wait(1000) //Let quota refresh

        globalThis.complete = []
        globalThis.failed = []

        //TODO: Use modifiedTime to avoid loading some files.

        async function loadText(file) {
            try {
                let request;
                request = loadFromDisk(file.id, file.modifiedTime)
                if (!request) {
                    request = await load(urlcreate(file.id))
                    request = await request.text()
                    writeToDisk(request, file.id)
                }
                complete.push({id: file.id, request})
                console.log(complete.length + " items have now been loaded successfully!")
            }
            catch(e) {
                console.error(e)
                failed.push({id: file.id, request})
                console.warn("Requesting the file with a fild id of " + file.id + " failed. The response is below")
                console.warn(request)
            }
        }

        let promises = []
        for (let i=0;i<files.length;i++) {
            promises.push(loadText(files[i]))
            await wait(1000/googlecloudrequestrate)
        }

        await Promise.all(promises)

        for (let i=0;i<failed.length;i++) {
            console.error("Loading of file with file id of " + failed[i] + " failed.")
        }


        let allowed = ["name","section","skill","rating","writeup","tags","usgs","aw","plat","plon","tlat","tlon","hidlat","hidlon","maxrun","minrun","lowflow","midflow","highflow","dam","relatedusgs","averagegradient","maxgradient","class"] //Property values to be included in output file

        for (let i=0;i<complete.length;i++) {
            let item = complete[i].request.split("\n")
            let obj = {}
            obj.id = complete[i].id
            for (let i=0;i<item.length;i++) {
                let prop = item[i]
                let name = prop.slice(0,prop.indexOf(":"))
                name = name.toLowerCase()
                let value = prop.slice(prop.indexOf(":") + 1)

                //Google Docs adds \r terminators to the end
                if (value.endsWith("\r")) {
                    value = value.slice(0,-1)
                }
                value = value.trim()

                let keepnames = ["name", "section", "tags", "writeup"] //Some need to be defined in file, even if empty
                if (allowed.includes(name) && (String(value).length !== 0 || keepnames.includes(name))) {
                    obj[name] = value
                }
            }
            console.log(complete[i].id + ": " + obj.name + " " + obj.section)
            complete[i] = obj
        }

        allowed.forEach((name) => {
            console.log("There are " + complete.reduce((total,river) => {return total + Number(!!river[name])},0) + " rivers with the property " + name)
        })

        console.log(complete)
        let string = "window.riverarray = " + JSON.stringify(complete)
        fs.writeFileSync(path.join(__dirname, "riverarray.js"), string)
    }())
