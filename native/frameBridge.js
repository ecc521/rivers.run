//The iframe's localStorage is cleared repeatedly.
//To fix this, we will store data here instead, and use postMessage to communicate.

module.exports = function({iframeUrl}) {
	window.addEventListener("message", async function(event) {
		//Security measure, although this should never end up running.
		if (new URL(event.origin).href !== new URL(iframeUrl).href) {
			return console.error("Origin Not Allowed: ", event.origin)
		}

		let data = event.data
		let response = {
			randomKey: data.randomKey,
		};

		try {
			if (data.type === "getStorage") {
				response.message = JSON.stringify(localStorage)
			}
			else if (data.type === "setStorage") {
				let stor = JSON.parse(data.args[0])
				for (let prop in stor) {
					localStorage.setItem(prop, stor[prop])
				}
			}
			else if (data.type === "getCurrentPosition") {
				response.message = await Capacitor.Plugins.Geolocation.getCurrentPosition()
			}
			else {
				throw "Unknown frameBridge Call"
			}
		}
		catch (e) {
			response.message = e.message
			response.throw = true
		}

		event.source.postMessage(response, iframeUrl)
	}, false);
}
