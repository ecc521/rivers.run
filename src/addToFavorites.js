function loadFavorites() {
	if (localStorage.getItem("favorites") === null) {localStorage.setItem("favorites", "{}")}
	return JSON.parse(localStorage.getItem("favorites"))
}

function writeFavorites(temp) {
	localStorage.setItem("favorites", JSON.stringify(temp))
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
		units: river.relativeFlowType?.replace("ft", "feet")?.replace("m", "meters")
	}
	return temp
}

function addRiversToFavorites(rivers) {
	let temp = loadFavorites()

	rivers.forEach((river) => {
		addToFavorites(temp, river, river.gauge)
	})

	writeFavorites(temp)
}

function addRiverToFavorites(river, usgsID) {
	writeFavorites(
		addToFavorites(loadFavorites(), river, usgsID)
	)
}

module.exports = {
	loadFavorites,
	addRiverToFavorites,
	addRiversToFavorites
}
