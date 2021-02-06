//Add the favicon if it does not exist.
try {
 	if (!document.querySelector("link[rel='shortcut icon']")) {
		let sizes = [16,24,32,64,96,160,196]
		sizes.forEach((size) => {
			let favicon = document.createElement("link")
			favicon.rel = "shortcut icon"
			favicon.type = "image/png"
			favicon.sizes = size + "x" + size
			favicon.href = root + `resources/icons/${size}x${size}-Water-Drop.png`
			document.head.appendChild(favicon)
		})
	}
}
catch(e) {
    console.error(e)
}

//Add the web app manifest.
try {
 	if (!document.querySelector("link[rel='manifest']")) {
		let manifest = document.createElement("link")
		manifest.rel = "manifest"
		manifest.href = root + `manifest.json`
		document.head.appendChild(manifest)
	}
}
catch(e) {
    console.error(e)
}


//Add the viewport meta tag if it does not exist.
try {
	if (!document.querySelector("meta[name=viewport]")) {
        let meta = document.createElement("meta")
        meta.name = "viewport"
        meta.content = "width=device-width, initial-scale=1"
        document.head.appendChild(meta)
	}
}
catch(e) {
    console.error(e)
}

try {
	let charset = document.createElement("meta")
	charset.setAttribute("charset", "UTF-8")
	document.head.appendChild(charset)
}
catch (e) {
	console.error(e)
}
