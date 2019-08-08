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
    "clubs.html",
    "settings.html",
    "FAQ.html",
    "index.css",
    "packages/allPages.js",
    "packages/index.js",
    "riverarray.js",
    "overviews.js",
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


function fetchHandler(event) {
    event.respondWith((async function(){
		let waitperiod = defaultWaitPeriod

        let cache = await caches.open(cacheName)

        let url = event.request.url

		if (url.includes("waterservices.usgs.gov")) {
			url = url.slice(0,url.indexOf("?"))
		}

        let fromcache = await caches.match(url)

        //If it is less than 5 minutes old, return the cached data.
        //Note that the date header isn't always set.
		if (fromcache && Date.now() - new Date(fromcache.headers.get("date")).getTime() < 60*1000*5) {
			return fromcache
		}

		let fromnetwork = fetch(event.request)

		if (url.includes("docs.google.com") || url.includes("googleapis.com")) {
            //Avoid filling up cache with opaque responses from docs.google.com
            //Avoid caching googleapis.com - we want the network response for writeupmaker.html (though we may want to temporarily cache images)
			return fromnetwork
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
                    setTimeout(function(){
						if (!served) {
							served = 1
                        	messageAllClients(url + " took too long to load from network. Using cache")
							resolve(fromcache)
						}
                    }, waitperiod)
                })
            }
    }()))
}

self.addEventListener("fetch", fetchHandler)

async function disableNotificationsUntil(timeStamp = 0) {
    await fetch("https://rivers.run/node", {
        method: "POST",
        body:JSON.stringify({
            subscription: await self.registration.pushManager.getSubscription(),
            noneUntil: timeStamp
        })
    })
}


function pushHandler(event) {
    console.log(event)
    var data = {};
    if (event.data) {
      data = event.data.json();
    }

    let title = "River(s) are running!";
    let body = "";

    let riverNames = []
    let IDs = []

    for (let id in data) {
        riverNames.push(data[id].name)
        IDs.push(id)
    }

    console.log(data)

    if (riverNames.length === 0) {
        //Close existing river notifications.
        event.waitUntil((async function() {
            let existingNotifications = await self.registration.getNotifications({tag: "rivernotification"})
            existingNotifications.forEach((notification) => {
                notification.close()
            })
        }()))
        return;
    }
    //If a rivers name ends with Creek, don't use the work "The"
    else if (riverNames.length === 1) {
        title = (riverNames[0].trim().endsWith("Creek")?"":"The ") + riverNames[0] + " is running!"
        body = (riverNames[0].trim().endsWith("Creek")?"":"The ") + riverNames[0]  +  " is at " + data[IDs[0]].current + data[IDs[0]].units + "!"
    }
    else if (riverNames.length === 2) {
        title = "2 rivers are running!"
        body = (riverNames[0].trim().endsWith("Creek")?"":"The ") + riverNames[0] + " and " + riverNames[1] + " are running!"
    }
    else {
        title = riverNames.length + " rivers are running!"
        let last = riverNames.pop()
        body = (riverNames[0].trim().endsWith("Creek")?"":"The ") + riverNames.join(", ") + ", and " + last + " are running!"
        riverNames.push(last) //Make sure the list stays the same.
    }

    //TODO: Add actions to dismiss notifications for 12 hours, etc.


    let options = {
      icon: "resources/icons/192x192-Water-Drop.png",
      body,
      badge: "resources/icons/72x72-Water-Drop.png",
      sound: 'resources/waterfall.mp3',
      requireInteraction: true, //Don't auto-close the notification.
      renotify: false,
      data: {
          IDs,
      },
      tag: 'rivernotification',
    }

    event.waitUntil((async function() {
        let existingNotifications = await self.registration.getNotifications({tag: "rivernotification"})
        let notification = await self.registration.showNotification(title, options)
        console.log(notification)
    }()))
}

self.addEventListener('push', pushHandler)


self.addEventListener('notificationclick', function(event) {
  //TODO: Consider showing only the river(s) being talked about.
  if (clients.openWindow) {
      console.log(event)
      let data = event.notification.data

      let IDs = data.IDs

      let searchQuery = {
          id: IDs.join(",")
      }

      let url = new URL(rebaseURL("")); //URL to River Info page.
      url.hash = JSON.stringify(searchQuery)
      event.notification.close(); //Android needs explicit close.
      self.dispatchEvent(new Event("notificationclose")) //I thought that the event was supposed to fire when the notification was closed for
      //any purpose, however, at least in chrome, it did not.
      console.log(url.href)
      clients.openWindow(url.href) //Open the specified url.
  }
});

self.addEventListener("notificationclose", function() {
    //No more notifications for the next 8 hours.
    //TODO: Use background sync for if the user is offline when they close the notification.
    //Automatic notifications by chrome pose an issue here - if the user closes notifications offline, they will receive one notification That
    //they shouldn't. If rivers.run blocks that, and it happens again, Chrome will create a notification.
    //Proposal for chrome: If the user interacted with the previous notification, you do not have to create another one.
    let promise = disableNotificationsUntil(Date.now() + 1000*60*60*8)
    console.log(promise)
})
