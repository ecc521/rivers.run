//Name of cache to use
const cachename = "rivers.run"








//New Code

const cacheName = "rivers.run"
const waitOnFirstLoad = 2500 //Milliseconds to wait before fetching items on preload list. Helps prevent duplicate requests on first load.

//Array of items to try and preload on install (the serviceWorker will install without them preloaded). Can be exact or relative to serviceWorker scope
const preloadList = [
    "/",
    "about.html",
    "clubs.html",
    "settings.html",
    "FAQ.html",
    "index.css",
    "packages/allPages.js",
    "packages/index.js",
    "riverarray.js",
    "overviews.js",
    "resources/1Star.png",
    "resources/2Stars.png",
    "resources/3Stars.png",
    "resources/4Stars.png",
    "resources/5Stars.png"
]

function fetchHandler(event) {

}

function rebaseURL(url) {
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
                cache.put(response.url, response)
            }
            catch(e) {
                console.error(e)
            }
        }
    })())
}



self.addEventListener("activate", activateHandler)

//End of new code.











//Old code below.




//Milliseconds to wait for network response before using cache
const waitperiod = 2000


function fetchevent(event) {
    event.respondWith((async function(){
        let fromnetwork = fetch(event.request)
        let cache = await caches.open(cachename)

        let url = event.request.url
        let end = url.indexOf("?")
        if (end === -1) {end = url.length}
        url = url.slice(0, end) //Eliminate Query Parameter

		if (url.includes("docs.google.com")) {
			return fromnetwork
		}
		
		
        let fromcache = await caches.match(url)
		
        if (!fromcache) {
            //No cache. All we can do is return network response
            let response = await fromnetwork
            //Avoid filling up cache with opaque responses
            cache.put(url, response.clone())
            return response
        }
        else {

            //We have cached data
            return new Promise(function(resolve, reject){

                //Fetch from network and update cache
                fromnetwork.then(function(response){
                    console.log(url + " has been loaded from the network")
                    cache.put(url, response.clone())
                    console.log(url + " has been put into cache")
                    resolve(response)
                })

                //If the fetch event fails (ex. offline), return cached immediately
                fromnetwork.catch(function(e){
                    console.log(url + " errored when fetching from network. Using cache")
                    resolve(fromcache)
                })

                    //If the network doesn't respond quickly enough, use cached data
                    setTimeout(function(){
                        console.log(url + " took too long to load from network. Using cache")
                        resolve(fromcache)
                    }, waitperiod)
                })
            }
    }()))
}

self.addEventListener("fetch", fetchevent)
