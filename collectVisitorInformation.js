let previousVisits = (Number(localStorage.getItem("previousVisits")) || 0) + 1
localStorage.setItem("previousVisits", previousVisits)


//Data that we are collecting
let data = {
  userAgent: navigator.userAgent, //Information about the browser
	selectedColorScheme: localStorage.getItem("prefersDarkMode"), //Determining if you explicitly selected a color scheme
	usingDarkMode: window.darkMode, //Determining if you are using dark mode
	supportsDarkMode: window.matchMedia('(prefers-color-scheme: dark)').media !== "not all", //Determine if your browser supports automatic dark mode
	online: navigator.onLine, //Detect if the offline version of the site is being used
	hasServiceWorkers: 'serviceWorker' in navigator,//Detect if the browser supports serviceworkers
	timeStamp: Date.now(), //What time the page was visited at.
	referrer: document.referrer, //Used to detect how navigation is used
	previousVisits, //Used to detect if a visitor is unique
	url: window.location.href //Used to eliminate data sent due to development work
}

//URL to submit the data to
let formURL = "https://docs.google.com/forms/d/e/1FAIpQLSfyTHeq0fp6-iofQacxfXcsSGjYymLJbLOPmlBBKBtttWvtcA/formResponse?ifq&entry.1198287313=" + JSON.stringify(data) + "&submit=Submit"


function loadURL() {
	//Return true if the request is successful. false otherwise
	return new Promise((resolve, reject) => {
		if (window.fetch) {
			let request = fetch(formURL, {mode: "no-cors"})
			request.then((result) => {
				if (result.type === "opaque") {
					resolve(true)
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
						
			let request = new XMLHttpRequest()
				request.onload = function(event) {
					resolve(true)
				};
				request.onerror = function(event) {
					resolve(true)
				};			
			request.open("GET", formURL);
			request.send()
		}
	})
}


//Race conditions are possible, although unlikely to happen here (although not much breaks if they do)
//If the site is loaded offline, store the data and send it in the next time the site is loaded.
let urls = JSON.parse(localStorage.getItem("urlsToLoad") || "[]")
urls.push(formURL)

for (let i=0;i<urls.length;i++) {
	let url = urls[i]
	loadURL(url).then((result) => {
		//If the request succeeded, remove the URL from the queue
		if (result) {
			urls.splice(urls.indexOf(url), 1)
			localStorage.setItem("urlsToLoad", JSON.stringify(urls))
		}
	})
}

