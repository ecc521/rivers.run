//Name of cache to use
const cachename = "rivers.run"


//NOT YET IMPLEMENTED

//Caches that should not be cleared. Note that cachename is automatically added
const keepcaches = []

//Prefix that will be added to cachename.
//Caches without this prefix will not be modified
const prefix = ""

//Array of URL's that should be preloaded IF POSSIBLE (will continue if not preloaded)
const preloadurls = []

//END OF NOT YET IMPLEMENTED

//Milliseconds to wait for network response before using cache
const waitperiod = 1800




self.addEventListener("fetch", fetchevent)
self.addEventListener("activate", activateevent)

function fetchevent(event) {
    event.respondWith((async function(){
        let fromnetwork = fetch(event.request)
        let cache = await caches.open(cachename)

        let url = event.request.url
        url = url.slice(0, url.indexOf("?")) //Eliminate Query Parameter
          
        let fromcache = await caches.match(url)
            
            
        if (!fromcache) {
            //No cache. All we can do is return network response
            let response = await fromnetwork
            cache.put(url, response.clone())
            return response
        }
        else {
                
            //We have cached data
            return new Promise(function(resolve, reject){
                    
                //Fetch from network and update cache
                fromnetwork.then(function(response){
                    cache.put(url, response.clone())
                    resolve(response)
                })
                    
                //If the fetch event fails (ex. offline), return cached immediately
                fromnetwork.catch(function(e){
                    resolve(fromcache)
                })
                    
                    //If the network doesn't respond quickly enough, use cached data
                    setTimeout(function(){
                        resolve(fromcache)
                    }, waitperiod)
                })  
            }
    }()))
}


function activateevent() {
    
    

}

