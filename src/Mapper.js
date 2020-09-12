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

let renderCanvas = document.createElement("canvas")
let renderContext = renderCanvas.getContext("2d")
let p = new Path2D("m 7.2,0.2 c -3.8659932,0 -7,3.1340068 -7,7 0,5.25 7,13 7,13 0,0 7,-7.75 7,-13 0,-3.8659932 -3.134007,-7 -7,-7 z")
let m = document.createElementNS('http://www.w3.org/2000/svg', 'svg').createSVGMatrix();
m.b = 0; m.c = 0;m.e = 0;m.f = 0;

function prepForScale(options = {}) {
	renderContext.clearRect(0, 0, renderCanvas.width, renderCanvas.height)
	//Technically about 14.4x20.5.
	renderCanvas.width = 15 * options.scale
	renderCanvas.height = 21 * options.scale

	m.a = options.scale;
	m.d = options.scale;

	//TODO: Cache renderPath where possible.
	let renderPath = new Path2D()
	renderPath.addPath(p, m)

	renderContext.strokeStyle = options.strokeColor
	renderContext.fillStyle = options.fillColor

	renderContext.fill(renderPath)
	renderContext.stroke(renderPath)
	return renderCanvas.toDataURL("img/png")
}


function createMarkerImage(config = {}) {
		var markerImage = prepForScale({
			fillColor: config.fillColor || "blue",
			strokeColor: config.strokeColor || "#333333",
			scale: config.scale || 2
		})

		return markerImage
}

async function addMap() {
	//Call bound to a river object.
	let _this = this

	await loadMapsAPI()

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
	let gaugeIcon;
	let blankIcon;

	function drawItem(item) {
		//Call with this as the primary river object
		let color;
		if (item.isGauge) {
			color = "#df6af1" //Purplish.
		}
		else if (isNaN(item.running)) {
			color = "white"
		}
		else {color = "hsl(" + item.running * 60 + ", 100%, 70%)"}


		let scale = 1.25
		if (!item.isGauge) {scale = 2}

		let special = false
		let icon;
		if (item.index === this.index) {
			scale = 4
			special = true
		}
		else {
			//If not special, and generic, cache the icon.
			if (item.isGauge) {
				icon = gaugeIcon = gaugeIcon || createMarkerImage({
					fillColor: color, scale
				})
			}
			else if (isNaN(item.running)) {
				icon = blankIcon = blankIcon || createMarkerImage({
					fillColor: color, scale
				})
			}
		}

		//Now, either an icon will be defined, or the color for the icon will be defined. We will cache all generic icons, and the icons for the specific river.

		function addMarker(lat, lon, putIn = false) {
			if (lat && lon) {
				icon = icon || createMarkerImage({
					fillColor: color,
					scale
				})

				var marker = new google.maps.Marker({
					map: map,
					position: getCoords(item, putIn),
					icon
				});

				if (special) {
					//Labels introduce far too much lag. Only add a label for the river that was opened.
					//TODO: Consider writing labels into images, to allow everywhere.
					//Also, consider labelling the other rivers by skill.
					if (!item.isGauge) {
						marker.setLabel({
							color: "black",
							fontSize: "20px",
							text: (putIn?"PI":"TO")
						})
					}
					marker.setZIndex(1)
				}

				const infowindow = new google.maps.InfoWindow({
				  content: `
				  <div class="infoWindow">Latitude: ${lat}<br>
				  Longitude: ${lon}<br>
				  <a href="https://www.google.com/maps/dir//${lat},${lon}/@${lat},${lon},14z" target="_blank">Open in Google Maps</a><br>
				  <a href="#${item.name + " " + item.section}" target="_blank">Open in Rivers.run</a></div>` //TODO: Consider using name and section specifically, as generic search can return other results. TODO, clicking this link closes map, probably due to hash. Might be a re-render problem, where the map isn't re-expanded.
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


	//We will draw the current item, followed by all rivers, then all gauges.
	//Also, we will use a flat-earth based distance calculation to help render the correct area first.
	function calcValue(item) {
		let value = 0
		if (item.index !== this.index) {
			value++
			if (item.isGauge) {value+=0.1} //Add 0.1, so that distance can easily outweight rivers.

			//Add a bit based on distance. Speed > accuracy here.
			let lat1 = window.toDecimalDegrees(item.plat || item.tlat)
			let lon1 = window.toDecimalDegrees(item.plon || item.tlon)
			let lat2 = window.toDecimalDegrees(this.plat || this.tlat)
			let lon2 = window.toDecimalDegrees(this.plon || this.tlon)

			//Calculate VERY approximate distance.
			let distance = ((Math.abs(lat1 - lat2)**2) + (Math.abs(lon1 - lon2)**2))**0.5
			distance = Math.log10(distance) ** 3 //Adjust dropoff rate.
			if (distance > 1) {
				value += 1-(1/distance)
			}
		}
		return value
	}

	let drawOrder = ItemHolder.slice(0).sort(((a, b) => {
		return calcValue.call(this, a) - calcValue.call(this, b)
	}).bind(this))

	let i=0
	//Draw async, to allow quicker map load.
	let drawMore = function drawMore(duration = 8, timeout = 30) {
		let start = Date.now()
		let done = false
		while (Date.now() - start < duration) {
			if (!drawOrder[i]) {break;}
			drawItem.call(_this, drawOrder[i++])
		}
		if (!done) {
			setTimeout(drawMore, timeout)
		}
	}

	drawMore()

	window.lastAddedMap = map //For development only. This global variable is NOT TO BE USED by site code.
	div.classList.add("riverMap")
	return div
}

module.exports = {
	addMap
}
