const {loadFavorites, addRiverToFavorites, addRiversToFavorites} = require("./addToFavorites.js")

function createFavoritesWidget(river, usgsID) {
	let favorites = loadFavorites()
	let currentDetails = favorites?.[usgsID]?.[river.id] //Current data in favorites

	//Container for the river alert creator.
	let container = document.createElement("div")
	container.className = "notificationsContainer"

	container.innerHTML = "Add " + ((gauges[usgsID] && gauges[usgsID].name) || river.name || "this river") + " to favorites to set notifications "

	let save = document.createElement("button")
	save.innerHTML = "Add To Favorites"

	save.addEventListener("click", function() {
		//If currentDetails is true, the button is Open Favorites, so always navigate to favorites page.
		//If false, we are adding, so only navigate if it was successfully added.
		let shouldNavigate = true
		if (!currentDetails) {
			shouldNavigate = addRiverToFavorites(river, usgsID) //This does check for existing favorites as well, but no reason to call loadFavorites twice.
		}

		if (shouldNavigate) {
			window.location = "favorites.html"
		}
	})

	if (currentDetails) {
		save.innerHTML = "Open Favorites"
		container.innerHTML = ((gauges[usgsID] && gauges[usgsID].name) || river.name || "This river") + " is a favorite "
	}

	container.appendChild(save)

	return container
}


module.exports = {
	createFavoritesWidget
}
