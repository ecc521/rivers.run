//Note: We use lon internally, Google Maps uses lng internally. Be careful...
require("./toDecimalDegrees.js")
let MapPopup, MapTooltip;

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
			MapTooltip = require("./MapTooltip.js")
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
	return renderCanvas.toDataURL("img/png") //Tried converting these to blob DataURLs, but performance was no better.
}


function createMarkerImage(config = {}) {
		var markerImage = prepForScale({
			fillColor: config.fillColor || "blue",
			strokeColor: config.strokeColor || "#333333",
			scale: config.scale || 2
		})

		return markerImage
}

async function addMap({
	river,
	zoomLevel,
	CTR = {}
}) {
	try {
		await loadMapsAPI()
	}
	catch (e) {
		console.error(e)
		alert("Error loading Google Maps API: " + e.message)
		return;
	}

	let div = document.createElement("div")

	let PI, TO;
	if (river) {
		//Center in between PI and TO if possible.
		PI = getCoords(river, true)
		TO = getCoords(river)
		if (PI && TO) {
			CTR.lat = PI.lat + TO.lat
			CTR.lng = PI.lng + TO.lng
			CTR.lat /= 2
			CTR.lng /= 2
		}
		else {
			CTR = PI || TO
		}
	}
	else {
		//Somewhere around Kansas
		CTR.lat = CTR.lat ?? 39
		CTR.lng = CTR.lng ?? -98
	}


	let map = new google.maps.Map(div, {
		center: CTR,
		zoom: 20
	});

	window.lastAddedMap = map //For development only. This global variable is NOT TO BE USED by site code.

	// Normalizes the coords that tiles repeat across the x axis (horizontally)
	// like the standard Google map tiles.
	function getNormalizedCoord(coord, zoom) {
		const y = coord.y;
		let x = coord.x;
		// tile range in one direction range is dependent on zoom level
		// 0 = 1 tile, 1 = 2 tiles, 2 = 4 tiles, 3 = 8 tiles, etc
		const tileRange = 1 << zoom;

		// don't repeat across y-axis (vertically)
		if (y < 0 || y >= tileRange) {
			return null;
		}

		// repeat across x-axis
		if (x < 0 || x >= tileRange) {
			x = ((x % tileRange) + tileRange) % tileRange;
		}
		return { x: x, y: y };
	}

	function createControl(text = "") {
		// Create a div to hold the control.
		var controlDiv = document.createElement('div');

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
		controlText.innerText = text

		//Make it clear this is us, not Google Maps
		let icon = document.createElement("img")
		icon.src = root + "resources/icons/24x24-Water-Drop.png"
		icon.style.verticalAlign = "middle"
		controlText.appendChild(icon)

		controlUI.appendChild(controlText);

		return {controlDiv, controlUI, controlText, icon}
	}

	let weatherControl = createControl("Weather Off")

	map.controls[google.maps.ControlPosition.LEFT_BOTTOM].push(weatherControl.controlDiv)

	var weather = new google.maps.ImageMapType({
		getTileUrl: function (coord, zoom) {
		  const normalizedCoord = getNormalizedCoord(coord, zoom);

		  if (!normalizedCoord) {
			return "";
		  }

		  return `https://mesonet1.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913/${zoom}/${normalizedCoord.x}/${normalizedCoord.y}.png`
		},
		tileSize: new google.maps.Size(256, 256),
		maxZoom: 20, //I believe this goes to about 8.
		minZoom: 0,
		name: "Weather",
		opacity: 0.5
	  });


	weatherControl.controlDiv.addEventListener("click", function() {
		let weatherIndex = map.overlayMapTypes.getArray().findIndex((item) => {
			return item === weather
		})
		if (weatherIndex === -1) {
			map.overlayMapTypes.insertAt(
				0,
				weather
			);
			weatherControl.controlText.innerText = "Weather On"
			weatherControl.controlText.appendChild(weatherControl.icon)
		}
		else {
			map.overlayMapTypes.removeAt(weatherIndex)
			weatherControl.controlText.innerText = "Weather Off"
			weatherControl.controlText.appendChild(weatherControl.icon)
		}
	})

	async function loadOfflineMaps() {
		//Download needed files to run offline maps, and add offline maps functionality.
		//Unless changed in settings, we download zoom level 6 for the US, and zoom level 3 for the rest of the world.

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

		let tileCache = await caches.open("tileCache-v1")

		//This code will create higher zoomed in tiles from lower zoomed in tiles, however does NOT do the inverse.
		//Therefore, downloading one zoom level will download all lower zoom levels as well.

		async function downloadTiles(keys = [], tiles = {}) {
			let remainingItems = [];
			let maxParalell = 10;

			for (let i=0;i<keys.length;i++) {
				let key = keys[i]

				if (tiles[key]) {continue} //Tile already loaded, probably by a previous map.

				if (remainingItems.length > maxParalell) {
					await Promise.race(remainingItems)
				}
				let promise = (async function() {

					let response;
					/*if (window.Capacitor) {
						//Attempt to load local assets.
						let url = `tileCache/${key}.png`
						try {
							response = await fetch(url)
						}
					}*/


					let url = `https://tile.openstreetmap.org/${key}.png`

					let cached = await tileCache.match(url)
					if (cached instanceof Response && cached.status === 200) {
						response = cached
					}

					if (!response) {
						try {
							let fromNetwork = await fetch(url)
							tileCache.put(url, fromNetwork.clone())
							response = fromNetwork
						}
						catch (e) {
							console.warn("Failed to load tile: ", e)
							return;
						}
					}

					tiles[key] = response
				}())
				remainingItems.push(promise)
				promise.then(() => {
					remainingItems.splice(remainingItems.indexOf(promise), 1)
				})
			}

			await Promise.allSettled(remainingItems)
			return tiles
		}

		function generateKeys(keys, zoom, xStart = 0, xEnd=2**zoom-1, yStart = 0, yEnd = 2**zoom-1) {
			for (let x=xStart;x<=xEnd;x++) {
				for (let y=yStart;y<=yEnd;y++) {
					let key = `${zoom}/${x}/${y}`
					if (keys.indexOf(key) === -1) {
						keys.push(`${zoom}/${x}/${y}`)
					}
				}
			}

			if (zoom > 0) {
				generateKeys(keys, --zoom, Math.floor(xStart/2), Math.floor(xEnd/2), Math.floor(yStart/2), Math.floor(yEnd/2))
			}
			return keys
		}

		let usZoom = Number(localStorage.getItem("usMapResolution")) || 6
		let worldZoom = Number(localStorage.getItem("worldMapResolution")) || 3

		//This exceeds US bounds by a bit, as tiles overflow, and we also obtain child tiles, but it's fine.
		let xStart = lon2tile(leftLon, usZoom)
		let xEnd = lon2tile(rightLon, usZoom)+1
		let yStart = lat2tile(topLat, usZoom)
		let yEnd = lat2tile(bottomLat, usZoom)+1

		let keys = generateKeys(generateKeys([], worldZoom), usZoom, xStart, xEnd, yStart, yEnd)
		console.time(`Prepare ${keys.length} Tiles`)
		window.offlineData = window.offlineData || {}
		await downloadTiles(keys, window.offlineData)
		console.timeEnd(`Prepare ${keys.length} Tiles`)

		async function obtainCanvasForZoom(zoom, x, y) {
			let canvas = document.createElement("canvas")
			canvas.width = canvas.height = 256
			let ctx = canvas.getContext("2d")

			let requestName = `${zoom}/${x}/${y}`
			let response = offlineData[requestName]

			if (response) {
				//Generate image for response
				if (response instanceof Response) {
					let clone = response.clone() //Clone simply so that if this is requested twice before replaced, it doesn't error.
					let buffer = await clone.arrayBuffer()
					offlineData[requestName] = await new Promise((resolve, reject) => {
						let img = new Image()
						img.onload = function() {resolve(img)}
						img.onerror = reject
						img.src = URL.createObjectURL(new Blob([buffer], {type: "image/png"}))
					})
				}
				ctx.drawImage(offlineData[requestName], 0, 0)
				return canvas
			}

			//First portion for "If zoom is less than zero, return false"
			if (zoom < 0) {return false}

			//Details for tile one level larger.
			let sourceCanvas = await obtainCanvasForZoom(zoom-1, Math.floor(x/2), Math.floor(y/2))
			if (!sourceCanvas) {return false} //Second portion for "If zoom is less than zero, return false"

			//Source x,y,width,height, destination x,y,width,height
			ctx.drawImage(sourceCanvas, 128*(x%2), 128*(y%2), 128, 128, 0, 0, 256, 256)
			return canvas
		}

		//Update Attribution Message for map.
		function setAttribution() {
			let elems = document.querySelectorAll(".gmnoprint > .gm-style-cc span")
			elems.forEach((elem) => {
				elem.innerHTML = `© <a href="https://openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors`
			})
		}


		class CoordMapType {
		  constructor(tileSize) {
		    this.maxZoom = 20;
		    this.alt = this.name = "Offline Map Tiles";
		    this.tileSize = tileSize;
		  }
		  getTile(coord, zoom, ownerDocument) {
			  //Totally excessive setAttribution calls, but Google resets it far too often.
			  ;[400, 1000, 2000, 4000].forEach((delay) => {
				  setTimeout(setAttribution, delay)
			  })

			  coord = getNormalizedCoord(coord, zoom)

			  if (!coord) {
		        return "";
		      }

			  const img = ownerDocument.createElement("img");
			  obtainCanvasForZoom(zoom, coord.x, coord.y).then((canvas) => {
				  img.src = canvas.toDataURL("image/png")
			  })
			  img.style.width = this.tileSize.width + "px";
			  img.style.height = this.tileSize.height + "px";
			  return img
		  }
		  releaseTile(tile) {}
		}

		var layer = new CoordMapType(new google.maps.Size(256, 256))

		map.mapTypes.set(layerID, layer);

		let offlineMapsControl = createControl("Use Offline")
		offlineMapsControl.controlDiv.style.margin = "10px"
		offlineMapsControl.controlDiv.style.marginLeft = "-10px"

		map.controls[google.maps.ControlPosition.TOP_LEFT].push(offlineMapsControl.controlDiv)

		map.addListener("maptypeid_changed", function() {
			if ( map.getMapTypeId() !== layerID) {
				offlineMapsControl.controlText.innerText = "Use Offline"
				offlineMapsControl.controlText.appendChild(offlineMapsControl.icon)
			}
			else {
				offlineMapsControl.controlText.innerText = "Use Online"
				offlineMapsControl.controlText.appendChild(offlineMapsControl.icon)
			}
		})

		let controlDivClick;
		offlineMapsControl.controlDiv.addEventListener('click', function() {

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
			offlineMapsControl.controlDiv.click() //Automatically trigger offline mode.
		}
	}

	let offlineMapLoadPromise;
	if (navigator.onLine) {
		//Wait a little bit before loading offline maps - they can take a little bit to load, and we want to give the rest of the page a chance.
		setTimeout(loadOfflineMaps, 2500)
	}
	else {
		//Offline. Load offline maps ASAP.
		offlineMapLoadPromise = loadOfflineMaps()
	}

	if (!river || zoomLevel) {
		map.setZoom(zoomLevel || 3) //Entire US View.
	}
	else {
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
	}


	//Add markers for all of our rivers, and color based on relative flow.
	//TOOO: Add/remove based on zoom, IF it helps performance.
	//map.getBounds() returns visible lat/lng range.
	let gaugeIcon;
	let blankIcon;
	let tooHighIcon;
	let tooLowIcon;

	let updatableItems = []
	function drawItem(item) {
		let color, running;
		if (item.isGauge) {
			color = "#df6af1" //Purplish.
		}
		else if (isNaN(running = item.running)) {
			color = "white"
		}
		else {color = "hsl(" + running * 60 + ", 100%, 70%)"}


		let scale = .8
		let regenerateInfo = [item]
		if (!item.isGauge) {
			scale = 1.4
			updatableItems.push(regenerateInfo)
		}

		let special = false
		let icon;
		if (item.index === river?.index) {
			scale = 2.5
			special = true
		}
		else {
			//If not special, and generic, cache the icon.
			if (item.isGauge) {
				icon = gaugeIcon = gaugeIcon || createMarkerImage({
					fillColor: color, scale
				})
			}
			else if (color === "white") {
				icon = blankIcon = blankIcon || createMarkerImage({
					fillColor: color, scale
				})
			}
			else if (running === 0) {
				icon = tooLowIcon = tooLowIcon || createMarkerImage({
					fillColor: color, scale
				})
			}
			else if (running === 4) {
				icon = tooHighIcon = tooHighIcon || createMarkerImage({
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
					position: getCoords(item, putIn),
					icon,
					zoom: item.isGauge?5:undefined,
					map
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
					let riverLink = `<a href="${window.root}#${item.name + " " + item.section}" target="_blank">Open in Rivers.run</a>, `
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

				let tooltip;
				marker.addListener("mouseover", () => {
					if (!tooltip) {
						let div = document.createElement("div")

						let text = `${item.name} (${item.section})`
						if (item.flow) {
							text += ": " + item.flow
						}
						div.innerHTML = text
						div.style.color = "black"

						tooltip = new MapTooltip(marker.position, div, 21*scale)

						marker.addListener("mouseout", function() {
							tooltip.setMap(null)
						})
					}
					tooltip.setMap(map)
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
				scale: (item.index === river?.index)?4:2
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
		if (item.index !== river?.index) {
			value++
			if (item.isGauge) {value+=0.1} //Add 0.1, so that distance can easily outweight rivers.
			//If we don't have a river to compare distance against, pick randomly from the gauges.
			if (river) {
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
			else if (item.isGauge) {
				value -= Math.random() * 0.15 //Randomly generate rivers and gauges, with heavy priority to rivers.
			}
		}
		return value
	}

	let drawOrder = ItemHolder.slice(0).sort(((a, b) => {
		return calcValue.call(river, a) - calcValue.call(river, b)
	}))

	let i=0
	//Draw async, to allow quicker map load.
	let drawMore = function drawMore(duration = 8, timeout = 30, once = false) {
		let start = Date.now()
		let done = false
		while (Date.now() - start < duration) {
			if (!drawOrder[i]) {
				done = true;
				break;
			}
			drawItem(drawOrder[i++])
		}
		if (!done && once === false) {
			setTimeout(drawMore, timeout)
		}
	}

	//If we are offline, draw the very first items, then stop.
	//First call should be a slightly longer duration - get some markers in.
	if (offlineMapLoadPromise) {
		drawMore(50, null, true)
		offlineMapLoadPromise.then(() => {
			console.log("Beginning Full Marker Render")
			drawMore()
		})
	}
	else {
		drawMore(50)
	}

	div.classList.add("riverMap")
	div.updateMarkers = updateMarkers
	console.log(div)
	return div
}

module.exports = {addMap};
