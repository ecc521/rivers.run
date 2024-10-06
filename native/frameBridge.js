import {Geolocation} from "@capacitor/geolocation";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
window.FirebaseAuthentication = FirebaseAuthentication //TESTING ONLY!!! Can be removed safely.

//The iframe's localStorage is cleared repeatedly.
//To fix this, we will store data here instead, and use postMessage to communicate.

function enableFrameBridge({iframeUrl}) {
	window.addEventListener("message", async function(event) {
		//If the iframe navigates to a different origin for any reason, we will ignore messages from it.
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
			else if (data.type === "googleSignInRequest") {
				//FirebaseAuthentication.signInWithGoogle()
			}
			else if (data.type === "googleRefreshRequest") {
				//TODO: Not needed.
				// FirebaseAuthentication.getIdToken()
			}
			else if (data.type === "googleSignOutRequest") {
				// response.message = await FirebaseAuthentication.signOut()
			}
			else if (data.type === "appleSignInRequest") {
				//FirebaseAuthentication.signInWithApple()
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
				response.message = await Geolocation.getCurrentPosition()
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

export {enableFrameBridge}