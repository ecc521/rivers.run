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

const requestHandler = require("./requestHandler.js")

let app = express()
app.disable('x-powered-by')

//Compress all responses
app.use(compression({
	//Max GZIP options.
	level: 9,
	memLevel: 9,
	windowBits: 15,
}))

app.use('*', function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  next();
});


//Serve remaining files.
app.all('*', requestHandler)


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
app.all("*", (req, res, next) => {
    serveIndex(__dirname, {
		'icons': true,
		'view': "details" //Gives more info than tiles.
	})(req, res, next)
})

app.all("*", (req, res, next) => {
	res.status(404)
	res.type("text/plain")
	res.end("File Not Found")
})
