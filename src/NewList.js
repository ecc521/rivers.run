window.timesNewListCalled = 0 //Used to handle advanced search links with flow, and to prevent drawing rivers from an older search.
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
	
	function drawMore(milliseconds = 8, lastDrawn) {
		//Draw rivers to the screen for milliseconds milliseconds.
		let start = Date.now()
		for (;completed<orderedlist.length;completed++) {
			//We won't draw more if we have already drawn more than 5 times the windows height below where the user has scrolled to.
			//This will help keep performance reasonable.
			//TODO: Draw only the window height. Wait small amount of time to see if NewList is called again (so typing in searchbox, etc). If not, resume drawing to 5x.
			if (lastDrawn && lastDrawn.offsetTop - window.innerHeight * 5 > window.scrollY) {break;}
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
	function asyncDraw(lastDrawn) {
		let drawing = drawMore(8, lastDrawn)
		if (callNumber === timesNewListCalled && !drawing.finished) {
			setTimeout(asyncDraw, Math.max(16, drawing.time*2), drawing.lastDrawn)
		}
	}
	asyncDraw()

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
	
	document.getElementById("searchlink").innerHTML = "Link to this search: <a target=\"_blank\" href=\"" + link + "\">" + link + "</a>"
	
	try {
		history.replaceState("",document.title, link)
	}
	catch(e) {console.error(e)}

	//If there are parameters other than normalSearch and sort, show the advanced search warning
	if (objectsEqual(query, {normalSearch:query.normalSearch,sort:query.sort})) {
		document.getElementById("advancedSearchWarning").style.display = "none" //No parameters other than sort and normalSearch
	}
	else {
		document.getElementById("advancedSearchWarning").style.display = "block" //Advanced search is in affect!
	}
}
