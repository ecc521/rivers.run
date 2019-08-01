
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

    (async function() {

        //This is a bit *TOO* synchronus. All requests should be sent at once, then waited for
        async function getFilesInFolder(output, id) {
            //Use fields=* to get all fields.
            let response = await fetch("https://www.googleapis.com/drive/v3/files?fields=incompleteSearch,files(mimeType,modifiedTime,id)&pageSize=1000&q='" + id + "'+in+parents&key=" + API_KEY)
            let obj = await response.json()

            if (obj.incompleteSearch) {console.warn("Search may have been incomplete")}

            let files = obj.files

            for (let i=0;i<files.length;i++) {
                let file = files[i]

                if (file.mimeType === "application/vnd.google-apps.folder") {
                    await getFilesInFolder(output, file.id)
                }
                else if (file.mimeType === "application/vnd.google-apps.document") {
                    output.push(file)
                }
                else {
                    console.warn("Non Google Doc found in folder with name " + file.name + " and id " + file.id + ". MIME type was " + file.mimeType)
                }
            }

        }

        /*
        //Async version.
        //May not be resolving.
        async function getFilesInFolder(output, id, promises=[]) {
                    //Use fields=* to get all fields.
                    let response = await fetch("https://www.googleapis.com/drive/v3/files?fields=incompleteSearch,files(mimeType,modifiedTime,id)&pageSize=1000&q='" + id + "'+in+parents&key=" + API_KEY)
                    let obj = await response.json()

                    if (obj.incompleteSearch) {console.warn("Search may have been incomplete")}

                    let files = obj.files
        console.log(obj);console.log(files);
                    for (let i=0;i<files.length;i++) {
                        let file = files[i]

                        if (file.mimeType === "application/vnd.google-apps.folder") {
                        await wait(100)//TODO: Create a function that retries requests when they fail.
                            promises.push(getFilesInFolder(output, file.id, promises))
                        }
                        else if (file.mimeType === "application/vnd.google-apps.document") {
                            output.push(file)
                        }
                        else {
                            console.warn("Non Google Doc found in folder with name " + file.name + " and id " + file.id + ". MIME type was " + file.mimeType)
                        }
                    }
        			return await Promise.all(promises)
                }
        */

        let writeupFolder = "1L4pDt-EWGv6Z8V1SlOSGG6QIO4l2ZVof"
        let files = []
        await getFilesInFolder(files, writeupFolder)

        process.exit() //Testing.

        await wait(1000) //Let quota refresh

        self.retry  = []
        self.complete = []
        self.failed = []

        window.load = async function(id) {
            let request = await fetch(urlcreate(id))
            if (request.ok) {
                request = await request.text()
                complete.push({id, request})
                console.log(complete.length + " items have now been loaded successfully!")
            }
            else if (request.status == 403) {
                retry.push({id, request})
                console.log("403 error requesting the file with a file id of " + id)
            }
            else {
                failed.push({id, request})
                console.warn("Requesting the file with a fild id of " + id + " failed. The response is below")
                console.warn(request)
            }
        }


        //TODO: Use modifiedTime to avoid loading some files.
        let promises = []
        for (let i=0;i<files.length;i++) {
            promises.push(load(files[i].id))
            await wait(1000/googlecloudrequestrate)
        }

        for (let i=0;i<promises.length;i++) {
            await promises[i]
        }
        promises = []

        await wait(1000) //Let quota refresh

        for (let i=0;i<retry.length;i++) {
            promises.push(load(retry[i].id))
            //Use 2000 instead of the 1000 it should be- I want the retries to never 403
            await wait(2000/googlecloudrequestrate)
        }

        for (let i=0;i<promises.length;i++) {
            await promises[i]
        }
        promises = []

        for (let i=0;i<failed.length;i++) {
            console.error("Loading of file with file id of " + failed[i] + " failed.")
        }

        await wait(500) //Let requests finish

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

    }())
