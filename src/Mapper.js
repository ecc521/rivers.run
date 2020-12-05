//Note: We use lon internally, Google Maps uses lng internally. Be careful...
require("./toDecimalDegrees.js")
let MapPopup;

let API_KEY = "AIzaSyBLmohXw1xsgeBDs1cqVN_UuRtmAHmc-WI"

async function loadMapsAPI() {
	if (window?.google?.maps) {return}
	//TODO: If the user manages to click this button on two rivers before it loads on one (very unlikely), we could double load.
	var script = document.createElement('script');

	let promise = new Promise((resolve, reject) => {
		script.addEventListener("error", reject)
		script.src = 'https://maps.googleapis.com/maps/api/js?key=' + API_KEY + '&callback=initMap';
		window.initMap = function() {
			resolve()
			MapPopup = require("./MapPopup.js")
		}
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

async function addMap(river) {
	try {
		await loadMapsAPI()
	}
	catch (e) {
		console.error(e)
		alert("Error loading Google Maps API: " + e.message)
		return;
	}

	let div = document.createElement("div")

	//Center in between PI and TO if possible.
	let PI = getCoords(river, true)
	let TO = getCoords(river)
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
	window.map = map


	//TODO: Allow users to choose higher resolution offline maps. This should be done in a seperate page, either settings or a new maps page.
	async function loadOfflineMaps(zoom = 6) {
		//Download needed files to run offline maps, and add offline maps functionality.
		//Currently, we download zoom level 6 for the US, and zoom level 3 for the rest of the world.
		//We'll want to consider downloading global maps (or at least rivers.run supported countries) in lower-res, and US in high-res.

		console.log("Starting Offline Maps Load. ")

		//Conversion Funtions
		function lon2tile(lon,zoom) { return (Math.floor((lon+180)/360*Math.pow(2,zoom))); }
		function lat2tile(lat,zoom)  { return (Math.floor((1-Math.log(Math.tan(lat*Math.PI/180) + 1/Math.cos(lat*Math.PI/180))/Math.PI)/2 *Math.pow(2,zoom))); }

		//US lat lon bounds
		let topLat = 49.3457868
		let leftLon = -124.7844079
		let rightLon = -66.9513812
		let bottomLat =  24.7433195

		let layerID = 'offline_map_layer';
		let dataSource = ["openstreetmap", "google"][0]

		let tileCache = await caches.open("tileCache-v1")

		//This code will create higher zoomed in tiles from lower zoomed in tiles, however does NOT do the inverse.
		//Therefore, downloading one zoom level will download all lower zoom levels as well.
		async function downloadTiles(zoom, xStart = 0, xEnd=zoom**2-1, yStart = 0, yEnd = zoom**2-1) {
			//TODO: PARALELL!!!!!!!!!!!!!!!!!!!!
			for (let x=xStart;x<xEnd;x++) {
				for (let y=yStart;y<yEnd;y++) {
					let code = `${zoom}/${x}/${y}`

					//Still need to decide which to use.
					let openStreetMapUrl = `https://tile.openstreetmap.org/${code}.png`
					let googleMapsUrl = `https://mt1.google.com/vt/lyrs=m&x=${x}&y=${y}&z=${zoom}`

					let url;
					if (dataSource === "google") {url = googleMapsUrl}
					else if (dataSource === "openstreetmap") {url = openStreetMapUrl}

					let cached = await tileCache.match(code)
					if (cached instanceof Response && cached.status === 200) {
						continue;
					}

					try {
						let response = await fetch(url)
						await tileCache.put(code, response)
					}
					catch (e) {console.warn("Failed to load tile: ", e)}
				}
			}

			if (zoom > 1) {
				//It's possible that the endings need to be increased by one, however I believe this is correct.
				await downloadTiles(--zoom, Math.floor(xStart/2), Math.floor(xEnd/2), Math.floor(yStart/2), Math.floor(yEnd/2))
			}
		}

		let xStart = lon2tile(leftLon, zoom)
		let xEnd = lon2tile(rightLon, zoom)+1
		let yStart = lat2tile(topLat, zoom)
		let yEnd = lat2tile(bottomLat, zoom)+1

		console.time("Download Tiles")
		await downloadTiles(6, xStart, xEnd, yStart, yEnd)
		await downloadTiles(3)
		console.timeEnd("Download Tiles")

		//Google Maps getTileUrl is synchronus, but the image and cache loading are async.
		//This means we need to load everything ahead of time.
		function reverse(str) {return str.split("").reverse().join("")}

		console.time("Load Cache")
		let requests = await tileCache.keys()
		//The keys get converted to URLs. To get around that, we'll process them backwards.

		let offlineData = {}
		for (let i=0;i<requests.length;i++) {
			let request = requests[i]
			let str = reverse(request.url)
			let index = str.indexOf("/")
			let y = reverse(str.slice(0, index))
			let x = reverse(str.slice(++index, index = str.indexOf("/", index)))
			let zoom = reverse(str.slice(++index, index = str.indexOf("/", index)))

			let key = `${zoom}/${x}/${y}`
			let response = await tileCache.match(key)
			let img = new Image()
			img.src = URL.createObjectURL(new Blob([await response.arrayBuffer()], {type: "image/png"}))
			offlineData[key] = img
		}
		console.timeEnd("Load Cache")

		function obtainCanvasForZoom(zoom, x, y) {
			let canvas = document.createElement("canvas")
			canvas.width = canvas.height = 256
			let ctx = canvas.getContext("2d")

			if (offlineData[`${zoom}/${x}/${y}`]) {
				ctx.drawImage(offlineData[`${zoom}/${x}/${y}`], 0, 0)
				return canvas
			}

			if (zoom < 1) {throw "Error: Zoom level 1 not available. "}

			//Details for tile one level larger.
			let sourceCanvas = obtainCanvasForZoom(zoom-1, Math.floor(x/2), Math.floor(y/2))

			//Source x,y,width,height, destination x,y,width,height
			ctx.drawImage(sourceCanvas, 128*(x%2), 128*(y%2), 128, 128, 0, 0, 256, 256)
			return canvas
		}

		//Update Attribution Message for map.
		function setAttribution() {
			let elems = document.querySelectorAll(".gmnoprint > .gm-style-cc span")
			elems.forEach((elem) => {
				if (dataSource === "google") {
					elem.innerHTML = "Map Data © Google"
				}
				else if (dataSource === "openstreetmap") {
					elem.innerHTML = `© <a href="https://openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors`
				}
			})
		}

		var layer = new google.maps.ImageMapType({
			name: layerID,
			getTileUrl: function(coord, zoom) {
				//Totally excessive setAttribution calls, but Google resets it far too often.
				;[400, 1000, 2000, 4000].forEach((delay) => {
					setTimeout(setAttribution, delay)
				})
				return obtainCanvasForZoom(zoom, coord.x, coord.y).toDataURL("image/png")
			},
			tileSize: new google.maps.Size(256, 256),
			minZoom: 1,
			maxZoom: 20
		});

		map.mapTypes.set(layerID, layer);

		// Create a div to hold the control.
		var controlDiv = document.createElement('div');
		controlDiv.style.margin = "10px"
		controlDiv.style.marginLeft = "-10px"

		// Set CSS for the control border
		var controlUI = document.createElement('div');
		controlUI.style.backgroundColor = '#ddddff';
		controlUI.style.border = '2px solid #fff';
		controlUI.style.cursor = 'pointer';
		controlUI.style.marginBottom = '22px';
		controlUI.style.textAlign = 'center';
		controlDiv.appendChild(controlUI);

		// Set CSS for the control interior
		var controlText = document.createElement('div');
		controlText.style.color = 'rgb(25,25,25)';
		controlText.style.fontFamily = 'Roboto,Arial,sans-serif';
		controlText.style.fontSize = '16px';
		controlText.style.lineHeight = '36px';
		controlText.style.paddingLeft = '5px';
		controlText.style.paddingRight = '5px';
		controlText.innerHTML = 'Use Offline';

		//Make it clear this is us, not Google Maps
		let icon = document.createElement("img")
		icon.src = root + "resources/icons/24x24-Water-Drop.png"
		icon.style.verticalAlign = "middle"
		controlText.appendChild(icon)

		controlUI.appendChild(controlText);

		map.controls[google.maps.ControlPosition.TOP_LEFT].push(controlDiv)

		map.addListener("maptypeid_changed", function() {
			if ( map.getMapTypeId() !== layerID) {
				controlText.innerText = "Use Offline"
				controlText.appendChild(icon)
			}
			else {
				controlText.innerText = "Use Online"
				controlText.appendChild(icon)
			}
		})

		let controlDivClick;
		controlDiv.addEventListener('click', function() {

			//Needs to run before window.controlDivOldLayer is overwritten.
			if (controlDivClick) {
				if (controlDivClick()) {
					//controlDivClick returns true only when we changed away from the offline layer. Don't change back.
					controlDivClick = undefined
					return
				}
			}

			window.controlDivOldLayer = map.getMapTypeId()
			map.setMapTypeId(layerID);

			controlDivClick = function() {
				//Make sure that they aren't clicking a "Use Offline"!
				if (map.getMapTypeId() === layerID) {
					map.setMapTypeId(window.controlDivOldLayer)
					return true;
				}
			}
			setAttribution()
		});

		if (!navigator.onLine) {
			controlDiv.click() //Automatically trigger offline mode.
		}
	}

	if (navigator.onLine) {
		//Wait a little bit before loading offline maps - they can take a little bit to load, and we want to give the rest of the page a chance.
		setTimeout(loadOfflineMaps, 2500)
	}
	else {
		//Offline. Load offline maps ASAP.
		loadOfflineMaps()
	}

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

	let updatableItems = []
	function drawItem(item) {
		let color;
		if (item.isGauge) {
			color = "#df6af1" //Purplish.
		}
		else if (isNaN(item.running)) {
			color = "white"
		}
		else {color = "hsl(" + item.running * 60 + ", 100%, 70%)"}


		let scale = 1.25
		let regenerateInfo = [item]
		if (!item.isGauge) {
			scale = 2
			updatableItems.push(regenerateInfo)
		}

		let special = false
		let icon;
		if (item.index === river.index) {
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
				regenerateInfo.push(marker)

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

				marker.addListener("click", () => {
					let div = document.createElement("div")

					//TODO: Remove the inline HTML
					let riverLink = `<a href="#${item.name + " " + item.section}" target="_blank">Open in Rivers.run</a>, `
					div.innerHTML += riverLink
					let googleMapsLink = `<a href="https://www.google.com/maps/dir//${lat},${lon}/@${lat},${lon},14z" target="_blank">Open in Google Maps</a>, or view below: `
					div.innerHTML += googleMapsLink

					let closeButton = document.createElement("button")
					closeButton.className = "mapPopupCloseButton"
					closeButton.innerHTML = "×"
					div.appendChild(closeButton)

					let riverObj = new River(250000 + item.index, riverarray[item.index]) //locate is pretty much irrelevant now, should work fine.
					riverObj.blockMaps = true //Don't allow nested maps.
					let riverElem = riverObj.create()
					div.appendChild(riverElem)
					riverElem.click()

					let popup = new MapPopup(marker.position, div)
					popup.setMap(map)

					let listener = map.addListener("click", closePopup)
					closeButton.addEventListener("click", closePopup)

					function closePopup() {
						popup.setMap(null)
						google.maps.event.removeListener(listener)
					}

				});
			}
		}

		addMarker(item.plat, item.plon, true)
		addMarker(item.tlat, item.tlon)
	}

	function updateMarkers() {
		//Update colors for new flow info.
		//TODO: Deduplicate code.
		updatableItems.forEach((arr) => {
			let item = arr[0]
			let color = "hsl(" + item.running * 60 + ", 100%, 70%)"
			if (isNaN(item.running)) {
				color = "white"
			}
			let icon = createMarkerImage({
				fillColor: color,
				scale: (item.index === river.index)?4:2
			})
			//Skip first element.
			arr.slice(1).forEach((marker) => {
				marker.setIcon(icon)
			})
		})
	}

	//We will draw the current item, followed by all rivers, then all gauges.
	//Also, we will use a flat-earth based distance calculation to help render the correct area first.
	function calcValue(item) {
		let value = 0
		if (item.index !== river.index) {
			value++
			if (item.isGauge) {value+=0.1} //Add 0.1, so that distance can easily outweight rivers.

			//Add a bit based on distance. Speed > accuracy here.
			let lat1 = window.toDecimalDegrees(item.plat || item.tlat)
			let lon1 = window.toDecimalDegrees(item.plon || item.tlon)
			let lat2 = window.toDecimalDegrees(river.plat || river.tlat)
			let lon2 = window.toDecimalDegrees(river.plon || river.tlon)

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
		return calcValue.call(river, a) - calcValue.call(river, b)
	}))

	let i=0
	//Draw async, to allow quicker map load.
	let drawMore = function drawMore(duration = 8, timeout = 30) {
		let start = Date.now()
		let done = false
		while (Date.now() - start < duration) {
			if (!drawOrder[i]) {break;}
			drawItem(drawOrder[i++])
		}
		if (!done) {
			setTimeout(drawMore, timeout)
		}
	}

	drawMore()

	window.lastAddedMap = map //For development only. This global variable is NOT TO BE USED by site code.
	div.classList.add("riverMap")
	div.updateMarkers = updateMarkers
	return div
}

module.exports = {
	addMap
}
