const fs = require("fs")
const path = require("path")
const assistantRequest = require(path.join(__dirname, "assistantRequest.js"))
const utils = require(path.join(__dirname, "utils.js"))
const subscriptionManager = require(path.join(__dirname, "subscriptionManager.js"))


let lookupIP;
try {
	lookupIP = require(path.join(__dirname, "lookupIP.js"))
}
catch(e) {
	fs.appendFileSync(path.join(utils.getLogDirectory(), 'lookupIP.log'), e.toString() + "\n");
	console.error(e)
}

function initialize(app) {
	//TODO: Find a new API provider for this. Probably Google Maps, for simplicity.
	app.get("/node/ip2location", function(req, res, next) {
		res.setHeader('Access-Control-Allow-Origin', '*')

		if (lookupIP) {
			let ipData = {};
			let ip;
			if (req.url === "/node/ip2location") {
				ip = (req.headers['x-forwarded-for'] || '').split(',').pop() ||
					 req.connection.remoteAddress ||
					 req.socket.remoteAddress ||
					 req.connection.socket.remoteAddress
			}
			else {
				//ip = req.url.slice("/node/ip2location/".length) //Uncomment to allow custom IPs. May be wanted in future.
			}
			ipData = lookupIP(ip)
			res.setHeader("Cache-Control", "max-age=480, private")

			fs.appendFileSync(path.join(utils.getLogDirectory(), 'lookupIP.log'), req.url + " " + ip + "\n");

			res.statusCode = 200;
			res.setHeader('Content-Type', 'text/json');
			res.end(JSON.stringify(ipData));
		}
		else {
			res.statusCode = 500;
			res.setHeader('Content-Type', 'text/plain');
			res.end("Internal Server Error - lookupIP.js did not load. Contact the server administrator.");
		}
	})

	app.post("/node/googleassistant/rivers.run", function(req, res, next) {
		assistantRequest.handleRequest(req, res)
	})

	app.post("/node/alexaskill/rivers.run", function(req, res, next) {
		assistantRequest.handleAlexaRequest(req, res)
	})

	app.post("/node/notifications", async function(req, res, next) {
		res.setHeader('Access-Control-Allow-Origin', '*')
		res.setHeader("Cache-Control", "no-store")

		let data = JSON.parse((await utils.getData(req)).toString())

		if ((data.subscription && data.parameters) || (data.type === "email" && data.address)) {
			//data.subscription contains the details needed to send push notifications.
			//data.parameters contains the conditions under which to send notifications.
			//TODO: Consider preserving noneUntil if it is not present in the POST request.
			//data.sendTime : the time every day to send notifications at. We will send on first cycle after. Email only.
			subscriptionManager.saveUserSubscription(data)
			res.statusCode = 200;
			res.setHeader('Content-Type', 'text/plain');
			res.end('Saved Subscription');
		}
		else if (data.getSubscriptionFromURL && data.noneUntil !== undefined) {
			//Update noneUntil (disables notifications temporarily)
			//Currently used by browser notifications to make sure that we stop sending once user dismisses.
			let subscription = subscriptionManager.getUserSubscription(data.getSubscriptionFromURL)
			subscription.noneUntil = data.noneUntil
			subscriptionManager.saveUserSubscription(subscription)

			res.statusCode = 200;
			res.setHeader('Content-Type', 'text/plain');
			res.end('Disabled notifications until timestamp ' + subscription.noneUntil);
		}
		else if (data.delete === true) {
			subscriptionManager.deleteUserSubscription(data)
			res.statusCode = 200;
			res.setHeader('Content-Type', 'text/plain');
			res.end('Deleted Subscription');
		}
		else if (data.getSubscriptionFromURL) {
			res.statusCode = 200;
			res.setHeader('Content-Type', 'text/json');
			res.end(JSON.stringify(subscriptionManager.getUserSubscription(data.getSubscriptionFromURL)) || "No Subscription");
		}
		else {
			res.statusCode = 404;
			res.setHeader('Content-Type', 'text/plain');
			res.end('Invalid POST request');
			fs.appendFileSync(path.join(utils.getLogDirectory(), 'badrequest.log'), req.url + "\n" + JSON.stringify(data) + "\n");
		}
	})
}


module.exports = initialize
