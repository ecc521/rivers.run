
//Prepare the Advanced Search button
let advanced_search_modal = document.getElementById('advanced-search-modal');

let span = document.getElementById("advanced-search-modal-close").onclick = function() {
    advanced_search_modal.style.display = "none"
}

document.addEventListener("click", function(event) {
    if (event.target === advanced_search_modal) {
        advanced_search_modal.style.display = "none"
    }
})

document.getElementById("advancedsearch").addEventListener("click", function() {
    advanced_search_modal.style.display = "block"
})


//For dynamic searching, we may want to use the keyup event instead of input if there are performance issues when users hold down delete.
//Event listeners for the normal search boxes.

function searchBoxChange(event) {
    let query = window.getAdvancedSearchParameters()
    query.sort.query = "none" //Normal searches apply their own sorting. query.sort will override this.
    query.normalSearch = event.target.value
    setMenuFromSearch(query) //Make sure the user knows that the sort has been canceled.
	NewList(query)
}

document.querySelectorAll("#searchbox, #normalSearchBoxOnAdvancedSearch").forEach((element) => {
    element.addEventListener("input", function searchBoxKeyPress(event) {
		//If the user is backspacing, search only when key lifted up or box empty.
		if (event.inputType === "deleteContentBackward") {
			if (event.target.value === "") {
				window.removeEventListener("keyup", searchBoxChange)
				searchBoxChange(event)
			}
			else {
				window.addEventListener("keyup", searchBoxChange, {once: true})
			}
			return
		}
    	//If the user presses the "Go" button (Actually an Enter/Return), unfocus the searchbox.
    	if (event.keyCode === 13) {
    		event.target.blur()
    	}
    	searchBoxChange(event)
    })
})

//Advanced search event listeners.
let elements = document.querySelectorAll(
    "#advanced-search-modal > .modal-content > input, " +
    "#advanced-search-modal > .modal-content > select, " +
    "#advanced-search-modal > .modal-content > #locationSearchPortion > input"
).forEach((element) => {
    function input() {
		//If the user presses the "Go" key (Actually an Enter/Return), unfocus the searchbox.
		if (event.keyCode === 13) {
			event.target.blur()
		}
		NewList()
	}
    element.addEventListener("input", input)
    element.addEventListener("change", input) //Some browsers don't fire input event in some cases due to bugs
    element.addEventListener("click", input) //Just an extra precaution.
})


async function calculateCoordinates() {

	let status = document.getElementById("locationProgress")
	let num = 0
	let progress = setInterval(function() {
		num = (num+1)%6
		status.innerHTML = "Calculating your Approximate Location (Expect this to take 15-60 seconds)" + ".".repeat(num)
	}, 500)

	let position;
	try {
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
	}
	catch(error) {
        if (error.errors) {error = error.errors[0]} //Handle aggregateErrors.
		let output = "Your device encountered an error when attempting to find your position. " //Message for POSITION_UNAVAILABLE error.
		if (error.PERMISSION_DENIED) {
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
		output += "\n\nError message: " + error.message
		alert(output)
		clearInterval(progress)
		status.innerHTML = output
	}

    console.log(position)
	let coords = position.coords

	clearInterval(progress)

	document.getElementById("latitudeQuery").value = coords.latitude
	document.getElementById("longitudeQuery").value = coords.longitude
	status.innerHTML = "You are within " + coords.accuracy + " meters of " + coords.latitude + " degrees latitude and " + coords.longitude + " degrees longitude."

	//Alert the user if the potential error is greater than 10 miles..
	if (coords.accuracy > 10*1609.344) {
		alert("Your device stated that GPS readings could be up to " + Math.ceil(coords.accuracy/1609.344) + " miles off target. You may want to make sure the coordinates are working properly.")
	}

	NewList()
}

document.getElementById("calculateCoordinates").addEventListener("click", calculateCoordinates)


elements = document.querySelectorAll(".clearAdvancedSearch")
for (let i=0;i<elements.length;i++) {
	elements[i].addEventListener("click", function() {
		if (confirm("Are you sure that you would like to clear the advanced search query?")) {
			//Reset all but normalSearch
			let query = recursiveAssign({}, window.defaultAdvancedSearchParameters)
			query.normalSearch = getAdvancedSearchParameters().normalSearch
			window.setMenuFromSearch(query)
			NewList()
		}
	})
}


let datalist = document.getElementById("stateOptions")

const {statesProvincesTerritorys} = require("./statesProvincesTerritorys.js")

for (let regionCode in statesProvincesTerritorys) {
	let option = document.createElement("option")
	option.value = regionCode
	option.innerHTML = statesProvincesTerritorys[regionCode]
	datalist.appendChild(option)
}


let ipLocation = document.getElementById("ipLocation")
try {
	//IP based Geolocation only appears to be accurate with WIFI.
	//Although most browsers don't support it, try not to use IP based geolocation for mobile users.
	//Note that the IP geolocation service should be able to tell us if the user is mobile.

	let notWifi
	if (window.navigator && navigator.connection && navigator.connection.type) {
		notWifi = (navigator.connection.type !== "wifi")
	}

    if (window.fetch && !notWifi) {
		//TODO: Add XMLHttpRequest fallback.
        fetch("https://rivers.run/node/ip2location").then((response) => {
    		response.json().then((locationInfo) => {

    			ipLocation.innerHTML = "Would you like to use coordinates for " + locationInfo.city + ", " + locationInfo.region + "? (From IP Address) "
    			ipLocation.style.display = "block"

    			function close() {
    				//IP2Location wants attribution.
    				ipLocation.innerHTML = "IP to geolocation data from <a href='https://lite.ip2location.com'>http://lite.ip2location.com</a>"
    				ipLocation.style.opacity = 0
    				ipLocation.style.fontSize = 0
    				setTimeout(function() {
    					ipLocation.remove()
    				}, 3000)
    			}

    			let yes = document.createElement("button")
    			yes.innerHTML = "Yes"
    			yes.addEventListener("click", function() {
    				let query = window.getAdvancedSearchParameters()
    				query.location.lat = locationInfo.latitude
    				query.location.lon = locationInfo.longitude
    				window.setMenuFromSearch(query)
    				close()
    			})
    			ipLocation.appendChild(yes)

    			let no = document.createElement("button")
    			no.innerHTML = "No"
    			no.addEventListener("click", function() {
    				close()
    			})
    			ipLocation.appendChild(no)
    		})
    	})
    }
}
catch (e) {
	console.error(e)
}
