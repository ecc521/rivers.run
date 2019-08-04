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


function saveUserSubscription() {

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
		//data.subscription contains the details needed to send push notifications.
		//data.parameters contains the conditions under which to send notifications.

	}
}

const httpserver = http.createServer(httprequest);

httpserver.listen(httpport, hostname, () => {
  console.log(`Server running at http://${hostname}:${httpport}/`);
});
