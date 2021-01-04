const fs = require("fs")
const path = require("path")
const http = require("http")
const assistantRequest = require(path.join(__dirname, "assistantRequest.js"))
const salmon2019 = require(path.join(__dirname, "salmon2019.js"))
const utils = require(path.join(__dirname, "utils.js"))
const subscriptionManager = require(path.join(__dirname, "subscriptionManager.js"))
require(path.join(__dirname, "vapidKeys.js")) //Generate vapid keys if they don't already exist.


let lookupIP;
try {
	lookupIP = require(path.join(__dirname, "lookupIP.js"))
}
catch(e) {
	fs.appendFileSync(path.join(utils.getLogDirectory(), 'lookupIP.log'), e.toString() + "\n");
	console.error(e)
}

const hostname = "0.0.0.0"
const httpport = 5329

async function httprequest(req,res) {

		//TODO: Only allow rivers.run, its subdomains and local networks.
		res.setHeader('Access-Control-Allow-Origin', '*')

		try {
			if (req.url.includes("salmon2019")) {
				salmon2019.handleRequest(req, res)
				return;
			}
		}
		catch(e) {
			console.error(e)
			fs.appendFileSync(path.join(utils.getLogDirectory(), 'salmon2019.log'), String(e) + "\n");
		}


		if (req.method === "GET" && req.url.startsWith("/node/ip2location")) {
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
			return
		}


		try {
			if (req.method === "POST" && req.url.startsWith("/node/googleassistant/rivers.run")) {
				await assistantRequest.handleRequest(req, res)
				return;
			}
		}
		catch(e) {
			console.error(e)
			fs.appendFileSync(path.join(utils.getLogDirectory(), 'assistanterror.log'), String(e) + "\n");
		}


		try {
			if (req.method === "POST" && req.url.startsWith("/node/alexaskill/rivers.run")) {
				await assistantRequest.handleAlexaRequest(req, res)
				return;
			}
		}
		catch(e) {
			console.error(e)
			fs.appendFileSync(path.join(utils.getLogDirectory(), 'alexaskillerror.log'), String(e) + "\n");
		}

		//TODO: Check for /node/notifications soon. req.url.startsWith("/node/notifications")
		if (req.method === "POST") {
			res.setHeader("Cache-Control", "no-store")

			let data = JSON.parse((await utils.getData(req)).toString())

			if ((data.subscription && data.parameters) || (data.type === "email" && data.address)) {
				//data.subscription contains the details needed to send push notifications.
				//data.parameters contains the conditions under which to send notifications.
				//TODO: Consider preserving noneUntil if it is not present in the POST request.
				//data.sendTime : the time every day to send notificcations at.We will send on first cycle after. Email only.
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
			return
		}


		res.statusCode = 404;
		res.setHeader('Content-Type', 'text/plain');
		res.end('Unknown request\n');
		fs.appendFileSync(path.join(utils.getLogDirectory(), 'badrequest.log'), req.url + "\n" + JSON.stringify((await utils.getData(req)).toString()) + "\n");

}

const httpserver = http.createServer(httprequest);

module.exports = function() {
	try {
		httpserver.listen(httpport, hostname, () => {
		  console.log(`Server running at http://${hostname}:${httpport}/`);
		});
	}
	catch(e) {
		console.error(e)
		fs.appendFileSync(path.join(utils.getLogDirectory(), 'startnotificationserver.log'), e.toString() + "\n");
	}
}
