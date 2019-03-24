function getLocation() {
   return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject)
   });
}

function distance(lat1, lon1, lat2, lon2) {
	let radius = 3959 //Earth's radius in miles
	//Spherical Law of Cosines
	//* Math.PI / 180 is a conversion from degrees to radians
	lat1 = lat1 * Math.PI / 180
	lon1 = lon1 * Math.PI / 180
	lat2 = lat2 * Math.PI / 180
	lon2 = lon2 * Math.PI / 180
	return Math.acos(Math.sin(lat1) * Math.sin(lat2) + Math.cos(lat1) * Math.cos(lat2) * Math.cos(lon2-lon1))*radius
}

module.exports = {
  distance
}
