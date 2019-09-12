const path = require("path")
const fs = require("fs")
const utils = require(path.join(__dirname, "utils.js"))

let storagePath = path.join(utils.getDataDirectory(), "notifications", "subscriptions.json")


//Note that the current storage design is a little ineffectient because the really long endpoint url is stored twice.
function saveUserSubscription(data) {
	let current = "{}";
	if (fs.existsSync(storagePath)) {
		current = fs.readFileSync(storagePath, {encoding:"utf8"})
	}
	let obj = JSON.parse(current)
	obj[(data.subscription && data.subscription.endpoint) || data.address] = data
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

function deleteUserSubscription(endpoint) {
	if (!fs.existsSync(storagePath)) {
        console.error("Can't delete subscription. storagePath doesn't exist.")
        return;
	}
    let current = fs.readFileSync(storagePath, {encoding:"utf8"})
	let obj = JSON.parse(current)
	if (typeof endpoint === "object") {
		//Allow deleting a subscription object by passing the subscription object
		endpoint = (data.subscription && data.subscription.endpoint) || data.address
	}
	delete obj[endpoint]
	fs.writeFileSync(storagePath, JSON.stringify(obj), {encoding:"utf8"})
}

module.exports = {
	deleteUserSubscription,
	getUserSubscription,
	saveUserSubscription,
	storagePath
}