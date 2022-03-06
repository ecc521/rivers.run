function toDecimalDegrees(coord) {
	if (!isNaN(Number(coord))) {
		return Number(coord) //Coordinate is already in decimal form.
	}

	if (typeof coord !== "string") {
		return undefined;
	}

	coord = coord.toUpperCase().trim() //In case people put the direction in lowercase.

	let direction;
	["N","S","E","W","-"].forEach((currentDirection) => {
		if (coord.includes(currentDirection)) {
			direction = currentDirection
			coord = coord.slice(0, coord.indexOf(currentDirection)) + coord.slice(coord.indexOf(currentDirection) + 1)
			coord = coord.trim()
		}
	})

	let parts = coord.split(/[^.\w]+/) //Split on non-alphanumeric characters that aren't decimals.

	let degrees = Number(parts[0])
	let minutes = Number(parts[1]) || 0
	let seconds = Number(parts[2]) || 0

	minutes += seconds/60
	degrees += minutes/60

	if (isNaN(Number(degrees))) {throw "Coordinate " + coord + " could not be processed."}

	if (direction === "S" || direction === "W" || direction === "-") {degrees = -degrees}

	return degrees
}

module.exports = toDecimalDegrees
