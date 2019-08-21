self.usgsarray = {}
window.updateOldDataWarning = function() {

		let toDelete = document.getElementById("topOldDataWarning")
		if (toDelete) {toDelete.remove()}

		if (!window.usgsDataAge) {return}
		//No reason to make an old data warning when data is new (within 1 hour)
		//Make sure to change the warning text so that if the data becomes old while the page is open, they are not confused.
		if (window.usgsDataAge < 1000*60*60) {
			window.loadNewUSGS = "USGS Data has become old while this page was open. Click try again to update."
			return
		}

		let oldDataWarning = document.createElement("p")
		oldDataWarning.id = "topOldDataWarning"

		oldDataWarning.innerHTML = "All river data is more than " + Math.floor(window.usgsDataAge/1000/60/60) + " hours old! "
		oldDataWarning.innerHTML += "(" + window.loadNewUSGS + ") "

					let reloadButton = document.createElement("button")

						reloadButton.addEventListener("click", function() {
							window.loadNewUSGS = "Trying to Load Data"
							require("./loadUSGS.js").loadUSGS()
						})
						reloadButton.innerHTML = "Try Again"


					oldDataWarning.appendChild(reloadButton)


		let legend = document.getElementById("legend")
		legend.parentNode.insertBefore(oldDataWarning, legend)
}


function updateUSGSDataInfo() {
	window.usgsDataAge = Date.now() - window.requestTime
	window.updateOldDataWarning()
}
setInterval(updateUSGSDataInfo, 1000*60*1) //Every minute, make sure that the data has not become old. If it has, display a warning.

let timesLoadUSGSRan = 0
let loadUSGS = async function(useCache) {
	//Gaurd against infinite recursion. Ignores calls when data is new. (within 5 minutes)
	if (window.usgsDataAge < 1000*60*5) {
		return;
	}

	timesLoadUSGSRan++

	let timeToRequest = 1000*86400 //Milliseconds of time to request

    var sites = []
    for (let i=0;i<riverarray.length;i++) {
		let values = [riverarray[i].usgs]
		riverarray[i].relatedusgs && values.concat(riverarray[i].relatedusgs)
		for (let i=0;i<values.length;i++) {
			let usgsID = values[i]
			if (!usgsID) {continue}
			//Basic value validation (throws out virtual gauges and clearly incorrect numbers.)
	        if (usgsID.length > 7 && usgsID.length < 16 && !isNaN(Number(usgsID))) {
	            (sites.indexOf(usgsID) === -1) && sites.push(usgsID) //Add the site if it doesn't exist in the list.
	        }
		}
    }


	let fileName = "flowdata2.json"

	if (useCache) {
		let cache = await caches.open("rivers.run")
		let response = await caches.match(fileName)
		window.usgsarray = await response.json()
	}
	else if (window.fetch) {
		let response = await fetch(fileName)
		window.usgsarray = await response.json()
	}
	else {
		//For browsers that don't support fetch
		let request = new XMLHttpRequest()
		let response = await new Promise((resolve, reject) => {
			request.onload = function(event) {resolve(event.target.response)};
			request.open("GET", fileName);
			request.send()
		})
		window.usgsarray = JSON.parse(response)
	}

	window.requestTime = usgsarray.generatedAt
	updateUSGSDataInfo()
	window.updateOldDataWarning()



	//Add USGS Data to Graph
	for (let i=0;i<ItemHolder.length;i++) {
		let river = ItemHolder[i]

		//Add river data to river objects, and updates them for the new information.

		//item.create(true) will force regeneration of the button
		//Replace the current button so that the flow info shows
		let replacement = river.create(true) //Create the new button and update the version in cache.
		let elem = document.getElementById(river.base + "1") //Get the currently displayed button (if there is one.)
		if (elem) {
			let expanded = river.expanded
			try {
				elem.parentNode.replaceChild(replacement, elem)
				//If the river was expanded before, keep it expanded
				if (expanded) {
					replacement.dispatchEvent(new Event("click"))
					replacement.dispatchEvent(new Event("click"))
				}
			}
			catch (e) {console.error(e)}
		}

	}

	window.dispatchEvent(new Event("usgsDataUpdated"))
}

window.addEventListener("usgsDataUpdated", function() {
	let query = getAdvancedSearchParameters()
	if (
		(//Make sure flow searching or sorting is being performed, so that re-running the search may make a difference.
			!objectsEqual(query.flow, defaultAdvancedSearchParameters.flow) //Flow search
			|| (query.sort.query === "running") //Flow sort
		)
		&& timesLoadUSGSRan >= 1 //And this is actually an update to the data, not the first load
		&& (//Make sure we don't close writeups that the user is looking at without their permission.
			ItemHolder.every(river => !river.expanded) //If no writeups are open, we can continue
			|| confirm("USGS data has been updated. Would you like to re-run the previous search?") //Otherwise, ask the user if they would like the update.
		)
	) {NewList()}
})

export {
loadUSGS
}

window.loadUSGS = loadUSGS
