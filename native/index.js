//Make sure to update the native/index.html csp if needed.

//TODO: Is there any way to capture and cache the google maps api code?
//Also - if we can do that, we need to store higher res OpenStreetMap tiles offline.
//We'd currently need to base64 encode them here (from binary), then decode on the other side,
//as the server doesn't support text. Probably use FileReader or something for performance.

require("../src/allPages/addTags.js")

//Load the entire site into an iframe based on a local server.

const WebServer = require("@ionic-native/web-server").WebServer
let sourceServer = "https://rivers.run"

//If the server is already running, stop it.
WebServer.stop().then(() => {
	const port = 15376

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
									path: data.path,
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
							path: data.path,
							directory: "DATA",
							encoding: "utf8"
						})).data
					}
					catch (e) {
						//Installed with App Last.
						console.error(e)
						let req = await fetch("www" + data.path) //We host preinstalled assets in a www dir. 
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

	let iframe = document.createElement("iframe")
	iframe.style.border = "none"
	iframe.style.width = "100%"
	iframe.style.height = "100%"
	document.body.appendChild(iframe)

	iframe.src = "http://127.0.0.1:" + port
	require("./universalLinks.js")({iframe, baseUrl: iframe.src})
})


if (Capacitor?.getPlatform() === "ios") {
    try {
        ;((async function() {
            //Alert for App Updates.

            //iTunes is settings CORS headers, but those headers don't change when the CDN resends the content -
            //if the CDN serves us, the CORS headers are for whatever origin last issued the request.

            //Fail on Apple's part there. Time to start cache busting. Leave a nice note in case this leaves some weird stuff in logs.
            //Apple takes up to a day to stop caching anyways, so this is probably a good thing from that perspective.

            let req = await fetch("https://itunes.apple.com/lookup?bundleId=run.rivers.twa&YourCDNDoesNotChangeCORSHeadersSoMustCacheBust" + Math.random())
            let res = await req.json()
            let latestVersion = res.results[0].version

            let deviceInfo = await window.Capacitor.Plugins.Device.getInfo()
            let currentVersion = deviceInfo.appVersion

            //Using numeric comparison, so version codes can't have more than one decimal.
            if (parseFloat(currentVersion) < parseFloat(latestVersion)) {
				let popup = document.createElement("div")
				popup.innerHTML = `
				<h2>App Update</h2>
				<h3>There is a Rivers.run <a href='https://apps.apple.com/us/app/rivers-run/id1552809249' target='_blank'>app update</a>. Downloading it is recommended. You may experience if you do not update.</h3>`
				popup.style.left = popup.style.top = popup.style.bottom = popup.style.right = "0"
				popup.style.position = "absolute"
				popup.style.textAlign = "center"
				popup.style.backgroundColor = "white"
				popup.style.color = "black"
				popup.style.padding = "10px"
				popup.style.paddingTop = "30px"
				let closeButton = document.createElement("button")
				closeButton.innerHTML = "Close"
				closeButton.style.padding = "20px"
				closeButton.addEventListener("click", function() {
					popup.remove()
				})

				popup.appendChild(closeButton)
				document.body.appendChild(popup)
            }
        })())
    }
    catch (e) {console.error(e)}
}
