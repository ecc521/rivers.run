async function getUserLocation() {
	let position;
	if (window.nativeLocationRequest) {
		position = await window.nativeLocationRequest()
	}
	else {
		//We're fine with high accuracy, and probably want to enable it.
		//Otherwise, there might be some issues with GPS not enabling or something.
		position = await Promise.any([
			new Promise((resolve, reject) => {
				navigator.geolocation.getCurrentPosition(resolve, reject, {enableHighAccuracy: false})
			}),
			new Promise((resolve, reject) => {
				navigator.geolocation.getCurrentPosition(resolve, reject, {enableHighAccuracy: true})
			})
		])
	}
	return position;
}


async function getLocationErrorMessage(e) {
	console.error(e)
	if (e.errors) {e = e.errors[0]} //Handle aggregateErrors.
	let output = "Your device encountered an error when attempting to find your position. " //Message for POSITION_UNAVAILABLE error.
	if (e.PERMISSION_DENIED) {
		//If the error is actually permission denied, check to see if we have location permission.
		try {
			let status = await navigator.permissions.query({name:'geolocation'})
			if (status.state === "granted") {
				//If we do have location permission, odds are that the browser did not. Tell that to the user.
				//Browsers used to do this, but it looks like they now give a POSITION_UNAVAILABLE error.
				output = "It appears that your browser could not access your location. Make sure that location services is enabled and allowed for your device and browser."
			}
			else if (status.state === "denied"){
				//If the user denied permission, tell the user that they need to enable it.
				output = "Rivers.run does not have permission access to your location. Please enable location permission in site settings. You will also want to check that location is on for your device and/or browser."
			}
			else if (status.state === "prompt") {
				//If the user dismissed the prompt, tell them that they need to click Allow.
				output = "It appears that you dismissed the permission prompt. To find your location, you need to grant the location permission."
			}
		}
		catch(e) {
			console.error(e)
		}
	}

	output += "\n\nError message: " + e.message
	return output
}

module.exports = {
	getUserLocation,
	getLocationErrorMessage,
}
