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

function deleteUserSubscription(endpoint) {
	if (!fs.existsSync(storagePath)) {
        console.error("Can't delete subscription. storagePath doesn't exist.")
        return;
	}
    let current = fs.readFileSync(storagePath, {encoding:"utf8"})
	let obj = JSON.parse(current)
	delete obj[endpoint]
	fs.writeFileSync(storagePath, JSON.stringify(obj), {encoding:"utf8"})
}


function sendNotifications() {
	if (!fs.existsSync(storagePath)) {
		//There are no subscriptions
		console.warn("No subscriptions. ")
		return
	}
	let subscriptions = JSON.parse(fs.readFileSync(storagePath, {encoding:"utf8"}))
	let flowData = JSON.parse(fs.readFileSync(path.join(__dirname, "flowdata2.json"), {encoding:"utf8"}))

	for (let url in subscriptions) {
		let user = subscriptions[url]

        //Don't send the user a notification yet.
        if (user.noneUntil > Date.now()) {continue;}

		let parameters = user.parameters

        let data = {};
		for (let gauge in parameters) {
			let rivers = parameters[gauge]
			let flow = flowData[gauge]
			for (let prop in rivers) {
				let river = rivers[prop]

				let values;
				
				if (river.units === "cfs") {values = flowData[gauge].cfs}
				if (river.units === "ft") {values = flowData[gauge].feet}
				
				let latest = values[values.length - 1].value

				if (!(river.minimum < latest && latest < river.maximum)) {
					delete rivers[prop]
				}
				else {
					river.current = latest
				}
                data[prop] = rivers[prop]
			}
		}
        //We have now deleted every river that is not runnable. Send a push notification with the object of rivers.
        webpush.sendNotification(user.subscription, JSON.stringify(data), {
            //Not sure if vapidDetails is needed, because webpush.setVapidDetails was used above.
            vapidDetails: {
                subject: 'mailto:admin@rivers.run',
                publicKey: vapidKeys.publicKey,
                privateKey: vapidKeys.privateKey
            },
            TTL: 60*60*36 //Store notification for up to 36 hours.
        }).catch((e) => {
            console.error(e)
            //The users subscription is either now invalid, or never was valid.
            if (e.statusCode === 410 || e.statusCode === 404) {
                deleteUserSubscription(user.subscription.endpoint)
            }
        }).then(console.log)
	}
}

module.exports = sendNotifications
