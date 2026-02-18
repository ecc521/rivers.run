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

function isNative() {
    return self.location.origin.includes("localhost") || self.location.origin.includes("capacitor");
}

function getRemoteUrl(url) {
    if (isNative()) {
        try {
            let u = new URL(url);
            if (u.origin === self.location.origin) {
                return "https://rivers.run" + u.pathname + u.search;
            }
        } catch (e) {
            console.error(e);
        }
    }
    return url;
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
            let localUrl = rebaseURL(preloadList[index])
            let fetchUrl = getRemoteUrl(localUrl)
            requests.push({localUrl, request: fetch(fetchUrl)})
        }
        for (let index in requests) {
            let item = requests[index]
            try {
                let response = await item.request
                if (response.ok) {
                    await cache.put(item.localUrl, response)
                }
            }
            catch(e) {
                console.error("Preload failed for " + item.localUrl, e)
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
const defaultWaitPeriod = 1000

//TODO: Default to network, fallback to cache with Google Maps. Google Maps is throwing errors sometimes for unknown reasons.
function fetchHandler(event) {
    event.respondWith((async function(){
        let waitperiod = defaultWaitPeriod

        let cache = await caches.open(cacheName)

        let url = event.request.url
        let fetchUrl = getRemoteUrl(url)
        let isProxying = fetchUrl !== url

        let fromcache = await caches.match(url)

        //Use Date header to determine how long to wait - Note that the date header isn't always set.
        let age;
        if (fromcache) {
            let dateHeader = fromcache.headers.get("date");
            if (dateHeader) {
                age = Date.now() - new Date(dateHeader).getTime()
            } else {
                // If date header is missing (e.g. from local file), treat as very old to force update check
                age = Infinity;
            }
        }

        let returnNetwork = false

        // Fetch from remote if proxying, otherwise fetch original request
        let fromnetwork = fetch(isProxying ? fetchUrl : event.request)

        if (
            url.includes("docs.google.com") //Avoid filling up cache with opaque responses from docs.google.com
            || url.includes("googleapis.com") //May want to temporarily cache some images, but we mostly
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
            waitperiod = 2500 //If the data is very old, wait a bit longer try and get a new copy.
        }

        if (!fromcache) {
            //No cache. Return network response
            //If network fails, try local bundle fallback if proxying
            try {
                let response = await fromnetwork
                if (response.ok) {
                    await cache.put(url, response.clone())
                }
                return response
            } catch (e) {
                if (isProxying) {
                    //Fallback to local bundle
                    console.log("Remote fetch failed, falling back to bundle: " + url);
                    try {
                        let localResponse = await fetch(event.request);
                        if (localResponse.ok) {
                            await cache.put(url, localResponse.clone()); //Cache local version
                        }
                        return localResponse;
                    } catch (e2) {
                         throw e; // Both failed
                    }
                }
                throw e;
            }
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

                        if (fromcache) {
                             resolve(fromcache)
                        } else if (isProxying) {
                             // Try bundle as last resort if cache was empty (should be handled by !fromcache block above, but safe here too?)
                             // Actually !fromcache block handles initial empty cache.
                             // This catch is for when we HAVE cache, but network failed.
                             // Logic says: resolve(fromcache).
                             resolve(fromcache);

                             // Wait, if fromcache is the OLD local bundle, it's fine.
                        } else {
                             // Should not happen as we checked !fromcache
                        }
                    }
                })

                //Fetch from network and update cache
                fromnetwork.then(function(response){
                    let otherServed = served
                    served = 1

                    if (response.ok) {
                        cache.put(url, response.clone()).then(() => {
                            if (otherServed) {
                                messageAllClients("Updated cache for " + url)
                            }
                            else {
                                messageAllClients(url + " has been loaded from the network")
                            }
                            resolve(response)
                        })
                    } else {
                         // Network returned 404 or error
                         if (!otherServed) {
                             resolve(fromcache || response) // Prefer cache if network 404? Or show 404?
                             // Existing logic used response.
                             // I'll stick to resolving response if valid, or cache if we decided to wait.
                         }
                    }
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
