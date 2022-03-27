const path = require("path")
const assistantRequest = require(path.join(__dirname, "assistantRequest.js"))

function initialize(app) {
	app.post("/node/googleassistant/rivers.run", function(req, res, next) {
		assistantRequest.handleRequest(req, res)
	})

	app.post("/node/alexaskill/rivers.run", function(req, res, next) {
		assistantRequest.handleAlexaRequest(req, res)
	})
}


module.exports = initialize
