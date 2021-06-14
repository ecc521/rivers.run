const {loadFavorites, addRiverToFavorites, addRiversToFavorites} = require("./addToFavorites.js")

//What's the right code file for this function?
//Enable the addAllToFavorites button.
let addAllToFavorites = document.getElementById("addAllToFavorites")
addAllToFavorites.addEventListener("click", function() {
	let riversToAdd = window.currentlyShown //Set by NewList.js whenever this is set.

	let message = `Add `
	let riverAmount = riversToAdd.riverAmount
	let gaugeAmount = riversToAdd.gaugeAmount

	if (riverAmount === 1) {message += "1 river"}
	else if (riverAmount > 1) {message += riverAmount + " rivers"}

	if (riverAmount > 0 && gaugeAmount > 0) {message += " and "}

	if (gaugeAmount === 1) {message += "1 gauge"}
	else if (gaugeAmount > 1) {message += gaugeAmount + " gauges"}

	if (riverAmount === 0 && gaugeAmount === 0) {return alert("Your search returned 0 results, so nothing can be added. ")}

	if (confirm(message + " to favorites?")) {
		addRiversToFavorites(riversToAdd)

		window.location = "favorites.html"
	}
})



function createFavoritesWidget(river, usgsID) {
	let favorites = loadFavorites()
	let currentDetails = favorites?.[usgsID]?.[river.id] //Current data in favorites

	//Container for the river alert creator.
	let container = document.createElement("div")
	container.className = "notificationsContainer"

	container.innerHTML = "Add " + ((usgsarray[usgsID] && usgsarray[usgsID].name) || river.name || "this river") + " to favorites to set notifications "

	let save = document.createElement("button")
	save.innerHTML = "Add To Favorites"

	save.addEventListener("click", function() {
		if (!currentDetails) {
			addRiverToFavorites(river, usgsID) //This does check for existing favorites as well, but no reason to call loadFavorites twice.
		}

		window.location = "favorites.html"
	})

	if (currentDetails) {
		save.innerHTML = "Open Favorites"
		container.innerHTML = ((usgsarray[usgsID] && usgsarray[usgsID].name) || river.name || "This river") + " is a favorite "
	}

	container.appendChild(save)

	return container
}


module.exports = {
	createFavoritesWidget
}
