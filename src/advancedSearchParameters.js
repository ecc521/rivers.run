function highlightFailingFields(parameters) {
	//Input checking. Highlight fields that fail in red.
	if (!toDecimalDegrees(parameters.location.lat) && (toDecimalDegrees(parameters.location.lon) || Number(parameters.location.distance) > 0)) {
		document.getElementById("latitudeQuery").style.border = "3px solid red"
	}
	else {
		document.getElementById("latitudeQuery").style.border = ""
	}
	
	if (!toDecimalDegrees(parameters.location.lon) && (toDecimalDegrees(parameters.location.lat) || Number(parameters.location.distance) > 0)) {
		document.getElementById("longitudeQuery").style.border = "3px solid red"
	}
	else {
		document.getElementById("longitudeQuery").style.border = ""
	}
	
	if (!(Number(parameters.location.distance) > 0) && (toDecimalDegrees(parameters.location.lat) || toDecimalDegrees(parameters.location.lon))) {
		document.getElementById("distanceQuery").style.border = "3px solid red"
	}
	else {
		document.getElementById("distanceQuery").style.border = ""
	}
}


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

	parameters.location = {
		lat: document.getElementById("latitudeQuery").value,
		lon: document.getElementById("longitudeQuery").value,
		distance: document.getElementById("distanceQuery").value,
		includeUnknown: document.getElementById("includeUnknownLocation").checked
	}

	//ID search is currently hidden from the user.
	parameters.id = window.IDSearchParameters

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

	parameters.normalSearch = document.getElementById("searchbox").value

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
	
	highlightFailingFields(parameters)

	return parameters
}


window.setMenuFromSearch = function(query) {
	query = recursiveAssign(window.getAdvancedSearchParameters(), query)

	document.getElementById("nameType").value = query.name.type
	document.getElementById("nameQuery").value = query.name.query
	document.getElementById("sectionType").value = query.section.type
	document.getElementById("sectionQuery").value = query.section.query
	document.getElementById("writeupType").value = query.writeup.type
	document.getElementById("writeupQuery").value = query.writeup.query

	document.getElementById("distanceQuery").value = query.location.distance
	document.getElementById("includeUnknownLocation").checked = query.location.includeUnknown
	document.getElementById("latitudeQuery").value = query.location.lat
	document.getElementById("longitudeQuery").value = query.location.lon

	document.getElementById("tagsQuery").value = query.tags.query

	document.getElementById("skillQuery1").value = query.skill.query[0]
	document.getElementById("skillQuery2").value = query.skill.query[1]
	document.getElementById("includeUnknownSkill").checked = query.skill.includeUnknown

	document.getElementById("searchbox").value = query.normalSearch
	document.getElementById("normalSearchBoxOnAdvancedSearch").value = query.normalSearch

	document.getElementById("flowQuery1").value = query.flow.query[0]
	document.getElementById("flowQuery2").value = query.flow.query[1]
	document.getElementById("includeDams").checked = query.flow.includeDams
	document.getElementById("includeUnknownFlow").checked = query.flow.includeUnknown

	document.getElementById("sortQuery").value = query.sort.query
	document.getElementById("sortQueryReverse").checked = query.sort.reverse
	//ID search is currently hidden from the user.
	window.IDSearchParameters = query.id
	
	highlightFailingFields(query)
}


//Previously I just used the initial state of the HTML fields to calculate defaultAdvancedSearchParameters (call getAdvancedSearchParameters at page load) - 
//However Chrome will remember the state of input fields if the hits the back button to go back to the page (sometimes with the app to), causing issues.
//This is probably a feature intended to stop users from losing form inputs if they navigate accidentally - meaning that filing a bug report would be useless.
window.defaultAdvancedSearchParameters = {
  "name": {
    "type": "contains",
    "query": ""
  },
  "section": {
    "type": "contains",
    "query": ""
  },
  "writeup": {
    "type": "contains",
    "query": ""
  },
  "location": {
    "lat": "",
    "lon": "",
    "distance": "",
    "includeUnknown": false
  },
  "tags": {
    "query": ""
  },
  "skill": {
    "type": "from",
    "query": [1, 8],
    "includeUnknown": true
  },
  "normalSearch": "",
  "flow": {
    "type": "from",
    "query": [0, 4],
    "includeDams": true,
    "includeUnknown": true
  },
  "sort": {
    "query": "none",
    "reverse": false
  }
};

window.setMenuFromSearch(window.defaultAdvancedSearchParameters)