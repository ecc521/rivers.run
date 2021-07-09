//Load the entire site into an iframe based on a local server.
//Make sure to update the native/index.html csp if needed.

//TODO: Is there any way to capture and cache the google maps api code?
//Also - if we can do that, we need to store higher res OpenStreetMap tiles offline.
//We'd currently need to base64 encode them here (from binary), then decode on the other side,
//as the server doesn't support text. Probably use FileReader or something for performance.

const WebServer = require("@ionic-native/web-server").WebServer

const enableUniversalLinks = require("./universalLinks.js")
const enableFrameBridge = require("./frameBridge.js")
const appUpdateWarning = require("./appUpdates.js")

const port = 15376

let sourceServer = "https://rivers.run"

let preinstalledAssetsPath = "www" //We host preinstalled assets in a www dir.
let localCacheAssetsPath = "filecache"

require("../src/allPages/addTags.js") //Add meta tags, etc.

function restartWebserver(callback) {
	console.log("Starting Webserver")
	return WebServer.stop().then(() => {
		WebServer.onRequest().subscribe(data => {
			if (data.path.endsWith("/")) {
				data.path += "index.html"
			}

			let headers = {
				'Access-Control-Allow-Origin': "*"
			}

			const res = {
				headers,
				body: ""
			};

			//Incomplete list.
			if (data.path.endsWith(".html")) {
				headers['Content-Type'] = "text/html"
			}
			else if (data.path.endsWith(".css")) {
				headers['Content-Type'] = "text/css"
			}
			else if (data.path.endsWith(".js")) {
				headers['Content-Type'] = "text/javascript"
			}
			else if (data.path.endsWith(".json")) {
				headers['Content-Type'] = "application/json"
			}

			if (
				!headers['Content-Type']
				|| data.path.includes("ip2location")
				|| data.path.includes("node")
				|| data.path.includes("gaugeReadings")
			) {
				console.log("Redirecting to Network", data.path)
				//This server plugin only supports text, not binary.
				//Therefore, redirect these to network.

				//Also, don't cache items that shouldn't be cached.

				res.status = 301
				headers["Location"] = sourceServer + data.path

				return WebServer.sendResponse(data.requestId, res)
				.catch((error) => console.error(error));
			}
			console.log("Serving", data.path)

			;((async function() {
				try {
					res.status = 200

					try {
						if (navigator.onLine === false) {throw "Offline"} //Instantly trigger fallback.

						//Try Network First.
						await new Promise((resolve, reject) => {
							fetch(sourceServer + data.path).then((response) => {
								response.text().then((text) => {
									Capacitor.Plugins.Filesystem.writeFile({
										path: localCacheAssetsPath + data.path,
										directory: "DATA",
										data: text,
										recursive: true,
										encoding: "utf8"
									})
									res.body = text
									resolve()
								})
							})

							setTimeout(function() {
								reject("Request Timeout Exceeded. ")
							}, 1200) //1.2 second fallback.
						})
					}
					catch (e) {
						//Try filesystem next.
						console.error(e)
						try {
							res.body = (await Capacitor.Plugins.Filesystem.readFile({
								path: localCacheAssetsPath + data.path,
								directory: "DATA",
								encoding: "utf8"
							})).data
						}
						catch (e) {
							//Installed with App Last.
							console.error(e)
							let req = await fetch(preinstalledAssetsPath + data.path)
							res.body = await req.text()
						}
					}
				}
				catch (e) {
					console.error(e)
					res.status = 500
				}
				finally {
					console.log(res)
					WebServer.sendResponse(data.requestId, res)
					.catch((error) => console.error(error));
				}
			})())
		});

		WebServer.start(port)
		.catch((error) => console.error(error));

		callback()
	})
}

Capacitor?.Plugins?.App?.addListener("appStateChange", function(event) {
	//There's some issue with the webserver getting suspended or something.
	//Happens when the app is left unused in the background for a while.
	restartWebserver()
})


restartWebserver(function() {
	let iframe = document.createElement("iframe")
	iframe.style.border = "none"
	iframe.style.width = "100%"
	iframe.style.height = "100%"
	document.body.appendChild(iframe)

	let iframeUrl = "http://127.0.0.1:" + port
	enableFrameBridge({iframeUrl})

	iframe.src = iframeUrl
	enableUniversalLinks({iframe, baseUrl: iframeUrl})
})

appUpdateWarning()

//Capacitor hides the accessory bar (the up/down, and done button) to make it less obvious apps use web tech.
//We'll show it again - rivers.run is pretty obviously web based anyways. 
Capacitor.Plugins.Keyboard.setAccessoryBarVisible({isVisible: true})
