self.usgsarray = {}

window.updateOldDataWarning = function() {

		let toDelete = document.getElementById("topOldDataWarning")
		if (toDelete) {toDelete.remove()}

		if (!window.usgsDataAge) {return}
		//No reason to make an old data warning when data is new (within 1 hour)
		//Make sure to change the warning text so that if the data becomes old while the page is open, they are not confused.
		if (window.usgsDataAge < 1000*60*60) {
			window.loadNewUSGS = "Flow Data has become old while this page was open. Click try again to update."
			return
		}

		let oldDataWarning = document.createElement("p")
		oldDataWarning.id = "topOldDataWarning"

		oldDataWarning.innerHTML = "Flow previews are more than " + Math.floor(window.usgsDataAge/1000/60/60) + " hours old! "
		oldDataWarning.innerHTML += "(" + window.loadNewUSGS + ") "

					let reloadButton = document.createElement("button")

						reloadButton.addEventListener("click", function() {
							window.loadNewUSGS = "Trying to Load Data"
							require("./loadUSGS.js").loadUSGS()
						})
						reloadButton.innerHTML = "Try Again"


					oldDataWarning.appendChild(reloadButton)


		let legend = document.getElementById("legend")
		if (legend) {
			legend.parentNode.insertBefore(oldDataWarning, legend)
		}
}


function updateUSGSDataInfo() {
	window.usgsDataAge = Date.now() - window.requestTime
	window.updateOldDataWarning()
}
setInterval(updateUSGSDataInfo, 1000*60*1) //Every minute, make sure that the data has not become old. If it has, display a warning.

//When the data updates, rerun the current search.
window.addEventListener("usgsDataUpdated", function() {
	let query = getAdvancedSearchParameters()
	if (
		(//Make sure flow searching or sorting is being performed, so that re-running the search may make a difference.
			!objectsEqual(query.flow, defaultAdvancedSearchParameters.flow) //Flow search
			|| (query.sort.query === "running") //Flow sort
		)
		&& timesLoadUSGSRan >= 2 //And this is actually an update to the data, not the first load
		&& ItemHolder.length !== 0 //And that there are actually rivers to update - the flow data could have loaded first.
		&& (//Make sure we don't close writeups that the user is looking at without their permission.
			ItemHolder.every(river => !river.expanded) //If no writeups are open, we can continue
			|| confirm("USGS data has been updated. Would you like to re-run the previous search?") //Otherwise, ask the user if they would like the update.
		)
	) {NewList(undefined,{noSameSearch:true})}
})


let timesLoadUSGSRan = 0
let loadUSGS = async function(useCache) {
	//Gaurd against infinite recursion. Ignores calls when data is new. (within 5 minutes)
	if (window.usgsDataAge < 1000*60*5) {
		return;
	}

	timesLoadUSGSRan++

	let fileName = "flowdata3.json"

	if (useCache) {
		let cache = await caches.open("rivers.run")
		let response = await caches.match(fileName)
		window.usgsarray = await response.json()
	}
	else {
		let response = await fetch(fileName)
		window.usgsarray = await response.json()
	}


	window.requestTime = usgsarray.generatedAt
	updateUSGSDataInfo()

	window.dispatchEvent(new Event("usgsDataUpdated"))

	console.time("updatingRivers")
	//Add USGS Data to Graph
	for (let i=0;i<ItemHolder.length;i++) {
		try {
			let river = ItemHolder[i]
			river.updateFlowData()
		}
		catch(e) {
			console.error(e)
		}
	}
	console.timeEnd("updatingRivers")
}


module.exports = {
	loadUSGS
}
