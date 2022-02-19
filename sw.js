function messageAllClients(message) {
    return self.clients.matchAll().then(clients => {
        clients.forEach(client => client.postMessage(message));
    })
}

const cacheName = "rivers.run"
const waitOnFirstLoad = 2500 //Milliseconds to wait before fetching items on preload list. Helps prevent duplicate requests on first load.

//Array of items to try and preload on install (the serviceWorker will install without them preloaded). Can be exact or relative to serviceWorker scope
const preloadList = [
    "",
    "about.html",
    "map.html", //Only load code for map page - not the Google Maps part.
    "packages/map.js",
    "clubs.html",
    "settings.html",
    "favorites.html",
    "FAQ.html",
    "index.css",
    "packages/allPages.js",
    "packages/index.js",
    "packages/favorites.js",
    "packages/map.js",
    "riverdata.json",
    "legal/Privacy Policy.html",
    "legal/Terms of Service.html",
    "legal/DISCLAIMER.html",
]

function rebaseURL(url) {
    //Fills in relative URLs using the serviceWorker scope
    return (new URL(url, registration.scope)).href
}

function activateHandler(event) {
    event.waitUntil((async function() {

        //Allow requests by the page to get into browser cache, so that we don't sent 2 requests for the same thing.
        await new Promise((resolve, reject) => {
            setTimeout(resolve, waitOnFirstLoad)
        })

        const cache = await caches.open(cacheName)
        let requests = []
        for (let index in preloadList) {
            let url = rebaseURL(preloadList[index])
            requests.push(fetch(url))
        }
        for (let index in requests) {
            let request = requests[index]
            try {
                let response = await request
                await cache.put(response.url, response)
            }
            catch(e) {
                console.error(e)
            }
        }
    })())
}



self.addEventListener("activate", activateHandler)


self.addEventListener("install", function() {
    self.skipWaiting()
})


//Milliseconds to wait for network response before using cache
//When set to 0, cached data will be returned immediately, and cache will be updated in background.
const defaultWaitPeriod = 0

//TODO: Default to network, fallback to cache with Google Maps. Google Maps is throwing errors sometimes for unknown reasons.
function fetchHandler(event) {
    event.respondWith((async function(){
        let waitperiod = defaultWaitPeriod

        let cache = await caches.open(cacheName)

        let url = event.request.url

        let fromcache = await caches.match(url)

        //If it is less than 5 minutes old, return the cached data.
        //Note that the date header isn't always set.
        let age;
        if (fromcache) {
            age = Date.now() - new Date(fromcache.headers.get("date")).getTime()
        }

        let returnNetwork = false

        let fromnetwork = fetch(event.request)

        if (
            url.includes("docs.google.com") //Avoid filling up cache with opaque responses from docs.google.com
            || url.includes("googleapis.com") //May want to temporarily cache some images, but we mostly
            || url.includes("ip2location")
            || url.includes("node")
            || url.includes("gaugeReadings")
            || url.includes("script.googleusercontent.com") //Don't store the unused results from writeupmaker uploads and submissions.
            || url.includes("ih3.googleusercontent.com")
            || url.includes("tile.openstreetmap.org") //Mapping code - Cached seperately
            || url.includes("mesonet1.agron.iastate.edu") //Weather maps - not cached.
            || url.includes("ggpht.com") //I believe this is street view. Don't cache.
        ) {

            returnNetwork = true

            //Override - Cache Google Maps JavaScript
            if (url.includes("maps.googleapis.com/maps/api/js?")) {
                //Main JavaScript file
                returnNetwork = "default"
            }

            if (url.includes("maps.googleapis.com") && url.includes(".js")) {
                //Auxillary JavaScript files.
                returnNetwork = "default"
            }
        }

        if (returnNetwork === true) {
            return fromnetwork
        }
        else if (returnNetwork === "default") {
            waitperiod = false //Wait for network to error before using cache.
        }
        else if (age > 60*1000*60*24*1) {
            waitperiod = 1000 //If the data is very old, wait a bit to try and get a new copy.
        }

        if (!fromcache) {
            //No cache. All we can do is return network response
            let response = await fromnetwork
            await cache.put(url, response.clone())
            return response
        }
        else {

            //We have cached data
            return new Promise(function(resolve, reject){

                let served = 0

                //If the fetch event fails (ex. offline), return cached immediately
                fromnetwork.catch(function(e){
                    messageAllClients(url + " errored. Using cache.")
                    if (!served) {
                        served = 1
                        resolve(fromcache)
                    }
                })

                //Fetch from network and update cache
                fromnetwork.then(function(response){
                    let otherServed = served
                    served = 1
                    cache.put(url, response.clone()).then(() => {
                        if (otherServed) {
                            messageAllClients("Updated cache for " + url)
                        }
                        else {
                            messageAllClients(url + " has been loaded from the network")
                        }
                        resolve(response)
                    })
                })


                //If the network doesn't respond quickly enough, use cached data
                if (waitperiod !== false) {
                    setTimeout(function(){
                        if (!served) {
                            served = 1
                            messageAllClients(url + " took too long to load from network. Using cache")
                            resolve(fromcache)
                        }
                    }, waitperiod)
                }
            })
        }
    }()))
}

self.addEventListener("fetch", fetchHandler)
