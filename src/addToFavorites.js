function loadFavorites() {
	let favorites = localStorage.getItem("favorites")

	try {
		favorites = JSON.parse(favorites)
	}
	catch (e) {
		//Favorites isn't valid JSON.
		favorites = null
	}

	if (favorites === null) {
		localStorage.setItem("favorites", "{}")
		return {}
	}
	return favorites
}

function writeFavorites(temp) {
	let maxSections = 200

	let currentGauges = Object.keys(temp)
	let currentSections = currentGauges.reduce((total, gaugeID) => {return total + Object.keys(temp[gaugeID]).length}, 0)

	if (currentSections > maxSections) {
		alert(`Failed to save ${currentSections} sections to favorites (exceeds limit of ${maxSections})`)
		return false
	}

	localStorage.setItem("favorites", JSON.stringify(temp))
	return true
}

function addToFavorites(temp, river, usgsID) {
	if (!temp[usgsID]) {temp[usgsID] = {}}

	let currentDetails = temp?.[usgsID]?.[river.id] //Current data in favorites
	if (currentDetails) {return} //Don't overwrite existing favorites.

	temp[usgsID][river.id] = {
		id: river.id,
		name: river.name,
		section: river.section, //Used to help people identify at is what.

		//We'll include the default ranges initially.
		minimum: river.minrun,
		maximum: river.maxrun,
		units: river.relativeflowtype
	}
	return temp
}

function addRiversToFavorites(rivers) {
	let temp = loadFavorites()

	rivers.forEach((river) => {
		addToFavorites(temp, river, river.gauge)
	})

	return writeFavorites(temp)
}

function addRiverToFavorites(river, usgsID) {
	return writeFavorites(
		addToFavorites(loadFavorites(), river, usgsID)
	)
}

module.exports = {
	loadFavorites,
	addRiverToFavorites,
	addRiversToFavorites
}
