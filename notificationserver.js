const webpush = require('web-push');
const fs = require("fs")
const path = require("path")
const http = require("http")

//Either use the existing VAPID keys, or generate new ones.
//The private key must not be web accessable.
let vapidKeys = {};
let keysDirectory = path.join(__dirname, "data", "notifications")
let publicKeyPath = path.join(__dirname, "public_key") //Use the root directory for the public key.
let privateKeyPath = path.join(keysDirectory, "private_key")

if (!fs.existsSync(keysDirectory)) {fs.mkdirSync(keysDirectory, {recursive: true})}

if (fs.existsSync(publicKeyPath) && fs.existsSync(privateKeyPath)) {
	vapidKeys.publicKey = fs.readFileSync(publicKeyPath, {encoding:"utf8"})
	vapidKeys.privateKey = fs.readFileSync(privateKeyPath, {encoding:"utf8"})
}
else {
	vapidKeys = webpush.generateVAPIDKeys();
	fs.writeFileSync(publicKeyPath, vapidKeys.publicKey, {encoding:"utf8"})
	fs.writeFileSync(privateKeyPath, vapidKeys.privateKey, {encoding:"utf8"})
}

webpush.setVapidDetails(
  'mailto:admin@rivers.run',
  vapidKeys.publicKey,
  vapidKeys.privateKey
)




const hostname = "0.0.0.0"
const httpport = 3000

let storagePath = path.join(__dirname, "data", "notifications", "subscriptions.json")

//Note that the current storage design is a little ineffectient because the really long endpoint url is stored twice.
function saveUserSubscription(data) {
	let current = "{}";
	if (fs.existsSync(storagePath)) {
		current = fs.readFileSync(storagePath, {encoding:"utf8"})
	}
	let obj = JSON.parse(current)
	obj[data.subscription.endpoint] = data
	fs.writeFileSync(storagePath, JSON.stringify(obj), {encoding:"utf8"})
}

function getUserSubscription(url) {
	if (!fs.existsSync(storagePath)) {
		return null
	}
	let current = fs.readFileSync(storagePath, {encoding:"utf8"})
	let obj = JSON.parse(current)
	return obj[url]
}

async function httprequest(req,res) {
	if (req.method !== "POST") {
		console.log("Post request only. Rejected.")
		res.statusCode = 403;
	    res.setHeader('Content-Type', 'text/plain');
	    res.end('Only post requests are permitted.\n');
	}
	else {
		let data = await new Promise((resolve, reject) => {
			let body = ""
			req.on("data", function(chunk) {
				body += chunk.toString()
			})
			req.on("end", function() {
				resolve(body)
			})
		})

		data = JSON.parse(data)

		if (data.getSubscriptionFromURL) {
			res.statusCode = 200;
			res.setHeader('Content-Type', 'text/json');
			res.end(JSON.stringify(getUserSubscription(data.getSubscriptionFromURL)));
		}
		else if (data.subscription && data.parameters) {
			//data.subscription contains the details needed to send push notifications.
			//data.parameters contains the conditions under which to send notifications.
			saveUserSubscription(data)
			res.statusCode = 200;
			res.setHeader('Content-Type', 'text/plain');
			res.end('Saved Subscription\n');
		}
		else if (data.subscription && data.noneUntil) {
			//Update noneUntil (disables notifications temporarily)
			let subscription = getUserSubscription(data.subscription.endpoint)
			subscription.noneUntil = data.noneUntil
			saveUserSubscription(subscription)

			res.statusCode = 200;
			res.setHeader('Content-Type', 'text/plain');
			res.end('Disabled notifications until timestamp ' + subscription.noneUntil + "\n");
		}
		else {
			console.log(data)
			res.statusCode = 404;
			res.setHeader('Content-Type', 'text/plain');
			res.end('Unknown request\n');
		}
	}
}

const httpserver = http.createServer(httprequest);

httpserver.listen(httpport, hostname, () => {
  console.log(`Server running at http://${hostname}:${httpport}/`);
});
