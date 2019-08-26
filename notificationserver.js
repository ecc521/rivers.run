const webpush = require('web-push');
const fs = require("fs")
const path = require("path")
const http = require("http")
const os = require("os")
const child_process = require("child_process")

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

let lookupIP;
try {
	lookupIP = require(path.join(__dirname, "lookupIP.js"))
}
catch(e) {
	fs.appendFileSync(path.join(__dirname, 'lookupIP.log'), e.toString() + "\n");
	console.error(e)
}


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

	
		function getData() {
			return new Promise((resolve, reject) => {
				let body = []
				req.on("data", function(chunk) {
					body.push(chunk)
				})
				req.on("end", function() {
					resolve(Buffer.concat(body))
				})
			})
		}
		
		//TODO: Only allow rivers.run, its subdomains and 127.0.0.1
		res.setHeader('Access-Control-Allow-Origin', '*')

		try {
			fs.appendFileSync(path.join(__dirname, 'salmon2019.log'), req.url + "\n");
			
			res.setHeader("Cache-Control", "no-store")
			
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
				let pathOnSystem = path.join(__dirname, "salmon2019", filePath)
				if (req.url.endsWith("/")) {
					if (req.method === "POST") {
						if (fs.existsSync(pathOnSystem)) {
							res.statusCode = 400;
							res.setHeader('Content-Type', 'text/plain');
							res.end("Path exists")
							return
						}
						//Create the directory
						fs.mkdirSync(pathOnSystem, {recursive:true})
						res.statusCode = 200;
						res.setHeader('Content-Type', 'text/plain');
						//Apparently the configuration didn't carry into subdirectories - so link the files.
						fs.symlinkSync(path.join(__dirname, "salmon2019", "header.html"), path.join(pathOnSystem, "header.html"))
						fs.symlinkSync(path.join(__dirname, "salmon2019", ".htaccess"), path.join(pathOnSystem, ".htaccess"))
						res.end("Directory created")
					}
					else {
						if (!fs.existsSync(pathOnSystem)) {
							res.statusCode = 400;
							res.setHeader('Content-Type', 'text/plain');
							res.end("Path does not exist.")
							return
						}
						//Send the user a zip file.
						let zipper = child_process.spawn("zip", ["-9", "-r", "-x", "header.html", "-x", ".htaccess", "-x", "*.br", "-", "."], {
							cwd: pathOnSystem,
							stido: ["ignore", "pipe", "pipe"] //Ingore stdin. Pipe others.
						})
						//Send stderr into log.
						let errorStream = fs.createWriteStream('salmon2019zip.log')
						zipper.stderr.pipe(errorStream)
						
						res.statusCode = 200;
						res.setHeader('Content-Type', 'application/zip');
						zipper.stdout.pipe(res) //Respond with the zip file.
					}
					return
				}
				else {
					if (fs.existsSync(pathOnSystem)) {
						res.statusCode = 400;
						res.setHeader('Content-Type', 'text/plain');
						res.end("Path exists")
						return
					}
					
					//If the file upload gets terminated for some reason, the user should be able to upload the file again without a path collison.
					let whileLoadingPath = path.join(os.tmpdir(), "rivers.run", filePath)
					if (!fs.existsSync(path.dirname(whileLoadingPath))) {
						fs.mkdirSync(path.dirname(whileLoadingPath), {recursive:true})
					}
					if (fs.existsSync(whileLoadingPath)) {fs.unlinkSync(whileLoadingPath)}
					
					let stream = req.pipe(fs.createWriteStream(whileLoadingPath))
					console.log(stream)
					stream.on("close", function() {
						fs.renameSync(whileLoadingPath, pathOnSystem)
						res.statusCode = 200;
						res.setHeader('Content-Type', 'text/plain');
						res.end("File created")
					})
					stream.on("error", function(e) {
						if (fs.existsSync(whileLoadingPath)) {fs.unlinkSync(whileLoadingPath)}
						res.statusCode = 500;
						res.setHeader('Content-Type', 'text/plain');
						res.end("Internal Server Error " + e.toString())
					})
					return;
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
	
	
		
	
		if (req.method === "GET" && req.url.startsWith("/node/ip2location")) {
			if (lookupIP) {
				let ipData = {};
				let ip;
				//Geobytes.com looks good enough to use. May want to do some testing on how much less accurate it is. If it is used, we can remove attribution.
				if (req.url === "/node/ip2location") {
					ip = (req.headers['x-forwarded-for'] || '').split(',').pop() || 
						 req.connection.remoteAddress || 
						 req.socket.remoteAddress || 
						 req.connection.socket.remoteAddress
				}
				else {
					//ip = req.url.slice("/node/ip2location".length) //Uncomment to allow custom IPs. May be wanted in future.
				}
				ipData = lookupIP(ip)
				res.setHeader("Cache-Control", "max-age=480, private")

				fs.appendFileSync(path.join(__dirname, 'lookupIP.log'), req.url + " " + ip + "\n");
				
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
				let query = (await getData()).toString()
				fs.appendFileSync(path.join(__dirname, 'assistanterror.log'), query + "\n");
				query = JSON.parse(query)

				let reply =     {
				  "fulfillmentText": "This is a text response",
				  "fulfillmentMessages": [
					{
					  "card": {
						"title": "Rivers.run Flow Info (Test)",
						"subtitle": "Rivers.run provides river information, such as real time water levels.",
						"imageUri": "https://rivers.run/resources/icons/128x128-Water-Drop.png",
						"buttons": [
						  {
							"text": "View on Rivers.run",
							"postback": "https://rivers.run/"
						  }
						]
					  }
					}
				  ],
				  "source": "https://rivers.run/",
				  "payload": {
					"google": {
					  "expectUserResponse": false,
					  "richResponse": {
						"items": [
						  {
							"simpleResponse": {
							  "textToSpeech": "rivers.run is still in development and tesing."
							}
						  }
						]
					  }
					}
				  }
				}

				reply.outputContexts = query.outputContexts
				
				res.statusCode = 200;
				res.setHeader('Content-Type', 'text/json');
				res.end(JSON.stringify(reply));
			}
		}
		catch(e) {
			console.error(e)
			fs.appendFileSync(path.join(__dirname, 'assistanterror.log'), String(e) + "\n");
		}
	
		//TODO: Check for /node/notifications soon. req.url.startsWith("/node/notifications")
		if (req.method === "POST") {
			let data = JSON.parse((await getData()).toString())
			
			res.setHeader("Cache-Control", "no-store")

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
		}
	
		
		res.statusCode = 404;
		res.setHeader('Content-Type', 'text/plain');
		res.end('Unknown request\n');
	
}

const httpserver = http.createServer(httprequest);

httpserver.listen(httpport, hostname, () => {
  console.log(`Server running at http://${hostname}:${httpport}/`);
});
