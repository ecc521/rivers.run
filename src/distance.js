function lambert(lat1, lon1, lat2, lon2) {
	//Should be accurate to <100 meters

	//Parameters from WGS-84
	let radius = 3963.1905919430524 //Equatorial radius in miles
	let flattening = 0.0033528106647474805

	lat1 = lat1 / 180 * Math.PI
	lon1 = lon1 / 180 * Math.PI
	lat2 = lat2 / 180 * Math.PI
	lon2 = lon2 / 180 * Math.PI

	let ratio = 1-flattening

	let reducedLat1 = Math.atan(ratio*Math.tan(lat1))
	let reducedLat2 = Math.atan(ratio*Math.tan(lat2))

    //Spherical Law of Cosines
	let angle = Math.acos(Math.sin(reducedLat1) * Math.sin(reducedLat2) + Math.cos(reducedLat1) * Math.cos(reducedLat2) * Math.cos(lon2-lon1))

	let p = (reducedLat1+reducedLat2)/2
	let q = (reducedLat2-reducedLat1)/2
	let x = (angle - Math.sin(angle)) * (((Math.sin(p)**2)*(Math.cos(q)**2))/(Math.cos(angle/2)**2))
	let y = (angle + Math.sin(angle)) *(((Math.cos(p)**2)*(Math.sin(q)**2))/(Math.sin(angle/2)**2))
	return radius*(angle-((flattening/2)*(x+y)))
}


module.exports = {
  lambert
}
