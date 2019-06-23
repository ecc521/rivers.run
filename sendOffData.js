function _loadURL(url) {
	//Return true if the request is successful. false otherwise
	return new Promise((resolve, reject) => {
		if (window.fetch) {
			let request = fetch(url, {mode: "no-cors"})
			request.then((result) => {
				if (result.type === "opaque") {
					resolve(true)
				}
        else {
          resolve(false)
        }
			})
			request.catch((e) => {
				console.error(e)
				resolve(false)
			})
		}
		else {

			//For browsers that don't support fetch
			//I have no way to actually assure that the request went through using
			//XMLHttpRequest, and merely assume that it went through if anything happens

      //Since browsers that support serviceWorker also support fetch, don't bother checking
      //that the user is online or trying to bypass cache/serviceWorker

			let request = new XMLHttpRequest()
				request.onload = function(event) {
					resolve(true)
				};
				request.onerror = function(event) {
					resolve(true)
				};
			request.open("GET", url);
			request.send()
		}
	})
}


//Race conditions are possible, although unlikely to happen here (although not much breaks if they do)
//If the site is loaded offline, store the data and send it in the next time the site is loaded.
let urls = JSON.parse(localStorage.getItem("urlsToLoad") || "[]")
localStorage.setItem("urlsToLoad", JSON.stringify(urls))

for (let i=0;i<urls.length;i++) {
	let url = urls[i]
	_loadURL(url).then((result) => {
		//If the request succeeded, remove the URL from the queue
		if (result === true) {
			urls.splice(urls.indexOf(url), 1)
			localStorage.setItem("urlsToLoad", JSON.stringify(urls))
		}
	})
}


function loadURL(url) {
	urls.push(url)
	localStorage.setItem("urlsToLoad", JSON.stringify(urls))
	_loadURL(url).then((result) => {
		//If the request succeeded, remove the URL from the queue
		if (result === true) {
			urls.splice(urls.indexOf(url), 1)
			localStorage.setItem("urlsToLoad", JSON.stringify(urls))
		}
	})
}

module.exports = {
	loadURL
}
