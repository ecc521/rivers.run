const fs = require("fs")
const path = require("path")
const utils = require(path.join(__dirname, "utils.js"))

const webpush = require("web-push")

//Either use the existing VAPID keys, or generate new ones.
//The private key must not be web accessable.
let vapidKeys = {};
let keysDirectory = path.join(utils.getDataDirectory(), "notifications")
let publicKeyPath = path.join(utils.getSiteRoot(), "public_key") //Use the root directory for the public key.
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

module.exports = vapidKeys
