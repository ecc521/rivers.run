//TODO: Add a min, max, and unit option.
function createFavoritesWidget(river, usgsID) {

	if (localStorage.getItem("favorites") === null) {localStorage.setItem("favorites", "{}")}
	let favorites = JSON.parse(localStorage.getItem("favorites"))

	let currentDetails = favorites?.[usgsID]?.[river.id] //Current data in favorites

	//Container for the river alert creator.
	let container = document.createElement("div")
	container.className = "notificationsContainer"

	container.innerHTML = "Add " + ((usgsarray[usgsID] && usgsarray[usgsID].name) || river.name || "this river") + " to favorites to set notifications "

	let save = document.createElement("button")
	save.innerHTML = "Add To Favorites"

	save.addEventListener("click", function() {
		if (!currentDetails) {
			let temp = JSON.parse(localStorage.getItem("favorites"))
			if (!temp[usgsID]) {temp[usgsID] = {}}
			temp[usgsID][river.id] = {
				id: river.id,
				name: river.name,
				section: river.section, //Used to help people identify at is what.

				//We'll include the default ranges initially.
				minimum: river.minrun,
				maximum: river.maxrun,
				units: river.relativeFlowType?.replace("ft", "feet")?.replace("m", "meters")
			}
			localStorage.setItem("favorites", JSON.stringify(temp))
		}

		window.open("favorites.html")
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
