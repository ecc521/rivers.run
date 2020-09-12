//Note: We use lon internally, Google Maps uses lng internally. Be careful...
require("./toDecimalDegrees.js")

let API_KEY = "AIzaSyBLmohXw1xsgeBDs1cqVN_UuRtmAHmc-WI"

async function loadMapsAPI() {
	if (window?.google?.maps) {return}
	//TODO: If the user manages to click this button on two rivers before it loads on one (very unlikely), we could double load.
	var script = document.createElement('script');

	script.src = 'https://maps.googleapis.com/maps/api/js?key=' + API_KEY + '&callback=initMap';

	let promise = new Promise((resolve, reject) => {
		window.initMap = resolve
	})

	document.head.appendChild(script);
	return promise
}



function getCoords(item, putIn = false) {
	let latId = "tlat"
	let lonId = "tlon"
	if (putIn) {
		latId = "plat"
		lonId = "plon"
	}

	if (item[latId] && item[lonId]) {
		return {
			lat:  window.toDecimalDegrees(item[latId]),
			lng: window.toDecimalDegrees(item[lonId]) //lng for Google Maps
		}
	}
	return false
}

function createMarkerResources(config = {}) {
	    var pinSVGFilled = "M 12,2 C 8.1340068,2 5,5.1340068 5,9 c 0,5.25 7,13 7,13 0,0 7,-7.75 7,-13 0,-3.8659932 -3.134007,-7 -7,-7 z";
	    var labelOriginFilled =  new google.maps.Point(12,9);

	    var markerImage = {
	        path: pinSVGFilled,
	        anchor: new google.maps.Point(12,17),
	        fillOpacity: 1,
	        fillColor: config.fillColor || "blue",
	        strokeWeight: config.strokeWeight || 1,
	        strokeColor: config.strokeColor || "#333333",
	        scale: config.scale || 2,
	        labelOrigin: labelOriginFilled
	    };
	    var label = {
	        text: config.text,
	        color: config.textColor || "black",
	        fontSize: config.fontSize || "12px",
	    };

		return {markerImage, label}
}

async function addMap() {
	//Call bound to a river object.
	await loadMapsAPI()
	console.log(this)

	let div = document.createElement("div")

	//Center in between PI and TO if possible.
	let PI = getCoords(this, true)
	let TO = getCoords(this)
	let CTR = {};
	if (PI && TO) {
		CTR.lat = PI.lat + TO.lat
		CTR.lng = PI.lng + TO.lng
		CTR.lat /= 2
		CTR.lng /= 2
	}
	else {
		CTR = PI || TO
	}

	let map = new google.maps.Map(div, {
	  center: CTR,
	  zoom: 20
	});

	try {
		let bounds = new google.maps.LatLngBounds()
		bounds.extend({
			lat: PI.lat,
			lng: PI.lng
		})
		bounds.extend({
			lat: TO.lat,
			lng: TO.lng
		})

		console.log(bounds)
		let paddingInPixels = 20
		map.fitBounds(bounds, paddingInPixels)
		console.log(map.getZoom())
		setTimeout(function() {
			//Not sure why, but sometimes (look at Chattooga 4 vs Chattahoochee Upper), Google Maps is zooming out way too far without this second call.
			console.log(map.getZoom())
			map.fitBounds(bounds, paddingInPixels)
			console.log(map.getZoom())
		}, 500)
	}
	catch (e) {
		//We can't bound, so zoom out a bit.
		console.warn("Couldn't call bounds. Coordinates were " + [PI.lat, TO.lat, PI.lng, TO.lng].join(", "))
		map.setZoom(14) //Should only have 1 point, so this should always be fine.
	}


	//Add markers for all of our rivers, and color based on relative flow.
	//TOOO: Add/remove based on zoom, IF it helps performance.
	//map.getBounds() returns visible lat/lng range.
	for (let i=0;i<ItemHolder.length;i++) {
		let item = ItemHolder[i]

		if (item.isGauge) {continue};

		let name = item.name + " " + item.section
		let color = "hsl(" + item.running * 60 + ", 100%, 70%)"
		let fontSize = "14px"
		if (isNaN(item.running)) {
			color = "white"
		}
		let scale = 2

		if (item.index === this.index) {
			scale = 4
			fontSize = "20px"
		}

		function addMarker(lat, lon, putIn = false) {
			if (lat && lon) {
				let resources = createMarkerResources({
					text: (putIn?"PI - ":"TO - ") + name,
					fillColor: color,
					scale,
					fontSize
				})

				var marker = new google.maps.Marker({
					map: map,
					position: getCoords(item, putIn),
					icon: resources.markerImage,
					label: resources.label,
				});

				const infowindow = new google.maps.InfoWindow({
				  content: `
				  <div class="infoWindow">Latitude: ${lat}<br>
				  Longitude: ${lon}<br>
				  <a href="https://www.google.com/maps/dir//${lat},${lon}/@${lat},${lon},14z" target="_blank">Open in Google Maps</a><br>
				  <a href="#${name}" target="_blank">Open in Rivers.run</a></div>` //TODO: Consider using name and section specifically, as generic search can return other results.
				});
				marker.addListener("click", () => {
					//TODO: The InfoWindow should dissapear if the user clicks outside of it, not just the X button.
					infowindow.open(map, marker);
				});
			}
		}

		addMarker(item.plat, item.plon, true)
		addMarker(item.tlat, item.tlon)
	}

	window.lastAddedMap = map //For development only. This global variable is NOT TO BE USED by site code.
	div.classList.add("riverMap")
	return div
}

module.exports = {
	addMap
}
