//Setup express server to serve static files, etc.

//TODO: Do something better than this for unhandledRejections
const process = require("process")
process
  .on('unhandledRejection', (reason, p) => {
    console.error(reason, 'Unhandled Rejection at Promise', p);
  })

const fs = require("fs")
const path = require("path")
const http = require("http")
const url = require("url")

const compression = require('compression')
const express = require('express')
const serveIndex = require('serve-index') //Dev stuff - just viewing directories. Should probably be removed or replaced.

let app = express()

//Compress all responses
app.use(compression({
	//Max GZIP options.
	level: 9,
	memLevel: 9,
	windowBits: 15,
}))

//Gets the body of a request.
function getData(request) {
	return new Promise((resolve, reject) => {
		let body = []
		request.on("data", function(chunk) {
			body.push(chunk)
		})
		request.on("end", function() {
			resolve(Buffer.concat(body))
		})
	})
}

app.use('*', function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  next();
});


//Serve remaining files.
app.use('*', (req, res, next) => {
    let relativeSrc = decodeURIComponent(url.parse(decodeURIComponent(req.originalUrl)).pathname)

	//TODO: Handle precompression.
	let extensions = ["", ".html", "index.html"]
	let src;
	let extension = extensions.find((ext) => {
		src = path.join(__dirname, relativeSrc + ext)
		if (fs.existsSync(src)) {
			return !fs.statSync(src).isDirectory()
		}
	})

	if (fs.existsSync(src)) {
        res.type(path.extname(src))

        //Use a precompressed brotli file if available and supported by client.
        let accepted = req.get("Accept-Encoding")
        if (accepted.includes("br")) {
            let withBrotliPath = src + ".br"
            if (fs.existsSync(withBrotliPath)) {
                let readStream = fs.createReadStream(withBrotliPath)
                res.set("Content-Encoding", "br")
                readStream.pipe(res)
                return;
            }
        }


		let readStream = fs.createReadStream(src)
		readStream.pipe(res)
        return;
	}
	else {
		next()
	}
})

const httpport = 8080
const httpserver = app.listen(httpport)

//If serveOnly is passed, only serve existing files, don't generate any.
if (!process.argv.includes("--serveOnly")) {
	//Run usgscache.js - manages gauges and riverdata.
	require(path.join(__dirname, "server", "usgscache.js"))
}

//Start notificationserver.js - powers APIs (IP lookups & notification subscriptions)
let notificationServerInitialize = require(path.join(__dirname, "server/notificationserver.js"))
notificationServerInitialize(app) //Attaches handlers.


//serveIndex - can be removed.
app.use("*", (req, res, next) => {
	serveIndex(path.join(__dirname, req.originalUrl), {
		'icons': true,
		'view': "details" //Gives more info than tiles.
	})(req, res, next)
})

app.use("*", (req, res, next) => {
	res.status(404)
	res.type("text/plain")
	res.end("File Not Found")
})
