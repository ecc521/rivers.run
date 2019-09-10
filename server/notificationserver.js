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
const httpport = 3000

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

		//TODO: Check for /node/notifications soon. req.url.startsWith("/node/notifications")
		if (req.method === "POST") {
			let data = JSON.parse((await utils.getData(req)).toString())

			res.setHeader("Cache-Control", "no-store")

			if (data.getSubscriptionFromURL) {
				res.statusCode = 200;
				res.setHeader('Content-Type', 'text/json');
				res.end(JSON.stringify(subscriptionManager.getUserSubscription(data.getSubscriptionFromURL)) || "No Subscription");
			}
			else if (data.subscription && data.parameters) {
				//data.subscription contains the details needed to send push notifications.
				//data.parameters contains the conditions under which to send notifications.
				//TODO: Consider preserving noneUntil if it is not present in the POST request.
				subscriptionManager.saveUserSubscription(data)
				res.statusCode = 200;
				res.setHeader('Content-Type', 'text/plain');
				res.end('Saved Subscription\n');
			}
			else if (data.subscription && data.noneUntil !== undefined) {
				//Update noneUntil (disables notifications temporarily)
				let subscription = subscriptionManager.getUserSubscription(data.subscription.endpoint)
				subscription.noneUntil = data.noneUntil
				subscriptionManager.saveUserSubscription(subscription)

				res.statusCode = 200;
				res.setHeader('Content-Type', 'text/plain');
				res.end('Disabled notifications until timestamp ' + subscription.noneUntil + "\n");
			}
			else if (data.type === "email" && data.address) {
				//Handle email notifications
				subscriptionManager.saveUserSubscription(data)
				res.statusCode = 200;
				res.setHeader('Content-Type', 'text/plain');
				res.end('Saved Subscription\n');
				//data.sendTime : the time every day to send notificcations at.We will send on first cycle after.
			}
			else {
				res.statusCode = 404;
				res.setHeader('Content-Type', 'text/plain');
				res.end('Invalid POST request\n');
				fs.appendFileSync(path.join(utils.getLogDirectory(), 'badrequest.log'), req.url + "\n" + JSON.stringify(data) + "\n");
			}
		}


		res.statusCode = 404;
		res.setHeader('Content-Type', 'text/plain');
		res.end('Unknown request\n');
		fs.appendFileSync(path.join(utils.getLogDirectory(), 'badrequest.log'), req.url + "\n" + JSON.stringify(data) + "\n");

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
