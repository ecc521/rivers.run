module.exports = function(river, usgsID) {
	if (localStorage.getItem("favorites") === null) {localStorage.setItem("favorites", "{}")}

	let temp = JSON.parse(localStorage.getItem("favorites"))
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
	localStorage.setItem("favorites", JSON.stringify(temp))
}
