



'use strict';


try {
	window.loadNewUSGS = "Trying to Load Data"
	window.serviceWorkerMessages = []
	//window.serviceWorkerRegistered will be called by allPages.js
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


var oldresult;
window.NewList = function(query, type, reverse) {
	if (typeof(query) === "string") {
		query = query.toLowerCase()
	}
	//Location searching uses numbers.

	let orderedlist = ItemHolder.slice(0); //Clone the array
	if (!(String(query).length === 0 || !query || !type)) {

		if (type === "sort") {
			//Obey other filters
			if (oldresult) {
				orderedlist = oldresult
			}

			orderedlist = sort(query, orderedlist, reverse)
		}
		if (type === "normal") {
			orderedlist = normalSearch(orderedlist, query)
		}
		if (type === "advanced") {
			orderedlist = advancedSearch(orderedlist, query)
		}
		if (type === "location") {
			if (oldresult) {
				orderedlist = oldresult
			}

			var nlist = []
			orderedlist.forEach(function(value){
				if (value.plat && value.plon) {
					if (distanceto(value.plat, value.plon) < query) {
						nlist.push(value)
					}
				}
			})
			orderedlist = nlist
		}


	}//Closing for if a query is present
	else if (type = "normal" && query.length === 0) {
		orderedlist = normalSearch(orderedlist, query)
	}

	//Clear Current
	ItemHolder.forEach(function(event) {
		event.delete()
	})
	//Append New
	var div = document.getElementById("Rivers")
	//Everything else
	orderedlist.forEach(function(event){
		div.appendChild(event.create())
	})

	if (type !== "sort") {
		oldresult = orderedlist
	}
}


document.getElementById("Rivers").appendChild(new TopBar().create())
//Needs a #Rivers > .riverbutton to get font-size using getComputedStyle
require("./createLegend.js")


NewList("alphabetical", "sort")


let searchbox = document.getElementById("searchbox")
searchbox.addEventListener("keyup", function(){NewList(searchbox.value, "normal")})


//Used to determine where search parameters match the default.
	function objectsEqual(obj1, obj2) {
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



let defaultAdvancedSearchParameters = getAdvancedSearchParameters();

//Generate advanced search parameters from menu
function getAdvancedSearchParameters() {
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

	//TODO: Parse other latitude and longitude formats
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
		]
	}

	parameters.flow = {
		type: "from",
		query: [
			Number(document.getElementById("flowQuery1").value),
			Number(document.getElementById("flowQuery2").value)
		],
		includeUnknown: document.getElementById("includeUnknownFlow").checked
	}

	parameters.sort = {
		query: document.getElementById("sortQuery").value,
		reverse: document.getElementById("sortQueryReverse").checked
	}
	
	//If a specific parameter matches the default, exclude.
	//Check for undefined, because this function is used to define defaultAdvancedSearchParameters
	
	
	if (defaultAdvancedSearchParameters !== undefined) {
		//TODO: Consolodate properties of each of the parameters. 
		for (let property in parameters) {
			if (objectsEqual(parameters[property], defaultAdvancedSearchParameters[property])) {
				delete parameters[property]
			}
		}
	}
	

	return parameters
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




document.getElementById("performadvancedsearch").addEventListener("click", function() {
	let query = getAdvancedSearchParameters()

	//Add link to this search
	//This should run before NewList - otherwise the entire content is added to the object and URL
	//Find where rivers.run is located
	//This should allow rivers.run to the run from a directory
	let root = window.location.href
	root = root.slice(0,root.lastIndexOf("/") + 1) //Add 1 so we don't clip trailing slash
	let link = encodeURI(root + "#" + JSON.stringify(query))
	document.getElementById("searchlink").innerHTML = "Link to this search: <a target=\"_blank\" href=\"" + link + "\">" + link + "</a>"
	
	NewList(query, "advanced", false) //Reversing advanced search is handled in the sort.reverse portion of the parameters.
})








//Check if there is a search query
if (window.location.hash.length > 0) {
	let search = decodeURI(window.location.hash.slice(1))

	try {
		//Do an advanced search if the query if an advanced search
		let query = JSON.parse(search)
		query = Object.assign({}, defaultAdvancedSearchParameters, query) //Use default parameters in all non-specified cases.

		//TODO: Set the advanced search areas to the query.

		NewList(query, "advanced")


	}
	catch (e) {
		//Looks like we have a normal search query
		document.getElementById("searchbox").value = search
		NewList(search, "normal")
	}
}
