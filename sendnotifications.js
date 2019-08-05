const webpush = require("web-push")
const path = require("path")
const fs = require("fs")

let storagePath = path.join(__dirname, "data", "notifications", "subscriptions.json")

function sendNotifications() {
	let subscriptions = JSON.parse(fs.readFileSync(storagePath, {encoding:"utf8"}))
	//let flowData = JSON.parse(fs.readFileSync(path.join(__dirname, "flowdata.json"), {encoding:"utf8"}))

	for (let url in subscriptions) {
		let user = subscriptions[url]

		let parameters = user.parameters

		for (let gauge in parameters) {
			let rivers = parameters[gauge]
			let flow = flowData[gauge]
			for (let prop in rivers) {
				let river = rivers[prop]
				if (river.units === "cfs") {
					let values = usgsarray[gauge]["00065"].values
					let latest = values[values.length - 1].value

					if (!(river.minimum < latest && latest < river.maximum)) {
						delete rivers[prop]
					}
					else {
						river.current = latest
					}
				}
				else if (river.units === "ft") {
					let values = usgsarray[gauge]["00060"].values
					let latest = values[values.length - 1].value

					if (!(river.minimum < latest && latest < river.maximum)) {
						delete rivers[prop]
					}
					else {
						river.current = latest
					}
				}
			}
			//We have now deleted every river that is not runnable. Send a push notification with the object of rivers.
			webpush.sendNotification(user.subscription, JSON.stringify(rivers), {
				TTL: 60*60*36 //Store notification for up to 36 hours.
			})
		}
	}
}

module.exports = sendNotifications
