const {getUserLocation, getLocationErrorMessage} = require("./getLocation.js")

//Prepare the Advanced Search button
let advanced_search_modal = document.getElementById('advanced-search-modal');
advanced_search_modal.style.display = "none"

let span = document.getElementById("advanced-search-modal-close").onclick = function() {
    advanced_search_modal.style.display = "none"
}

document.addEventListener("click", function(event) {
    if (event.target === advanced_search_modal) {
        advanced_search_modal.style.display = "none"
    }
})

document.getElementById("advancedsearch").addEventListener("click", function() {
    advanced_search_modal.style.display = ""
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
        position = await getUserLocation()
	}
	catch(e) {
        let output = await getLocationErrorMessage(e)
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
