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

	if (!lat && (lon || distance > 0)) {
		document.getElementById("latitudeQuery").style.border = "3px solid red"
	}
	if (!lon && (lat || distance > 0)) {
		document.getElementById("longitudeQuery").style.border = "3px solid red"
	}
	if (!(distance > 0) && (lat || lon)) {
		document.getElementById("distanceQuery").style.border = "3px solid red"
	}

	if (distance > 0 && lat && lon) {
		document.getElementById("latitudeQuery").style.border = ""
		document.getElementById("longitudeQuery").style.border = ""
		document.getElementById("distanceQuery").style.border = ""

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
window.defaultAdvancedSearchParameters = window.getAdvancedSearchParameters();


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
	document.getElementById("normalSearchBoxOnAdvancedSearch").value = query.normalSearch

	document.getElementById("flowQuery1").value = query.flow.query[0]
	document.getElementById("flowQuery2").value = query.flow.query[1]
	document.getElementById("includeDams").checked = query.flow.includeDams
	document.getElementById("includeUnknownFlow").checked = query.flow.includeUnknown

	document.getElementById("sortQuery").value = query.sort.query
	document.getElementById("sortQueryReverse").checked = query.sort.reverse
}
