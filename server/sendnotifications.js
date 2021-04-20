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
        //TODO: Update for new format. Add meters support.
        let data = {};
		for (let gauge in parameters) {
			let rivers = parameters[gauge]

			let readings;

            try {
                readings = JSON.parse(fs.readFileSync(path.join(utils.getSiteRoot(),"gaugeReadings", gauge))).readings
            }
            catch(e) {
                console.error(e)
            }

			for (let prop in rivers) {
                try {
                    if (!readings) {readings = []}

                    let river = rivers[prop]

                    let flow;
                    for (let i=readings.length - 1;i>=0;i--) {
                        //Find the latest non-forecast flow value.
                        if (readings[i].forecast !== true) {
                            flow = readings[i];
                            break;
                        }
                    }

                    let units = river.units

                    let meterInFeet = 3.2808399
                    let cubicMeterInFeet = meterInFeet**3

                    if (river.units === "cms") {river.current = flow?.cfs / cubicMeterInFeet}
                    if (river.units === "meters") {river.current = flow?.feet / meterInFeet}
                    else {river.current = flow[units]}

                    if (river.minimum <= river.current && river.current <= river.maximum) {
                        data[prop] = rivers[prop] //Add the river if it is running
                        data[prop].running = true
                    }
                    else {
                        if (user.type === "email") {
                            rivers[prop].running = false //For email only, add the river even if it is not running.
                            data[prop] = rivers[prop]
                        }
                    }
                }
                catch(e) {
                    console.error(e)
                }
			}
		}

		//Consider if we should overrule user.noneUntil on changes.
		user.previousMessage = user.previousMessage || {}

		//Don't send empty unless it is a change.
		//TODO: Consider sending the user a demo message if this is their first time (so if previousData is not defined

		if (JSON.stringify(user.previousMessage) === "{}" && JSON.stringify(data) === "{}") {
			continue; //We are sending an empty message, and we either already sent one or never sent a message in the first place.
		}

		if (JSON.stringify(parameters) === "{}") {continue;} //The user does not want notifications on anything right now.

		if (user.type === "email") {
			fs.appendFileSync(path.join(utils.getLogDirectory(), 'emailnotifications.log'), JSON.stringify(user) + "\n");
			sendEmails.sendEmail(user, data).then((res) => {
				if (res !== false) {
					user.noneUntil = Date.now() + 1000*60*60*24 //No emails for 24 hours.
					fs.appendFileSync(path.join(utils.getLogDirectory(), 'emailnotifications.log'), JSON.stringify(user) + "\n");
					subscriptionManager.saveUserSubscription(user) //Some properties of user should also have been modified by sendEmails.sendEmail
				}
			})
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
                subscriptionManager.deleteUserSubscription(user)
            }
        }).then(() => {
			user.previousMessage = data
			subscriptionManager.saveUserSubscription(user)
			fs.appendFileSync(path.join(utils.getLogDirectory(), 'browsernotifications.log'), JSON.stringify(user) + "\n");
			fs.appendFileSync(path.join(utils.getLogDirectory(), 'browsernotifications.log'), JSON.stringify(data) + "\n");
		})
	}
}

module.exports = sendNotifications
