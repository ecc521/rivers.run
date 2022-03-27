function getNewNoneUntil(user) {
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

	return newNoneUntil
}

module.exports = getNewNoneUntil
