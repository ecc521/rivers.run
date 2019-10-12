const webpush = require("web-push")
const path = require("path")
const fs = require("fs")

const utils = require(path.join(__dirname, "utils.js"))
const subscriptionManager = require(path.join(__dirname, "subscriptionManager.js"))

const sendEmails = require(path.join(__dirname, "sendEmails.js"))

const vapidKeys = require(path.join(__dirname, "vapidKeys.js"))

webpush.setVapidDetails(
  'mailto:admin@rivers.run',
  vapidKeys.publicKey,
  vapidKeys.privateKey
)

function sendNotifications(ignoreNoneUntil = false) {
	if (!fs.existsSync(subscriptionManager.storagePath)) {
		//There are no subscriptions
		console.warn("No subscriptions. ")
		return
	}
	let subscriptions = JSON.parse(fs.readFileSync(subscriptionManager.storagePath, {encoding:"utf8"}))

	for (let url in subscriptions) {
		let user = subscriptions[url]

        //Don't send the user a notification yet.
        if (!ignoreNoneUntil && user.noneUntil > Date.now()) {continue;}

		let parameters = user.parameters

        let data = {};
		for (let gauge in parameters) {
			let rivers = parameters[gauge]
			let flow = JSON.parse(fs.readFileSync(path.join(utils.getSiteRoot(),"gaugeReadings",gauge)))
			for (let prop in rivers) {
				let river = rivers[prop]

				let values;

				if (river.units === "cfs") {values = flow.cfs}
				if (river.units === "ft") {values = flow.feet}

				let latest = values[values.length - 1].value

				//Don't delete for email notifications
				if (!(river.minimum < latest && latest < river.maximum)) {
					if (data.type === "email") {
						rivers[prop].running = false
						river.current = latest
					}
					else {
						delete rivers[prop]
					}
				}
				else {
					river.current = latest
				}
                data[prop] = rivers[prop]
			}
		}

		//Consider if we should overrule user.noneUntil on changes.
		let previousData = user.previousMessage

		//Don't send empty unless it is a change.
		//TODO: Consider sending the user a demo message if this is their first time (so if previousData is not defined

		if (!previousData || JSON.stringify(previousData) === "{}") {
			if (JSON.stringify(data) === "{}") {
				continue; //We are sending an empty message, and we either already sent one or never sent a message in the first place.
			}
		}

		if (JSON.stringify(parameters) === "{}") {continue;} //The user does not want notifications on anything right now.

		user.previousMessage = data
		subscriptionManager.saveUserSubscription(user)

		if (user.type === "email") {
			let res = sendEmails.sendEmail(user, data)
			if (res !== false) {
				user.noneUntil = Date.now() + 1000*60*60*24 //No emails for 24 hours.
				subscriptionManager.saveUserSubscription(user) //Some properties of user should also have been modified by sendEmails.sendEmail
			}
			//Handle email notifications
			//user.address
			continue;
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
            if ([401,403,404,410].includes(e.statusCode)) {
                subscriptionManager.deleteUserSubscription(user.subscription.endpoint)
            }
        }).then(console.log)
	}
}

module.exports = sendNotifications
