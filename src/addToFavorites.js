const favoritesLastModifiedKey = "favoritesLastModified"
const favoritesKey = "favorites"

function writeToDisk(favorites, updateLastModifiedTime = true) {
	localStorage.setItem(favoritesKey, JSON.stringify(favorites))
	if (updateLastModifiedTime) {
		localStorage.setItem(favoritesLastModifiedKey, Date.now()) //Used to handle merging with accounts.
	}
}

function getFavoritesLastModified() {
	let lastModified = localStorage.getItem(favoritesLastModifiedKey)
	if (!lastModified) {return null}
	return Number(lastModified)
}

function loadFavorites() {
	let favorites = localStorage.getItem(favoritesKey)

	try {
		favorites = JSON.parse(favorites)
	}
	catch (e) {
		//Favorites isn't valid JSON.
		favorites = null
	}

	if (favorites === null) {
		favorites = {}
		writeToDisk(favorites, false) //Pass false so we don't update favoritesLastModified when initializing.
	}

	if (favorites[""]) {
		//Firebase doesn't accept empty strings. Relocate them.
		if (!favorites[undefined]) {favorites[undefined] = {}}
		Object.assign(favorites[undefined] = favorites[""])
		delete favorites[""]
	}

	for (let usgsID in favorites) {
		let gaugeRivers = favorites[usgsID]
		for (let riverID in gaugeRivers) {
			let river = gaugeRivers[riverID]
			for (let prop in river) {
				//Firebase does not like undefined values.
				if (river[prop] === undefined) {delete river[prop]}
			}
		}
	}


	return favorites
}

function writeFavorites(favorites) {
	let maxSections = 200

	let currentGauges = Object.keys(favorites)
	let currentSections = currentGauges.reduce((total, gaugeID) => {return total + Object.keys(favorites[gaugeID]).length}, 0)

	if (currentSections > maxSections) {
		alert(`Failed to save ${currentSections} sections to favorites (exceeds limit of ${maxSections})`)
		return false
	}

	writeToDisk(favorites)
	return true
}

function addToFavorites(favorites, river, usgsID) {
	if (usgsID === "") {usgsID = undefined} //Firebase won't accept a blank string, but will convert undefined to a string.
	if (!favorites[usgsID]) {favorites[usgsID] = {}}

	let currentDetails = favorites?.[usgsID]?.[river.id] //Current data in favorites
	if (currentDetails) {return} //Don't overwrite existing favorites.

	favorites[usgsID][river.id] = {
		id: river.id, //TODO: We don't need to store these IDs twice.
		name: river.name,
		section: river.section, //Used to help people identify at is what.

		//We'll include the default ranges initially.
		minimum: river.minrun,
		maximum: river.maxrun,
		units: river.relativeflowtype
	}
	return favorites
}

function addRiversToFavorites(rivers) {
	let favorites = loadFavorites()

	rivers.forEach((river) => {
		addToFavorites(favorites, river, river.gauge)
	})

	return writeFavorites(favorites)
}

function mergeFavoritesObjects(favorites = {}, objToMerge = {}) {
	for (let usgsID in objToMerge) {
		let gaugeRivers = objToMerge[usgsID]
		for (let riverID in gaugeRivers) {
			let river = gaugeRivers[riverID]

			if (!favorites[usgsID]) {favorites[usgsID] = {}}
			favorites[usgsID][riverID] = river
		}
	}

	return favorites
}

function addRiverToFavorites(river, usgsID) {
	return writeFavorites(
		addToFavorites(loadFavorites(), river, usgsID)
	)
}

module.exports = {
	loadFavorites,
	addRiverToFavorites,
	addRiversToFavorites,
	writeFavorites,
	getFavoritesLastModified,
	mergeFavoritesObjects,
}
