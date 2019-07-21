
//Prepare the Advanced Search button
let advanced_search_modal = document.getElementById('advanced-search-modal');

let span = document.getElementById("advanced-search-modal-close").onclick = function() {
    advanced_search_modal.style.display = "none"
}

window.addEventListener("click", function(event) {
    if (event.target === advanced_search_modal) {
        advanced_search_modal.style.display = "none"
    }
})

document.getElementById("advancedsearch").addEventListener("click", function() {
    advanced_search_modal.style.display = "block"
})


//Make the searchboxes work and stay in sync.
let searchbox = document.getElementById("searchbox")
let searchboxOnAdvancedSearch = document.getElementById("normalSearchBoxOnAdvancedSearch")
function searchBoxKeyPress(event) {
	//If the user presses the "Go" button (Actually an Enter/Return), unfocus the searchbox.
	if (event.keyCode === 13) {
		event.target.blur()
	}
	let query = window.getAdvancedSearchParameters()
	query.sort.query = "none" //Normal searches apply their own sorting. query.sort will override this.
	setMenuFromSearch(query) //Make sure the user knows that the sort has been canceled.
	NewList(query)
	searchboxOnAdvancedSearch.value = searchbox.value
}
searchbox.addEventListener("keyup", searchBoxKeyPress)
searchbox.addEventListener("keydown", searchBoxKeyPress) //Also function when a key is held down (most likely backspace).

searchboxOnAdvancedSearch.addEventListener("keyup", function() {
	searchbox.value = searchboxOnAdvancedSearch.value
	searchBoxKeyPress({}) //Pass an empty object to avoid error reading property of undefined.
})



//Advanced search event listeners.
//When parameters are changed, run the search.
let elements = document.querySelectorAll("#advanced-search-modal > .modal-content > input[type=text]")
for (let i=0;i<elements.length;i++) {
	elements[i].addEventListener("keyup", function() {
		//If the user presses the "Go" key (Actually an Enter/Return), unfocus the searchbox.
		if (event.keyCode === 13) {
			event.target.blur()
		}
		NewList()
	})
}

elements = document.querySelectorAll("#advanced-search-modal > .modal-content > select")
for (let i=0;i<elements.length;i++) {
	elements[i].addEventListener("change", function(){NewList()})
}

elements = document.querySelectorAll("#advanced-search-modal > .modal-content > input[type=checkbox]")
for (let i=0;i<elements.length;i++) {
	elements[i].addEventListener("change", function(){NewList()})
}

elements = document.querySelectorAll("#advanced-search-modal > .modal-content > #locationSearchPortion > input")
for (let i=0;i<elements.length;i++) {
	elements[i].addEventListener("keyup", function(){NewList()})
}

document.querySelector("#advanced-search-modal > .modal-content > #locationSearchPortion > input[type=checkbox]").addEventListener("click", function(){NewList()})


async function calculateCoordinates() {

	let status = document.getElementById("locationProgress")
	let num = 0
	let progress = setInterval(function() {
		num = (num+1)%6
		status.innerHTML = "Calculating your Approximate Location (Expect this to take 15-60 seconds)" + ".".repeat(num)
	}, 500)

	let position;
	try {
		position = await new Promise((resolve, reject) => {
			navigator.geolocation.getCurrentPosition(resolve, reject)
		});
	}
	catch(e) {
		let output = "Your device encountered an error when attempting to find your position." //Message for POSITION_UNAVAILABLE error.
		new Promise(() => {
			//If the error is actually permission denied, check to see if we have location permission.
			if (output.PERMISSION_DENIED) {
				navigator.permissions.query({name:'geolocation'}).then((status) => {
					if (status.state === "granted") {
						//If we do have location permission, odds are that the browser did not. Tell that to the user.
						output = "It appears that your browser could not access your location. Make sure that location services is enabled and allowed for your browser."
					}
					else if (status.state === "denied"){
						//If the user denied permission, tell the user that they need to enable it.
						output = "You denied rivers.run access to your location. Please enable location permission in site settings."
					}
					else if (status.state === "prompt") {
						//If the user dismissed the prompt, tell them that they need to click Allow.
						output = "It appears that you dismissed the permission prompt. To find your location, you need to grant the location permission."
					}
					resolve()
				})
			}
			else {resolve()} //The error was not permission denied. Continue.
		}).then(() => {
			output = "\nError message: " + e.message
			alert(output)
			clearInterval(progress)
			status.innerHTML = output
		})
	}


	let coords = position.coords

	clearInterval(progress)

	document.getElementById("latitudeQuery").value = coords.latitude
	document.getElementById("longitudeQuery").value = coords.longitude
	status.innerHTML = "You are within " + coords.accuracy + " meters of " + coords.latitude + " degrees latitude and " + coords.longitude + " degrees longitude."

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
