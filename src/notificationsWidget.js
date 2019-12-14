//TODO: Need support for CMS and Meters.

function createUnitsSelector() {
	let units = document.createElement("select")

	let blank = document.createElement("option")
	blank.selected = true
	blank.disabled = true
	blank.value = ""
	blank.innerHTML = "Units"
	units.appendChild(blank)

	let feet = document.createElement("option")
	feet.value = "feet"
	feet.innerHTML = "Feet"
	units.appendChild(feet)

	let cfs = document.createElement("option")
	cfs.value = "cfs"
	cfs.innerHTML = "CFS"
	units.appendChild(cfs)

	let meters = document.createElement("option")
	meters.value = "meters"
	meters.innerHTML = "Meters"
	units.appendChild(meters)

	let cms = document.createElement("option")
	cms.value = "cms"
	cms.innerHTML = "CMS"
	units.appendChild(cms)

	return units
}


			function createDeviceNotificationsWidget(river, usgsID) {
				let data = {
					id: river.id,
					name: river.name
				}

				let existing;
				let current;

				function resyncData() {
					existing = JSON.parse(localStorage.getItem("flownotifications") || "{}")
					current = existing[usgsID]
					if (current) {
						current = current[river.id]
					}
				}

				resyncData()

				console.log(current)

				//Container for the river alert creator.
				let container = document.createElement("div")
				container.className = "notificationsContainer"

				//Describe what this does, and alert the user if their browser is unsupported.
				let description = document.createElement("p")
				container.appendChild(description)
				description.innerHTML = "Receive notifications for " + ((usgsarray[usgsID] && usgsarray[usgsID].name) || "this river") + ":<br>"
				description.style.marginBottom = "0.5em" //Make the description closer to what it is describing...

				if (!("PushManager" in window) || !("Notification" in window) || !("serviceWorker" in navigator)) {
					description.innerHTML += "Your browser does not support flow alerts. (iOS users - blame Apple for abusive app store monopoly behavior). You may however utilize email notifications."
					return description;
				}

				let low = document.createElement("input")
				low.className = "minimum"
				low.type = "number"
				low.placeholder = "Minimum"
				low.value = (current && current.minimum) || ""

				let high = document.createElement("input")
				high.className = "maximum"
				high.placeholder = "Maximum"
				high.value = (current && current.maximum) || ""
				high.type = "number"

				let units = createUnitsSelector()
				units.value = (current && current.units) || ""

				let save = document.createElement("button")
				save.innerHTML = "Save"

				save.addEventListener("click", function() {
			        let lowValue = parseFloat(low.value)
					let highValue = parseFloat(high.value)

					data.minimum = lowValue
					data.maximum = highValue
					data.units = units.value

					if (isNaN(lowValue)) {
						alert("Minimum must be a number. Ex: 2.37, 3000")
						return
					}

					if (isNaN(highValue)) {
						alert("Maximum must be a number. Ex: 2.37, 3000")
						return
					}

					if (!units.value) {
						alert("Please specify which units should be used.")
						return;
					}

					resyncData() //Make sure we don't restore rivers that were removed while this river was open.

					existing[usgsID] = existing[usgsID] || {}
					existing[usgsID][river.id] = data

					localStorage.setItem("flownotifications", JSON.stringify(existing))

					window.open("notifications.html")
				})

				let manage = document.createElement("button")
				manage.innerHTML = "Manage Notifications"
				manage.addEventListener("click", function() {
					window.open("notifications.html")
				})

				container.appendChild(low)
				container.appendChild(high)
				container.appendChild(units)
				container.appendChild(save)
				container.appendChild(manage)
				return container
			}




//TODO: How should email notificatios get handled?

//Proposal: Seperate widget. Save button may want to actually save instead of opening the window.
//TODO: Remove a lot of duplication

			function createEmailNotificationsWidget(river, usgsID) {
				let data = {
					id: river.id,
					name: river.name
				}

				//Container for the river alert creator.
				let container = document.createElement("div")
				container.className = "notificationsContainer"

				//Describe what this does, and alert the user if their browser is unsupported.
				let description = document.createElement("p")
				container.appendChild(description)
				description.innerHTML = "Receive Emails for " + ((usgsarray[usgsID] && usgsarray[usgsID].name) || "this river") + ":<br>"
				description.style.marginBottom = "0.5em" //Make the description closer to what it is describing...

				let low = document.createElement("input")
				low.className = "minimum"
				low.type = "number"
				low.placeholder = "Minimum"

				let high = document.createElement("input")
				high.className = "maximum"
				high.placeholder = "Maximum"
				high.type = "number"

				let units = createUnitsSelector()

				let save = document.createElement("button")
				save.innerHTML = "Save"

				save.addEventListener("click", function() {
					let addparameters = {}

			        let lowValue = parseFloat(low.value)
					let highValue = parseFloat(high.value)

					data.minimum = lowValue
					data.maximum = highValue

					data.units = units.value

					if (isNaN(lowValue)) {
						alert("Minimum must be a number. Ex: 2.37, 3000")
						return
					}

					if (isNaN(highValue)) {
						alert("Maximum must be a number. Ex: 2.37, 3000")
						return
					}

					if (!units.value) {
						alert("Please specify which units should be used.")
						return;
					}

					addparameters[usgsID] = {}
					addparameters[usgsID][river.id] = data

					localStorage.setItem("addparameters", JSON.stringify(addparameters))

					window.open("emailnotifications.html")
				})

				let manage = document.createElement("button")
				manage.innerHTML = "Manage Notifications"
				manage.addEventListener("click", function() {
					window.open("emailnotifications.html")
				})

				container.appendChild(low)
				container.appendChild(high)
				container.appendChild(units)
				container.appendChild(save)
				container.appendChild(manage)
				return container
			}


			module.exports = {
				createDeviceNotificationsWidget,
				createEmailNotificationsWidget
			}
