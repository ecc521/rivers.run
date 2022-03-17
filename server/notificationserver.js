const fs = require("fs")
const path = require("path")
const assistantRequest = require(path.join(__dirname, "assistantRequest.js"))
const utils = require(path.join(__dirname, "utils.js"))
const subscriptionManager = require(path.join(__dirname, "subscriptionManager.js"))


function initialize(app) {
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
