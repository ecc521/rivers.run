'use strict';


try {
	window.loadNewUSGS = "Trying to Load Data"
	if ('serviceWorker' in navigator) {
		window.serviceWorkerMessages = []
		navigator.serviceWorker.ready.then(function(registration) {
			navigator.serviceWorker.onmessage = function(event) {
				window.serviceWorkerMessages.push(event.data)
				let data = event.data

				if (!data.includes("waterservices.usgs.gov") && !data.includes("usgscache.json")) {return;}

				window.oldLoadUSGS = window.loadNewUSGS

				if (data.includes("Updated cache for")) {
					console.log("Updating")
					require("./loadUSGS.js").loadUSGS(true) //Update the information. true says to use cache.
				}
				else if (data.includes("errored. Using cache")) {
					window.loadNewUSGS = "Unable to load latest data"
				}
				else if (data.includes(" took too long to load from network")) {
					window.loadNewUSGS = "Updating data in backgroud"
				}
				else if (data.includes("has been loaded from the network")) {
					window.loadNewUSGS = "This is likely a glitch. You should be viewing the latest data."
				}
				window.updateOldDataWarning()
			}
		})
	}
}
catch(e) {console.error(e)}

try {
	window.addLine = require("./graph.js").addLine
}
catch(e) {console.error(e)}

//Defines window.TopBar and window.triangle
Object.assign(window, require("./TopBar.js"))

window.River = require("./River.js").River

window.sort = require("./sort.js").sort

//Defines window.normalSearch, window.advanedSearch, and window.toDecimalDegrees
Object.assign(window, require("./search.js"))

window.usgsarray = {}


//ItemHolder is a list of all the DOM elements objects. New objects should be pushed into the list.
window.ItemHolder = []
riverarray.map(function(event, index) {
	ItemHolder[index] = new River(index, event)
})

//Fetch data from USGS
//ItemHolder has been filled, so this can be run here (and needs to be.... Otherwise window.usgsarray is undefined)
require("./loadUSGS.js").loadUSGS()

//Defines recursiveAssign, deleteMatchingPortions, and objectsEqual
Object.assign(window, require("./objectUtils.js"))
require("./advancedSearchParameters.js") //Defines window.setMenuFromSearch and window.getAdvancedSearchParameters

require("./searchUI.js") //Adds listeners to the searchbox and advanced search menu.

require("./NewList.js") //Defines window.NewList

document.getElementById("Rivers").appendChild(new TopBar().create())
//createLegend.js needs a #Rivers > .riverbutton to get font-size using getComputedStyle
require("./createLegend.js")

NewList()


//Check if there is a search query
if (window.location.hash.length > 0) {
	let search = decodeURI(window.location.hash.slice(1))

if (search.startsWith("{")) {
		//Advanced search
		let query = JSON.parse(search)

		//TODO: Set the advanced search areas to the query.

		//We have no usgs data yet. Wait to flow search/sort.
		if (window.usgsDataAge === undefined) {
			let oldQuery = recursiveAssign({}, query)
			delete query.flow
			if (query.sort && query.sort.query === "running") {
				delete query.sort
			}
			function dataNowLoaded() {
				if (timesNewListCalled === 2 || confirm("You used an advanced search link with flow parameters. Now that flow data has loaded, would you like to apply that search?")) {
					setMenuFromSearch(oldQuery)
					NewList()
				}
				window.removeEventListener("usgsDataUpdated", dataNowLoaded)
			}
			if (!objectsEqual(query, oldQuery)) {
				window.addEventListener("usgsDataUpdated", dataNowLoaded)
				let searchNotFinished = document.createElement("p")
				searchNotFinished.id = "topOldDataWarning" //Reuse styling
				searchNotFinished.innerHTML = "Portions of your advanced search link required flow data, which is still loading. You will be able to see the outcome of the whole search once flow data loads."
				//loadUSGS.js will delete searchNotFinished when it is not needed due to the id overlap.
				let legend = document.getElementById("legend")
				legend.parentNode.insertBefore(searchNotFinished, legend)
		}
	}
		console.log(window.usgsDataAge)
		setMenuFromSearch(query)
		NewList()
	}
	else {
		//Normal search
		let query = window.getAdvancedSearchParameters()
		query.normalSearch = search
		setMenuFromSearch(query)
		NewList()
	}
}
