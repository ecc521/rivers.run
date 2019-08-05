const webpush = require("web-push")

let storagePath = path.join(__dirname, "data", "notifications", "subscriptions.json")

function sendNotifications() {
	let subscriptions = fs.readFileSync(storagePath, {encoding:"utf8"})
	let flowData = fs.readFileSync(path.join(__dirname, "flowdata.json"), {encoding:"utf8"})

	//TODO: Send notifications.
}

module.exports = sendNotifications
