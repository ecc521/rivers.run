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
						let req = await fetch(data.path)
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
