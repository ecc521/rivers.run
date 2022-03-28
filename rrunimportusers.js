//Code to import users from subscriptions.json
//Not used in server. Designed to be copy pasted into nodejs console from server directory (the same directory as utils.js)

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

const fs = require("fs")
const pathToSubscriptionsJSON = ""
let subscriptions = JSON.parse(fs.readFileSync(pathToSubscriptionsJSON, {encoding: "utf-8"}))

for (let email in subscriptions) {
	console.log(email)
	auth.createUser({
		email: email.toLowerCase().trim(),
		emailVerified: false,
		password: 'paddlehard',
	}).then((userRecord) => {
		users.doc(userRecord.uid).set({
			favorites: subscriptions[email].parameters,
			notifications: {enabled: true}
		}).then(() => {
			console.log('Successfully created new user:', userRecord.uid);
		})
	}, console.error)
}
