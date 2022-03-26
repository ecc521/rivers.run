//The iframe's localStorage is cleared repeatedly.
//To fix this, we will store data here instead, and use postMessage to communicate.

module.exports = function({iframeUrl}) {
	window.addEventListener("message", async function(event) {
		//Security measure, although this should never end up running.

		//TODO: Ensure that frameBridge does not allow any non-rivers.run or local origins.
		//So in the event that an OAuth provider or other site in the iframe gets compromised,
		//they could not perform a data extraction attack against rivers.run users.

		//This attack is not possible as long as the CSP is restricted in child-src or default-src. 
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
				//Set new props, update existing props, and delete nonexistent props.
				let unusedProps = Object.keys(localStorage)

				let stor = JSON.parse(data.args[0])
				for (let prop in stor) {
					let index = unusedProps.indexOf(prop)
					if (index !== -1) {unusedProps.splice(index, 1)}

					localStorage.setItem(prop, stor[prop])
				}

				unusedProps.forEach((unusedProp) => {
					localStorage.removeItem(unusedProp)
				})
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
