'use strict';


try {
	window.loadNewUSGS = "Trying to Load Data"
	if ('serviceWorker' in navigator) {
		window.serviceWorkerMessages = []
		navigator.serviceWorker.ready.then(function(registration) {
			navigator.serviceWorker.onmessage = function(event) {
				window.serviceWorkerMessages.push(event.data)
				let data = event.data

				if (!data.includes("waterservices.usgs.gov")) {return;}

				window.oldLoadUSGS = window.loadNewUSGS

				if (data.includes("Updated cache for")) {
					console.log("Updating")
					require("./loadUSGS.js").loadUSGS() //Update the information
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

//Defines window.normalSearch and window.advanedSearch
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


//Used to determine where search parameters match the default.
//This is rather ineffecient, because it has to be called twice. A new system (probably using object.keys()) should be used instead.
	function _objectsEqual(obj1, obj2) {
		//Tells if all properties, recursively, match.

		//Avoid property of undefined issues.
		if (obj1 === undefined || obj2 === undefined) {
			if (obj1 !== obj2) {return false}
			return true
		}

		for (let property in obj1) {
			if (typeof obj1[property] === "object") {
				if (!objectsEqual(obj1[property], obj2[property])) {
					return false
				}
			}
			else {
				if (obj1[property] !== obj2[property]) {
					return false
				}
			}
		}
		return true
	}

	function objectsEqual(obj1, obj2) {
		return _objectsEqual(obj1, obj2) && _objectsEqual(obj2, obj1)
	}

function deleteMatchingPortions(obj1, obj2) {
	//Deletes all properties on obj1, recursively, that are identical to obj2
	if (!obj1 || !obj2) {
		return obj1
	}
	for (let property in obj1) {
			if (typeof obj1[property] === "object") {
				if (objectsEqual(obj1[property], obj2[property])) {
					//If the objects are equal, delete them.
					delete obj1[property]
				}
				//With an array, positional data can be totally lost by this. Do not delete portions of arrays.
				else if (!(obj1[property] instanceof Array)) {
					//Delete the portions of the objects that match.
					deleteMatchingPortions(obj1[property], obj2[property])
				}
			}
			else {
				if (obj1[property] === obj2[property]) {
					delete obj1[property]
				}
			}
		}
	return obj1
}

function recursiveAssign(target, ...objects) {
	if (objects.length > 1) {
		for (let i=0;i<objects.length;i++) {
			recursiveAssign(target, objects[i])
		}
	}
	else {
		let object = objects[0]
		for (let property in object) {
			if (typeof object[property] === "object") {
				if (typeof target[property] !== "object") {
					//Fixing needed!!!
					//Right here we need to clone, recursively, object[property]
					//Object.assign() is only one level deep.
					target[property] = recursiveAssign({}, object[property])
				}
				else {
					//Setting target[property] to the result probably isn't needed.
					target[property] = recursiveAssign(target[property], object[property])
				}
			}
			else {
				target[property] = object[property]
			}
		}
	}
	return target
}

let defaultAdvancedSearchParameters;

//Generate advanced search parameters from menu
window.getAdvancedSearchParameters = function(filter) {
	//filter: Filter out parameters that match defaults.
	let parameters = {}

	parameters.name = {
		type: document.getElementById("nameType").value,
		query: document.getElementById("nameQuery").value
	}

	parameters.section  = {
		type: document.getElementById("sectionType").value,
		query: document.getElementById("sectionQuery").value
	}

	parameters.writeup = {
		type: document.getElementById("writeupType").value,
		query: document.getElementById("writeupQuery").value
	}



	let distance = Number(document.getElementById("distanceQuery").value)

	let lat = document.getElementById("latitudeQuery").value
	let lon = document.getElementById("longitudeQuery").value

	//We should only be dealing with decimal degrees here. writeupmaker.html reformats other formats to deciaml.
	lat = Number(lat)
	lon = Number(lon)

	if (!(distance > 0) && lat && lon) {
		alert("Distance must be a number greater than 0 to use location sorting")
	}
	else if (distance > 0 && !(lat && lon)) {
		alert("You must enter a latitude and longitude (Get the coordinates from GPS by pressing Calculate my Location)")
	}
	else if (distance > 0 && lat && lon) {
		parameters.location = {
			lat,
			lon,
			distance,
			includeUnknown: document.getElementById("includeUnknownLocation").checked
		}
	}

	parameters.tags = {
		query: document.getElementById("tagsQuery").value
	}


	parameters.skill = {
		type: "from",
		query: [
			Number(document.getElementById("skillQuery1").value),
			Number(document.getElementById("skillQuery2").value)
		],
		includeUnknown: document.getElementById("includeUnknownSkill").checked
	}

	parameters.normalSearch = document.getElementById("searchbox").value.toLowerCase()


	parameters.flow = {
		type: "from",
		query: [
			Number(document.getElementById("flowQuery1").value),
			Number(document.getElementById("flowQuery2").value)
		],
		includeDams: document.getElementById("includeDams").checked,
		includeUnknown: document.getElementById("includeUnknownFlow").checked
	}

	parameters.sort = {
		query: document.getElementById("sortQuery").value,
		reverse: document.getElementById("sortQueryReverse").checked
	}

	return parameters
}
defaultAdvancedSearchParameters = window.getAdvancedSearchParameters();


window.setMenuFromSearch = function(query) {
	console.log(recursiveAssign({}, query))
	console.log(window.getAdvancedSearchParameters())
	query = recursiveAssign(window.getAdvancedSearchParameters(), query)

	document.getElementById("nameType").value = query.name.type
	document.getElementById("nameQuery").value = query.name.query
	document.getElementById("sectionType").value = query.section.type
	document.getElementById("sectionQuery").value = query.section.query
	document.getElementById("writeupType").value = query.writeup.type
	document.getElementById("writeupQuery").value = query.writeup.query

	if (query.location) {
		document.getElementById("distanceQuery").value = query.location.distance
		document.getElementById("includeUnknownLocation").checked = query.location.includeUnknown
		document.getElementById("latitudeQuery").value = query.location.lat
		document.getElementById("longitudeQuery").value = query.location.lon
	}

	document.getElementById("tagsQuery").value = query.tags.query

	document.getElementById("skillQuery1").value = query.skill.query[0]
	document.getElementById("skillQuery2").value = query.skill.query[1]

	document.getElementById("searchbox").value = query.normalSearch

	document.getElementById("flowQuery1").value = query.flow.query[0]
	document.getElementById("flowQuery2").value = query.flow.query[1]
	document.getElementById("includeDams").checked = query.flow.includeDams
	document.getElementById("includeUnknownFlow").checked = query.flow.includeUnknown

	document.getElementById("sortQuery").value = query.sort.query
	document.getElementById("sortQueryReverse").checked = query.sort.reverse
}


let timesNewListCalled = 0 //Used to handle advanced search links with flow, and to prevent drawing rivers from an older search.
let previousSearchQuery; //Used to avoid spending CPU to do the same search query again.
window.NewList = function(query = recursiveAssign({}, defaultAdvancedSearchParameters, window.getAdvancedSearchParameters())) {
	//For the advanced search paramters, use the defaults in all non-specified cases. This is ineffecient because we run a search with every parameter, even when that parameter is useless (as the defaults are).

	if (objectsEqual(previousSearchQuery, query)) {
		//The search query is the same as the one that was run before. Ignore it.
		console.log("Killed search");
		return
	}
	previousSearchQuery = query
	timesNewListCalled++

	let orderedlist = ItemHolder.slice(0); //Clone the array
	orderedlist = advancedSearch(orderedlist, query)

	//Clear Current
	ItemHolder.forEach(function(event) {
		event.delete()
	})

	//Append New
	var div = document.getElementById("Rivers")
	//To avoid lagging, append a small amount of rivers at the start, then finish adding rivers in the background.
	let completed = 0
	let callNumber = timesNewListCalled

	function drawMore(num) {
		//Draw num more rivers to the screen.
		for (let i=0;completed<orderedlist.length && i<num;i++) {
			div.appendChild(orderedlist[completed].create())
			completed++
		}
		return completed < orderedlist.length
	}
	drawMore(30) //Draw the first 30 immediately.
	function asyncDraw(number = 5) {
		let start = Date.now()
		if (callNumber === timesNewListCalled && drawMore(number)) {
			let time = Date.now() - start
			//Wait either 16 milliseconds, or twice as long as drawing took, before drawing more.
			//Try to use up 3-4 milliseconds per draw.
			if (time < 3) {number++}
			if (time > 4) {number--}
			setTimeout(asyncDraw, Math.max(16, time*2), number)
		}
	}
	asyncDraw(navigator.hardwareConcurrency || 4) //Using navigator.hardwareConcurrency to guess at device performance.



	query = deleteMatchingPortions(query, defaultAdvancedSearchParameters) //Filter out parameters where the default is used.

	//Add link to this search to the advanced search menu.
	let link;
	//If the only parameter is normalSearch, create a normal search link.
	if (query.normalSearch && objectsEqual(query, {normalSearch:query.normalSearch})) {
		link = encodeURI(window.location.href + "#" + query.normalSearch)
	}
	else if (objectsEqual(query, {})) {
		link = window.location.href //There is no search. Provide the link to this page.
	}
	else {
		link = encodeURI(window.location.href + "#" + JSON.stringify(query))
	}
	document.getElementById("searchlink").innerHTML = "Link to this search: <a target=\"_blank\" href=\"" + link + "\">" + link + "</a>"
}

document.getElementById("Rivers").appendChild(new TopBar().create())
//createLegend.js needs a #Rivers > .riverbutton to get font-size using getComputedStyle
require("./createLegend.js")

NewList()


let searchbox = document.getElementById("searchbox")
let searchboxOnAdvancedSearch = document.getElementById("normalSearchBoxOnAdvancedSearch")
function searchBoxKeyPress(event) {
	//If the user presses the "Go" button (Actually an Enter/Return), unfocus the searchbox.
	if (event.keyCode === 13) {
		event.target.blur()
	}
	let query = window.getAdvancedSearchParameters()
	query.sort.query = "none" //Normal searches apply their own sorting. query.sort will override this.
	NewList(query)
	searchboxOnAdvancedSearch.value = searchbox.value
}
searchbox.addEventListener("keyup", searchBoxKeyPress)

searchboxOnAdvancedSearch.addEventListener("keyup", function() {
	searchbox.value = searchboxOnAdvancedSearch.value
	searchBoxKeyPress({}) //Pass an empty object to avoid error reading property of undefined.
})



//Advanced search event listeners.
//When parameters are changed, run the search.
let elements = document.querySelectorAll("#advanced-search-modal > .modal-content > input[type=text]")
for (let i=0;i<elements.length;i++) {
	elements[i].addEventListener("keyup", function() {
		//If the user presses the "Go" button (Actually an Enter/Return), unfocus the searchbox.
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
		let output = "Error code " + e.code + " occurred when getting your location. The error message is: " + e.message
		alert(output)
		clearInterval(progress)
		status.innerHTML = output
	}


	let coords = position.coords

	clearInterval(progress)

	document.getElementById("latitudeQuery").value = coords.latitude
	document.getElementById("longitudeQuery").value = coords.longitude
	status.innerHTML = "You are within " + coords.accuracy + " meters of " + coords.latitude + " degrees latitude and " + coords.longitude + " degrees longitude."
}

document.getElementById("calculateCoordinates").addEventListener("click", calculateCoordinates)

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
		document.getElementById("searchbox").value = search
		NewList()
	}
}
