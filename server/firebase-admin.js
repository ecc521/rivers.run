//This code uses the .auth and .document fields of firebase documents to store generated data.
//Those property names should not be used in the firebase users collection, as they will not always be accessible.

const path = require("path")
const utils = require("./utils.js")

const admin = require("firebase-admin");

//TODO: Perhaps use Google Cloud service account lookup or some better method of passing credentials?
const serviceAccount = path.join(utils.getDataDirectory(), "notifications", "firebase-adminsdk-wzb5p.json")

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const auth = admin.auth();

const users = db.collection("users")

//TODO: Do listeners count towards reads? Are we double reading here?
async function loadUserData() {
	let usersToExamine = await users
		.where("notifications.enabled", "==", true) //Only where notifications enabled.
		.where("notifications.noneUntil", "<=", Date.now()) //Only where noneUntil doesn't disable - WARNING: This means noneUntil must have a default value!
		.get()

	let usersMap = new Map()

	usersToExamine.forEach((queryDocumentSnapshot) => {
		let data = queryDocumentSnapshot.data()
		let uid = queryDocumentSnapshot.id
		data.document = queryDocumentSnapshot //Provide a reference to the original document so this record can be amended.
		usersMap.set(uid, data)
	})

	await loadEmailsForUsers(usersMap)

	let usersArr = Array.from(usersMap.values())
	return usersArr
}

async function loadEmailsForUsers(usersMap) {
	userIDs = Array.from(usersMap.keys())

	userIDs = userIDs.map((userID) => {
		return {uid: userID}
	})

	let users = await auth.getUsers(userIDs)
	users = users.users //There is also a .notFound
	users.forEach((user) => {
		usersMap.get(user.uid).auth = user
	})
}

module.exports = {loadUserData, loadEmailsForUsers}
