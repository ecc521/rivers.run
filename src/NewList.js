window.timesNewListCalled = 0 //Used to handle advanced search links with flow, and to prevent drawing rivers from an older search.
window.currentlyShown;
let previousSearchQuery; //Used to avoid spending CPU to do the same search query again.
window.NewList = function(query = recursiveAssign({}, defaultAdvancedSearchParameters, window.getAdvancedSearchParameters()), options = {}) {
	//For the advanced search paramters, use the defaults in all non-specified cases. This is ineffecient because we run a search with every parameter, even when that parameter is useless (as the defaults are).
	console.log(options)
	if (objectsEqual(previousSearchQuery, query) && !options.noSameSearch) {
		//The search query is the same as the one that was run before. Ignore it.
		console.log("Killed search. Pass noSameSearch in options to override this. ");
		return
	}
	previousSearchQuery = window.recursiveAssign({}, query)
	timesNewListCalled++

	let orderedlist = ItemHolder.slice(0); //Clone the array
	orderedlist = advancedSearch(orderedlist, query)
	window.currentlyShown = orderedlist

	//Clear Current
	ItemHolder.forEach(function(event) {
		event.delete()
	})
	document.querySelectorAll(".gaugesBelow").forEach((elem) => {elem.remove()})

	let useGauges = orderedlist.useGauges

	//Append New
	var div = document.getElementById("Rivers")
	//To avoid lagging, append a small amount of rivers at the start, then finish adding rivers in the background.
	let completed = 0
	let callNumber = timesNewListCalled

	function drawMore(milliseconds = 8, options = {}) {
		let lastDrawn = options.lastDrawn

		//We won't draw more if we have already drawn more than 5 times the windows height below where the user has scrolled to.
		//This will help keep performance reasonable.
		//TODO: Draw only the window height. Wait small amount of time to see if NewList is called again (so typing in searchbox, etc). If not, resume drawing to 5x.
		//If we do this inside the loop, it destroys performance of rendering.
		if (lastDrawn && lastDrawn.offsetTop - window.innerHeight * 5 > window.scrollY) {return {lastDrawn, finished: false, time: 0}}

		//Draw rivers to the screen for milliseconds milliseconds.
		let start = Date.now()
		for (;completed<orderedlist.length;completed++) {

			if (orderedlist[completed].isGauge && !options.useGauges) {continue}
			if (!orderedlist[completed].isGauge && options.onlyGauges) {continue}

			//If we have exceeded allocated time, or NewList has been called again (so another draw process is in place), stop drawing.
			if (Date.now() - start > milliseconds || callNumber !== timesNewListCalled) {break;}
			let riverbutton = orderedlist[completed].create()
			lastDrawn = riverbutton
			div.appendChild(riverbutton)
		}
		return {
			finished: completed >= orderedlist.length,
			time: Date.now() - start, //Really slow devices may take more than the allocated amount of time to finish
			lastDrawn
		}
	}
	function asyncDraw(options = {}) {
		let oldCompleted = completed
		let drawing = drawMore(8, options)

		if (drawing.finished && !useGauges) {
			useGauges = true;
			completed = 0;
			drawing.finished = false
			if (orderedlist.gaugeAmount > 0) {
				//Add an element that says gauges are shown below.
				let gaugesBelow = document.createElement("div")
				gaugesBelow.classList.add("riverbutton")
				gaugesBelow.classList.add("gaugesBelow")
				let span = document.createElement("span")
				span.innerHTML = "Gauges Matching your Search are Shown Below"
				gaugesBelow.appendChild(span)
				span.style.width = "100%"
				div.appendChild(gaugesBelow)
			}
		}
		if (callNumber === timesNewListCalled && !drawing.finished) {
			let minTime = 16
			if (completed === oldCompleted) {minTime = 64} //If we didn't draw any rivers (enough already drawn), save some CPU by increasing the amount of time between executions.
			setTimeout(asyncDraw, Math.max(minTime, drawing.time*2), {
				lastDrawn: drawing.lastDrawn,
				useGauges,
				onlyGauges: (useGauges !== orderedlist.useGauges)
			})
		}
	}
	asyncDraw({useGauges, onlyGauges: (useGauges !== orderedlist.useGauges)})

	query = deleteMatchingPortions(query, defaultAdvancedSearchParameters) //Filter out parameters where the default is used.

	//Add link to this search to the advanced search menu.
	let link;
	//If the only parameter is normalSearch, create a normal search link.
	if (query.normalSearch && objectsEqual(query, {normalSearch:query.normalSearch})) {
		link = encodeURI(window.root + "#" + query.normalSearch)
	}
	else if (objectsEqual(query, {})) {
		link = window.root //There is no search. Provide the link to this page.
	}
	else {
		link = encodeURI(window.root + "#" + JSON.stringify(query))
		//There are advanced search parameters other than normalSearch. Show the advanced search warning.
	}

	let searchLink = document.getElementById("searchlink")
	searchLink.innerHTML = "Link to this search: "

	//Clicking this link shouldn't do anything - just copy the link.
	let span = document.createElement("a")

	//On iOS, we want to make sure it points to https://rivers.run as well.
	let rrunLink = new URL("https://rivers.run/")
	rrunLink.hash = new URL(link).hash

	window.location.hash = new URL(link).hash //Update current hash to match searchlink.
	span.href = rrunLink //So user can "copy link address" or similar.
	span.innerHTML += rrunLink

	function copyStringToClipboard(str) {
		// Create new element
		var el = document.createElement('textarea');
		// Set value (string to be copied)
		el.value = str;
		// Set non-editable to avoid focus and move outside of view
		el.setAttribute('readonly', '');
		el.style = {position: 'absolute', left: '-9999px'};
		document.body.appendChild(el);
		// Select text inside element
		el.select();
		// Copy text to clipboard
		document.execCommand('copy');
		// Remove temporary element
		document.body.removeChild(el);
	}

	span.addEventListener("click", function(e) {
		copyStringToClipboard(rrunLink)
		alert("Link Copied!")
		e.preventDefault() //Prevent navigation. 
	})
	searchLink.appendChild(span)

	//If there are parameters other than normalSearch and sort, show the advanced search warning
	if (objectsEqual(query, {normalSearch:query.normalSearch,sort:query.sort})) {
		document.getElementById("advancedSearchWarning").style.display = "none" //No parameters other than sort and normalSearch
	}
	else {
		document.getElementById("advancedSearchWarning").style.display = "block" //Advanced search is in affect!
	}
}
