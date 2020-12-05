const addMap = require("./src/Mapper.js").addMap
window.River = require("./src/River.js").River


;(async function() {

	//ItemHolder is a list of all the river objects. New objects should be pushed into the list.
	window.ItemHolder = []

	//Load flow information. This is async, and will finish whenever.
	require("./src/loadUSGS.js").loadUSGS(false)

	//Load river data so that the page can be rendered.
	let fileName = "riverdata.json"
	if (window.fetch) {
		let response = await fetch(fileName)
		window.riverarray = await response.json()
	}
	else {
		//For browsers that don't support fetch
		let request = new XMLHttpRequest()
		let response = await new Promise((resolve, reject) => {
			request.onload = function(event) {resolve(event.target.response)};
			request.open("GET", fileName);
			request.send()
		})
		window.riverarray = JSON.parse(response)
	}

	console.time("Create River Objects")
	riverarray.forEach(function(event, index) {
		ItemHolder[index] = new River(index, event)
	})
	console.timeEnd("Create River Objects")

	let map = await addMap()
	window.addEventListener("usgsDataUpdated", function() {
		map.updateMarkers()
	})
	document.body.appendChild(map)
}())
