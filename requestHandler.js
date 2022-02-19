//Serves files for express.
const fs = require("fs")
const path = require("path")


//Used to protect against path traversal attacks.
function assureRelativePathSafe(relSrc) {
    let hypoDir = "/a/b"
    let hypoDirSame = "\\a\\b"		// windows path.join will return "\\a\\b\\" from joining of "/a/b" and "/"
    let absSrc = path.join(hypoDir, relSrc)
    if (! (absSrc.startsWith(hypoDir) || absSrc.startsWith(hypoDirSame))) {
        throw "Path Traversal Forbidden"
    }
}


function requestHandler(req, res, next) {
	res.set("Access-Control-Allow-Origin", "*");

    let relativeSrc = decodeURIComponent(req.path)
	let extensions = ["", ".html", "index.html"]

	let relPath;
	let src;
	let findResult = extensions.find((ext) => {
        relPath = relativeSrc + ext
        assureRelativePathSafe(relPath)

		src = path.join(__dirname, relPath)
		if (fs.existsSync(src)) {
			return !fs.statSync(src).isDirectory()
		}
	})

	if (findResult === undefined) {
		//There is no file that matches this request.
		next()
		return
	}

	let srcToRead = src;
	let srcLastModified = fs.statSync(src).mtime;

	if (new Date(req.get("If-Modified-Since")) >= srcLastModified) {
		res.status(304)
		res.end()
		return
	}

    res.type(path.extname(src))

	//START OF PRECOMPRESSION/CACHE CONTROL/TYPING LOGIC

    if (relPath.startsWith("/gaugeReadings")) {
        res.type(".json") //Ensure gaugeReadings are automatically compressed. 
    }

	let accepted = req.get("Accept-Encoding")
	if (accepted.includes("br")) {
		let brotliSrc = src + ".br"

		//TODO: Should we precompress if not precompressed?
		if (fs.existsSync(brotliSrc)) {
			let brotliLastModified = fs.statSync(brotliSrc).mtime
			if (brotliLastModified >= srcLastModified) {
				//Brotli file is up to date (modification time greater than or equal to)
				//We allow equal to because it is possible the modification date of the compressed file was edited
				//to be equal to the modification date of the uncompressed file.
				res.set("Content-Encoding", "br")
				srcToRead = brotliSrc
			}
			else {
				fs.unlinkSync(brotliSrc) //Brotli File is Outdated.
			}
		}
	}
	else if (accepted.includes("gz")) {
		//We won't bother to gzip compress - Almost every browser supports brotli,
		//and for the remainder we compress on demand.
	}


	//END OF PRECOMPRESSION/CACHE/TYPING CONTROL LOGIC


	let readStream = fs.createReadStream(srcToRead)

	//If-Modified-Since appears to be truncated to the second.
	//Therefore, we will send the current date -
	//Otherwise we risk some weird behavior if a request is made the same second a document is modified.
	//As is, it will just result in non-caching until the next request.
	res.set("Last-Modified", new Date())

	res.status(200)
	readStream.pipe(res)
}

module.exports = requestHandler
