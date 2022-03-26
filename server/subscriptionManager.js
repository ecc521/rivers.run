const path = require("path")
const fs = require("fs")
const utils = require(path.join(__dirname, "utils.js"))

let notificationsDir = path.join(utils.getDataDirectory(), "notifications")
if (!fs.existsSync(notificationsDir)) {fs.mkdirSync(notificationsDir, {recursive: true})}

let storagePath = path.join(notificationsDir, "subscriptions.json")

function getStorageKey(data) {
	//Get the identifier that the data should be stored at
	return (data.subscription && data.subscription.endpoint) || data.address
}


//Note that the current storage design is a little ineffectient because the really long endpoint url is stored twice.
function saveUserSubscription(data) {
	let current = "{}";
	if (fs.existsSync(storagePath)) {
		current = fs.readFileSync(storagePath, {encoding:"utf8"})
	}
	let obj = JSON.parse(current)
	obj[getStorageKey(data)] = data
	fs.writeFileSync(storagePath, JSON.stringify(obj), {encoding:"utf8"})
}

function getUserSubscription(key) {
	if (!fs.existsSync(storagePath)) {
		return null
	}
	let current = fs.readFileSync(storagePath, {encoding:"utf8"})
	let obj = JSON.parse(current)
	return obj[key]
}

function deleteUserSubscription(key) {
	if (!fs.existsSync(storagePath)) {
        console.error("Can't delete subscription. storagePath doesn't exist.")
        return;
	}
    let current = fs.readFileSync(storagePath, {encoding:"utf8"})
	let obj = JSON.parse(current)
	if (typeof key === "object") {
		//Allow deleting a subscription object by passing the subscription object
		key = getStorageKey(key)
	}
	delete obj[key]
	fs.writeFileSync(storagePath, JSON.stringify(obj), {encoding:"utf8"})
}

module.exports = {
	deleteUserSubscription,
	getUserSubscription,
	saveUserSubscription,
	getStorageKey,
	storagePath
}
