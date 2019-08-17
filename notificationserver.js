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
			let body = []
			req.on("data", function(chunk) {
				body.push(chunk)
			})
			req.on("end", function() {
				resolve(Buffer.concat(body))
			})
		})
		
		
		try {
			fs.appendFileSync(path.join(__dirname, 'salmon2019.log'), req.url + "\n");
			
			if (req.url.includes("salmon2019")) {
				let filePath = path.relative("node/salmon2019", req.url.slice(1))
				//Stop users from messing with files that they shouldn't be allowed to.
				if (filePath.includes("../")) {
					res.statusCode = 200;
					res.setHeader('Content-Type', 'text/plain');
					//For the laughs
					res.end("Attempt to hijack server has been blocked. Logging your IP address and reporting to administrator. \n" + filePath)
					return;
				}
				if (fs.existsSync(filePath)) {
					res.statusCode = 200;
					res.setHeader('Content-Type', 'text/plain');
					res.end("Path exists")
					return
				}
				if (req.url.endsWith("/")) {
					fs.makedirSync(filePath, {recursive:true})
					res.statusCode = 200;
					res.setHeader('Content-Type', 'text/plain');
					res.end("Directory created")
					return
				}
				else {
					fs.writeFileSync(path.join(__dirname, "salmon2019", filePath), data)
					res.statusCode = 200;
					res.setHeader('Content-Type', 'text/plain');
					res.end("File created")
					return
				}
				res.statusCode = 200;
				res.setHeader('Content-Type', 'text/plain');
				res.end("Oh no! This request didn't work!\n" + req.url)
			}
		}
		catch(e) {
			console.error(e)
			fs.appendFileSync(path.join(__dirname, 'salmon2019.log'), String(e) + "\n");
		}
		
		data = JSON.parse(data.toString())

		if (data.getSubscriptionFromURL) {
			res.statusCode = 200;
			res.setHeader('Content-Type', 'text/json');
			res.end(JSON.stringify(getUserSubscription(data.getSubscriptionFromURL)));
		}
		else if (data.subscription && data.parameters) {
			//data.subscription contains the details needed to send push notifications.
			//data.parameters contains the conditions under which to send notifications.
			//TODO: Consider preserving noneUntil if it is not present in the POST request.
			saveUserSubscription(data)
			res.statusCode = 200;
			res.setHeader('Content-Type', 'text/plain');
			res.end('Saved Subscription\n');
		}
		else if (data.subscription && data.noneUntil !== undefined) {
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
