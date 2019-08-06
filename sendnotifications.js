const webpush = require("web-push")
const path = require("path")
const fs = require("fs")

let keysDirectory = path.join(__dirname, "data", "notifications")
let publicKeyPath = path.join(__dirname, "public_key") //Use the root directory for the public key.
let privateKeyPath = path.join(keysDirectory, "private_key")

let vapidKeys = {}
vapidKeys.publicKey = fs.readFileSync(publicKeyPath, {encoding:"utf8"})
vapidKeys.privateKey = fs.readFileSync(privateKeyPath, {encoding:"utf8"})

webpush.setVapidDetails(
  'mailto:admin@rivers.run',
  vapidKeys.publicKey,
  vapidKeys.privateKey
)

let storagePath = path.join(__dirname, "data", "notifications", "subscriptions.json")

function sendNotifications() {
	if (!fs.existsSync(storagePath)) {
		//There are no subscriptions
		console.warn("No subscriptions. ")
		return
	}
	let subscriptions = JSON.parse(fs.readFileSync(storagePath, {encoding:"utf8"}))
	let flowData = JSON.parse(fs.readFileSync(path.join(__dirname, "flowdata.json"), {encoding:"utf8"}))

	for (let url in subscriptions) {
		let user = subscriptions[url]

		let parameters = user.parameters

		for (let gauge in parameters) {
			let rivers = parameters[gauge]
			let flow = flowData[gauge]
			for (let prop in rivers) {
				let river = rivers[prop]
				if (river.units === "cfs") {
					let values = flowData[gauge]["00060"].values
					let latest = values[values.length - 1].value

					if (!(river.minimum < latest && latest < river.maximum)) {
						delete rivers[prop]
					}
					else {
						river.current = latest
					}
				}
				else if (river.units === "ft") {
					let values = flowData[gauge]["00065"].values
					let latest = values[values.length - 1].value

					if (!(river.minimum < latest && latest < river.maximum)) {
						delete rivers[prop]
					}
					else {
						river.current = latest
					}
				}
			}
			//TODO: Detect users that have unsubscribed, and remove them from the list.
			//Should be able to detect WebPushError: Received unexpected response code
			//We have now deleted every river that is not runnable. Send a push notification with the object of rivers.
			webpush.sendNotification(user.subscription, JSON.stringify(rivers), {
				vapidDetails: {
					subject: 'mailto:admin@rivers.run',
					publicKey: vapidKeys.publicKey,
					privateKey: vapidKeys.privateKey
				},
				TTL: 60*60*36 //Store notification for up to 36 hours.
			}).then(console.log)
		}
	}
}

module.exports = sendNotifications
