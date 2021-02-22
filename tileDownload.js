const useZopfli = false

const fs = require("fs")
const path = require("path")
const bent = require("bent")
const child_process = require("child_process")

let outputDir = path.join(__dirname, "capacitorDir", "tileImages")

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

let usZoom = 8
let worldZoom = 5

function lon2tile(lon,zoom) { return (Math.floor((lon+180)/360*Math.pow(2,zoom))); }
function lat2tile(lat,zoom)  { return (Math.floor((1-Math.log(Math.tan(lat*Math.PI/180) + 1/Math.cos(lat*Math.PI/180))/Math.PI)/2 *Math.pow(2,zoom))); }

//US lat lon bounds
let topLat = 49.3457868
let leftLon = -124.7844079
let rightLon = -66.9513812
let bottomLat =  24.7433195

//This exceeds US bounds by a bit, as tiles overflow, and we also obtain child tiles, but it's fine.
let xStart = lon2tile(leftLon, usZoom)
let xEnd = lon2tile(rightLon, usZoom)+1
let yStart = lat2tile(topLat, usZoom)
let yEnd = lat2tile(bottomLat, usZoom)+1

let keys = generateKeys(generateKeys([], worldZoom), usZoom, xStart, xEnd, yStart, yEnd)


async function downloadTiles(keys = []) {
	let remainingItems = [];
	let maxParalell = 2; //OpenStreetMap says 2 or the browser default. I believe the browser default is 6, but we'll leave this at 2.

	for (let i=0;i<keys.length;i++) {
		let key = keys[i]
		process.stdout.cursorTo(0);
		process.stdout.write(`Loading image ${i + 1} of ${keys.length}`);

		if (remainingItems.length > maxParalell) {
			await Promise.race(remainingItems)
		}
		let promise = (async function() {
			let ending = key + ".png"
			let url = `https://tile.openstreetmap.org/${ending}`

			let outputPath = path.join(outputDir, ending)

			if (!fs.existsSync(path.dirname(outputPath))) {
				fs.mkdirSync(path.dirname(outputPath), {recursive: true})
			}

			if (!fs.existsSync(outputPath)) {
				//OpenStreetMap requires a UA.
				let headers = {"user-agent": "NodeJS"}
				try {
					let buff = await bent(url, "buffer", headers)()
					fs.writeFileSync(outputPath, buff)
					if (!useZopfli) {
						//Don't continue
					}
					else if (buff.length === 103) {
						//Empty tile. These won't compress
					}
					else {
						child_process.exec("zopflipng -y " + outputPath + " " + outputPath, (error, stdout, stderr) => {
							if (error) {
								console.error(`exec error: ${error}`);
								return;
							}
							console.log(`stdout: ${stdout}`);
							if (stderr) {
								console.error(`stderr: ${stderr}`);
							}
						})
					}
				}
				catch (e) {
					console.warn("Failed to load tile: ", e)
					return;
				}
			}
		}())
		remainingItems.push(promise)
		promise.then(() => {
			remainingItems.splice(remainingItems.indexOf(promise), 1)
		})
	}

	await Promise.allSettled(remainingItems)
	process.stdout.write("\nDone!\n")
}

downloadTiles(keys)
