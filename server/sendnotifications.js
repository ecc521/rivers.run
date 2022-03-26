const path = require("path")
const fs = require("fs")

const utils = require("./utils.js")

const {loadUserData} = require("./firebase-admin.js")
const {sendEmail} = require(path.join(__dirname, "sendEmails.js"))

const meterInFeet = 3.2808399
const cubicMeterInFeet = meterInFeet**3

function addFlowDataToFavorites(favorites, gauges = {}) {
	for (let gaugeID in favorites) {
		let rivers = favorites[gaugeID]
		let readings = gauges[gaugeID]?.readings || []

		let latestReading = {};
		for (let i=readings.length - 1;i>=0;i--) {
			//Find the latest non-forecast flow value.
			if (readings[i].forecast !== true) {
				latestReading = readings[i];
				break;
			}
		}

		for (let riverID in rivers) {
			river = rivers[riverID]

			let units = river.units
			river.flowInfo = "No Flow Data"

			latestReading.meters = latestReading?.feet / meterInFeet
			latestReading.cms = latestReading?.cfs / cubicMeterInFeet

			if (river.units === "cms" || river.units === "meters") {
				if (latestReading?.meters !== undefined) {
					river.flowInfo = `${latestReading.meters} meters`
				}
				if (latestReading?.cms !== undefined) {
					if (latestReading?.meters) {
						river.flowInfo += ", "
					}
					else {
						river.flowInfo = ""
					}
					river.flowInfo += `${latestReading.cms} cms`
				}
			}
			else {
				if (latestReading?.feet !== undefined) {
					river.flowInfo = `${latestReading.feet} feet`
				}
				if (latestReading?.cfs !== undefined) {
					if (latestReading?.feet) {
						river.flowInfo += ", "
					}
					else {
						river.flowInfo = ""
					}
					river.flowInfo += `${latestReading.cfs} cfs`
				}
			}

			river.latestReading = latestReading?.[units]

			let status;
			if (river.latestReading > river.maximum) {
				status = "high"
			}
			else if (river.latestReading < river.minimum) {
				status = "low"
			}
			else if ((river.minimum === undefined && river.maximum === undefined) || river.latestReading === undefined) {
				status = "unknown"
			}
			else {
				status = "running"
			}

			river.status = status
		}
	}
}

async function updateUserNoneUntil(user) {
	let newNoneUntil = new Date()

	//Set the time of day first.
	let timeOfDay = user.notifications?.timeOfDay || "10:00" //Default timeOfDay (in UTC - this is 6am Eastern)
	if (timeOfDay) {
		let [hours, minutes] = timeOfDay.split(":")
		newNoneUntil = newNoneUntil.setHours(hours, minutes, 0, 0)
	}

	//If the time is now in the past, add a day. Otherwise, don't.
	if (newNoneUntil < Date.now()) {
		newNoneUntil += 1000 * 60 * 60 * 24
	}

	console.log(newNoneUntil)

	//Write the value to firebase.
	await user.document.ref.set({
		notifications: {
			noneUntil: newNoneUntil
		},
	}, {merge: true})
}

async function sendNotifications(gauges) {
	let userData = await loadUserData()

	for (let i=0;i<userData.length;i++) {
		let user = userData[i]

		//These two if conditions should have already been checked by filters, however check them anyways.
		if (user.noneUntil > Date.now()) {continue;}
		if (!user.notifications?.enabled) {continue;}

		addFlowDataToFavorites(user.favorites, gauges)

		sendEmail(user)

		//Right now we only offer email notifications - therefore, we can assume noneUntil can always be updated, as an email is always sent for users.
		updateUserNoneUntil(user)
	}
}

module.exports = {
	sendNotifications
}
