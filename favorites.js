const getSearchLink = require("./src/getSearchLink.js")

let url = "https://rivers.run/node/notifications"

async function sendToServer(body) {
	let response = await fetch(url, {
		method: "POST",
		cache: "no-store",
		body:JSON.stringify(body)
	})
	return await response.text()
}

async function getSubscription(key) {
	let result = await sendToServer({
		getSubscriptionFromURL: key
	})
	if (result === "No Subscription") {return null}
	else {return JSON.parse(result)}
}

async function deleteEmailSubscription(key) {
	let result = await sendToServer({
		delete: true,
		address: key,
	})
	if (result === "Deleted Subscription") {return true}
	else {return result}
}

async function deleteBrowserSubscription(key) {
	let result = await sendToServer({
		delete: true,
		subscription: await (await navigator.serviceWorker.ready).pushManager.getSubscription()
	})
	if (result === "Deleted Subscription") {return true}
	else {return result}
}

async function updateSubscription(subscription) {
	let result = await sendToServer(subscription)
	if (result === "Saved Subscription") {return true}
	return result
}

async function updateNoneUntil(key, noneUntil) {
	//Server supports updating only noneUntil.
	let sub = {
		getSubscriptionFromURL: key,
		noneUntil
	}
	return updateSubscription(sub)
}

let subscription; //Last subscription from server. Note that favorites are stored client-side now.


//Format: [{id, name, minimum, maximum, units}]

let currentSelections = document.getElementById("currentSelections")
//Add the header
//This was HTML, but a space was added in between the spans, unless the spans had no whitespace between them.
currentSelections.innerHTML += '<div class="row"></div>'
currentSelections.firstChild.innerHTML += '<span class="gaugeColumn">Gauge</span>'
currentSelections.firstChild.innerHTML += '<span class="nameColumn">Name</span>'
currentSelections.firstChild.innerHTML += '<span class="minColumn">Min</span>'
currentSelections.firstChild.innerHTML += '<span class="maxColumn">Max</span>'
currentSelections.firstChild.innerHTML += '<span class="unitsColumn">Unit</span>'
//currentSelections.firstChild.innerHTML += '<span class="deleteButton">Delete</span>'

async function redrawRows() {
	//Clear the current list.
	let rows = currentSelections.children
	//The first child element is the header. Don't delete the firstChild, but the nextSibling.
	while (currentSelections.firstChild.nextSibling) {
		currentSelections.firstChild.nextSibling.remove()
	}

	let selections = JSON.parse(localStorage.getItem("favorites"))

	console.log(selections)

	let ids = []

	for (let gauge in selections) {
		for (let id in selections[gauge]) {

			ids.push(id)

			let row = document.createElement("div")
			row.className = "row"

			let gaugeColumn = document.createElement("span")
			gaugeColumn.className = "gaugeColumn"
			gaugeColumn.innerHTML = gauge.split(":").join(":<wbr>")
			if (gauge === "" || gauge === "undefined") {
				gaugeColumn.innerHTML = "None"
			}
			row.appendChild(gaugeColumn)

			let nameColumn = document.createElement("span")
			nameColumn.className = "nameColumn"
			nameColumn.innerHTML = `<a href="${getSearchLink([id], window.root)}">${selections[gauge][id].name + ((selections[gauge][id].section)?(" (" + selections[gauge][id].section) + ")":"")}</a>`
			row.appendChild(nameColumn)

			let minColumn = document.createElement("span")
			minColumn.className = "minColumn"
			row.appendChild(minColumn)

			let maxColumn = document.createElement("span")
			maxColumn.className = "maxColumn"
			row.appendChild(maxColumn)


			let unitsColumn = document.createElement("span")
			unitsColumn.className = "unitsColumn"
			row.appendChild(unitsColumn)

			function createUnitsSelector() {
				let units = document.createElement("select")

				let blank = document.createElement("option")
				blank.value = "-"
				blank.innerHTML = "-"
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

			if (gaugeColumn.innerHTML === "None") {
				unitsColumn.innerHTML = maxColumn.innerHTML = minColumn.innerHTML = "N/A"
				;[minColumn, maxColumn].forEach((col) => {
					col.addEventListener("click", function() {
						alert("This favorite has no gauge. If rivers.run has a gauge for it, try deleting this favorite and creating it again. ")
					})
				})
			}
			else {
				minColumn.innerHTML = `<span class="underlineText">${selections[gauge][id].minimum ?? "---"}</span>`
				maxColumn.innerHTML = `<span class="underlineText">${selections[gauge][id].maximum ?? "---"}</span>`

				minColumn.addEventListener("click", function(e) {
					//e.stopPropagation()
					let val = Number(prompt("What would you like the minimum to be?"))
					if (!val || isNaN(val)) {
						return alert("Please enter a number with no units. Ex, 425 or 8000")
					}
					selections[gauge][id].minimum = val
					localStorage.setItem("favorites", JSON.stringify(selections))
					console.log(JSON.stringify(selections))
					dataChanged()
				})

				maxColumn.addEventListener("click", function(e) {
					//e.stopPropagation()
					let val = Number(prompt("What would you like the maximum to be?"))
					if (!val || isNaN(val)) {
						return alert("Please enter a number with no units. Ex, 425 or 8000")
					}
					selections[gauge][id].maximum = val
					localStorage.setItem("favorites", JSON.stringify(selections))
					console.log(JSON.stringify(selections))
					dataChanged()
				})

				let selector = createUnitsSelector()
				unitsColumn.appendChild(selector)

				selector.value = selections[gauge][id].units ?? "-"

				selector.addEventListener("input", function() {
					selections[gauge][id].units = selector.value
					localStorage.setItem("favorites", JSON.stringify(selections))
					dataChanged()
				})
			}



			let deleteButton = document.createElement("span")
			deleteButton.className = "deleteButton"
			deleteButton.innerHTML = "✖"
			row.appendChild(deleteButton)

			deleteButton.addEventListener("click", function(e) {
				//e.stopPropagation();
				if (confirm("Remove " + selections[gauge][id].name + " at gauge " + gauge + "?")) {
					delete selections[gauge][id]
					//Trim out the gauge object if it is empty.
					if (Object.keys(selections[gauge]).length === 0) {
						delete selections[gauge]
					}
					localStorage.setItem("favorites", JSON.stringify(selections))
					console.log(JSON.stringify(selections))
					dataChanged()
				}
			})

			currentSelections.appendChild(row)
		}
	}

	console.log(ids)

	document.getElementById("favoritesLinks").innerHTML = `${ids.length} rivers in favorites - <a href="${getSearchLink(ids, window.root)}">View all favorites on rivers.run</a>`
}

if (localStorage.getItem("favorites") === null) {localStorage.setItem("favorites", "{}")}

async function dataChanged() {
	redrawRows()
	console.log("Ran")

	console.time("Start")
	document.getElementById("syncSpinner").style.display = "block"
	await updateSubscription({
		type: "email",
		address: getEmail(),
		parameters: JSON.parse(localStorage.getItem("favorites")),
		noneUntil: subscription?.noneUntil
	})
	document.getElementById("syncSpinner").style.display = ""
	emailUpdated()
	console.timeEnd("Start")
}

redrawRows()






function setDisabledView(options) {
	document.getElementById("subscribe").style.display = "inline-block"

	if (options && options.temporaryDisable) {
		//Show notification disabler
		document.getElementById("disable").style.display = "inline-block"
		document.getElementById("notificationsState").style.backgroundColor = window.darkMode?"#333300":"#ffffaa"
		document.getElementById("unsubscribe").style.display = "inline-block"
	}
	else {
		document.getElementById("disable").style.display = "none"
		document.getElementById("notificationsState").style.backgroundColor = window.darkMode?"#555500":"#ffff55"
		document.getElementById("unsubscribe").style.display = "none"
	}

	if (options && options.noEnableButton) {
		document.getElementById("subscribe").style.display = "none"
	}
}

function setEnabledView() {
	document.getElementById("subscribe").style.display = "none"
	document.getElementById("unsubscribe").style.display = "inline-block"
	document.getElementById("notificationsState").style.backgroundColor = ""
	document.getElementById("disable").style.display = "inline-block"
}



//Figure out what the email will initially be.
document.getElementById("email").value = localStorage.getItem("notificationsemail")
if (window.location.hash) {
	let data = window.location.hash.slice(1)
	if (data.includes("@")) {
		//Probably an email link. Use this email link to autofill.
		document.getElementById("email").value = data
		getEmail()
	}
}

//Get the email. Also saves the updated version.
function getEmail() {
	let email = document.getElementById("email").value
	localStorage.setItem("notificationsemail", email)
	return email
}

document.getElementById("saveEmail").addEventListener("click", emailUpdated)


function getDisabledUntilPhrase(DateObj) {
	if (!(DateObj instanceof Date)) {DateObj = new Date(DateObj)} //Allow time strings or milliseconds since epoch.
	return "Notifications disabled until " + DateObj.toLocaleDateString() + " at " + DateObj.toLocaleTimeString()
}

let ranOnce;
function updateSubscriptionStatus() {
	if (navigator.onLine === false) {
		document.getElementById("notificationsStatus").innerHTML = "This Page Requires Internet Access"
		setDisabledView({temporaryDisable: true})
	}
	else if (subscription === undefined) {
		document.getElementById("notificationsStatus").innerHTML = "Something went horribly wrong. Please try again later."
		setDisabledView({temporaryDisable: true})
	}
	else if (!getEmail().includes("@")) {
		document.getElementById("notificationsStatus").innerHTML = "Please select a valid email."
		setDisabledView({noEnableButton: true})
	}
	else if (subscription === null) {
		document.getElementById("notificationsStatus").innerHTML = getEmail() + " is not signed up for emails."
		setDisabledView()
	}
	else if (subscription.noneUntil > Date.now()) {
		document.getElementById("notificationsStatus").innerHTML = getDisabledUntilPhrase(subscription.noneUntil)
		setDisabledView({temporaryDisable: true})
	}
	else {
		document.getElementById("notificationsStatus").innerHTML = "Emails enabled for " + getEmail()
		setEnabledView()
		if (!ranOnce) {ranOnce = true; dataChanged()} //Make sure to sync.
	}
}

async function emailUpdated() {
	if (!getEmail().includes("@")) {
		subscription = null
	}
	else {
		try {
			subscription = await getSubscription(getEmail())
		}
		catch (e) {console.error(e)}
	}

	updateSubscriptionStatus()
}

;(async function() {

	//TODO: Add an option to turn off for a certain amount of time using noneUntil.

	document.getElementById("unsubscribe").addEventListener("click", async function() {
		if (confirm("Remove this email from notifications?")) {
			await deleteEmailSubscription(getEmail())
			emailUpdated()
		}
	})

	document.getElementById("subscribe").addEventListener("click", async function() {
		if (subscription === null) {
			if (!getEmail().includes("@")) {
				alert("Invalid email")
				return
			}
			dataChanged()
		}
		else {
			//Clear noneUntil
			await updateNoneUntil(getEmail(), 0)
		}
		await emailUpdated()
	})


	document.getElementById("disable").addEventListener("click", async function() {
		let hours = prompt("How many hours (from now) would you like to disable notifications for?")
		let disableUntil = new Date(Date.now() + hours*1000*60*60)
		await updateNoneUntil(getEmail(), disableUntil.getTime())
		alert(getDisabledUntilPhrase(disableUntil))
		emailUpdated()
	})

	emailUpdated()
}());

let deleteAllFavorites = document.getElementById("deleteAllFavorites")
deleteAllFavorites.addEventListener("click", function() {
	if (confirm("Delete all favorites?")) {
		localStorage.setItem("favorites", "{}")
		redrawRows()
	}
})
