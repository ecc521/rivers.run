function haversine(lat1, lon1, lat2, lon2) { 
	//Haversine formula
	//Based off of the Spherical Law of Cosines. Was much more accurate with small distances when using 32 bit floats
	//No significant difference now
	
	let radius = 3958.8 //Earth's mean radius in miles
	lat1 = lat1 * Math.PI / 180
	lon1 = lon1 * Math.PI / 180
	lat2 = lat2 * Math.PI / 180
	lon2 = lon2 * Math.PI / 180  
  //1 - Math.cos() is a versine - half of that is a haversine
  let dLat = lat2 - lat1;
  let dLon = lon2 - lon1;
  let a =
    0.5 - Math.cos(dLat) / 2 +
    Math.cos(lat1) * Math.cos(lat2) *
    (1 - Math.cos(dLon)) / 2;

  return radius * 2 * Math.asin(Math.sqrt(a));
}
    

function cosines(lat1, lon1, lat2, lon2) {
	//Spherical Law of Cosines
	let radius = 3958.8 //Earth's mean radius in miles

	lat1 = lat1 * Math.PI / 180
	lon1 = lon1 * Math.PI / 180
	lat2 = lat2 * Math.PI / 180
	lon2 = lon2 * Math.PI / 180
	return Math.acos(Math.sin(lat1) * Math.sin(lat2) + Math.cos(lat1) * Math.cos(lat2) * Math.cos(lon2-lon1))*radius
}



function lambert(lat1, lon1, lat2, lon2) {
	//Should be accurate to around 10 meters
	
	//Parameters from WGS-84
	let radius = 3963.1905919430274 //Equatorial radius in miles
	let flattening = 0.0033528106647474805

	lat1 = lat1 * Math.PI / 180
	lon1 = lon1 * Math.PI / 180
	lat2 = lat2 * Math.PI / 180
	lon2 = lon2 * Math.PI / 180

	let ratio = 1-flattening
	
	let reducedLat1 = Math.atan(ratio*Math.tan(lat1))
	let reducedLat2 = Math.atan(ratio*Math.tan(lat2))
	
	let angle = Math.acos(Math.sin(reducedLat1) * Math.sin(reducedLat2) + Math.cos(reducedLat1) * Math.cos(reducedLat2) * Math.cos(lon2-lon1))
	
	let p = (reducedLat1+reducedLat2)/2
	let q = (reducedLat2-reducedLat1)/2
	let x = (angle - Math.sin(angle)) * (((Math.sin(p)**2)*(Math.cos(q)**2))/(Math.cos(angle/2)**2))
	let y = (angle + Math.sin(angle)) *(((Math.cos(p)**2)*(Math.sin(q)**2))/(Math.sin(angle/2)**2))
	return radius*(angle-((flattening/2)*(x+y)))	
}


//Vincenty's formula was just too much... ~10 meters from lambert is accurate enough
module.exports = {
  lambert,
  cosines,
  haversine
}
