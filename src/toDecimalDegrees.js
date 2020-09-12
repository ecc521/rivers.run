((typeof window !== "undefined" && window) || globalThis).toDecimalDegrees = function(coord) {
	if (!isNaN(Number(coord))) {
		return Number(coord) //Coordinate is already in decimal form.
	}

	if (typeof coord !== "string") {
		return undefined;
	}

	coord = coord.toUpperCase().trim() //In case people put the direction in lowercase.

	let direction;
	if (["N","S","E","W"].includes(coord[0])) {
		direction = coord[0];
		coord = coord.slice(1).trim()
	}

	let parts = coord.split(/[^.\w]+/) //Split on non-alphanumeric characters that aren't decimals.

	let degrees = Number(parts[0])
	let minutes = Number(parts[1]) || 0
	let seconds = Number(parts[2]) || 0

	minutes += seconds/60
	degrees += minutes/60

	if (isNaN(Number(degrees))) {throw "Coordinate " + coord + " could not be processed."}

	if (direction === "S" || direction === "W") {degrees = -degrees}

	return degrees
}
