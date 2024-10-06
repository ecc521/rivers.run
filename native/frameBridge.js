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
			//Respond with the requested output.
			response.message = await handleNativeCall(data.type, data.args)
		}
		catch (e) {
			//Pass the error back
			response.message = e
			response.throw = true
		}

		event.source.postMessage(response, iframeUrl)
	}, false);
}


function handleNativeCall(callType, args) {
	//Storage syncing
	if (callType === "getStorage") {
		return JSON.stringify(localStorage)
	}
	else if (callType === "setStorage") {
		//Set new props, update existing props, and delete nonexistent props.
		let unusedProps = Object.keys(localStorage)

		let stor = JSON.parse(args[0])
		for (let prop in stor) {
			let index = unusedProps.indexOf(prop)
			if (index !== -1) {unusedProps.splice(index, 1)}

			localStorage.setItem(prop, stor[prop])
		}

		unusedProps.forEach((unusedProp) => {
			localStorage.removeItem(unusedProp)
		})
	}
	//Geolocation
	else if (callType === "getCurrentPosition") {
		return Geolocation.getCurrentPosition()
	}
	//Authentication
	else if (callType=== "firebaseSignOut") {
		return FirebaseAuthentication.signOut()
	}
	else if (callType === "firebaseGetIdToken") {
		return FirebaseAuthentication.getIdToken()
	}
	else if (callType === "logInWithProvider") {
		let provider = args[0]
		if (provider === "google") {
			return FirebaseAuthentication.signInWithGoogle()
		}
		else if (provider === "apple") {
			return FirebaseAuthentication.signInWithApple()
		}
		else if (provider === "facebook") {
			return FirebaseAuthentication.signInWithFacebook()
		}
		else {
			throw "Unknown Provider: " + provider
		}
	}
	else {
		throw "Unknown frameBridge Call"
	}
}



export {enableFrameBridge}