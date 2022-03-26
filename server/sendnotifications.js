const path = require("path")
const fs = require("fs")

const utils = require(path.join(__dirname, "utils.js"))
const subscriptionManager = require(path.join(__dirname, "subscriptionManager.js"))

const sendEmails = require(path.join(__dirname, "sendEmails.js"))

function sendNotifications(gauges) {
	if (!fs.existsSync(subscriptionManager.storagePath)) {
		//There are no subscriptions
		console.warn("No subscriptions. ")
		return
	}
	let subscriptions = JSON.parse(fs.readFileSync(subscriptionManager.storagePath, {encoding:"utf8"}))

	for (let url in subscriptions) {
		let user = subscriptions[url]

        //Don't send the user a notification yet.
        if (user.noneUntil > Date.now()) {continue;}

		let parameters = user.parameters
        let data = {};
		for (let gauge in parameters) {
			let rivers = parameters[gauge]

			let readings = gauges[gauge]?.readings

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

                    river.flowInfo = ""
                    if (river.units === "cms" || river.units === "meters") {
                        flow.meters = flow?.feet / meterInFeet
                        flow.cms = flow?.cfs / cubicMeterInFeet

                        if (flow?.meters !== undefined) {
                            river.flowInfo += `${flow.meters} meters`
                        }
                        if (flow?.cms !== undefined) {
                            if (flow?.meters) {
                                river.flowInfo += ", "
                            }
                            river.flowInfo += `${flow.cms} cms`
                        }
                        if (flow?.cms === undefined && flow?.meters === undefined) {river.flowInfo += "No Flow Data"}
                    }
                    else {
                        if (flow?.feet !== undefined) {
                            river.flowInfo += `${flow.feet} feet`
                        }
                        if (flow?.cfs !== undefined) {
                            if (flow?.feet) {
                                river.flowInfo += ", "
                            }
                            river.flowInfo += `${flow.cfs} cfs`
                        }
                        if (flow?.feet === undefined && flow?.cfs === undefined) {river.flowInfo += "No Flow Data"}
                    }

                    river.current = flow?.[units]

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
		}
	}
}

module.exports = sendNotifications
