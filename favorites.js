import { GoogleAuthProvider, OAuthProvider, updatePassword, signInWithCredential } from "firebase/auth";
const {auth} = require("./src/firebase/accounts.js")

import { Initialize_UI, Display_Templates, injectDefaultStyles, createFirebaseBindings } from "ui-for-firebase-authentication"

injectDefaultStyles()

let googleProvider = new GoogleAuthProvider()
let appleProvider = new OAuthProvider("apple.com")

//Add email scope.
googleProvider.addScope("https://www.googleapis.com/auth/userinfo.email")
appleProvider.addScope("email")

let providers = [
	{
		provider: googleProvider,
		display: Display_Templates.Google_Light
	},
	{
		provider: appleProvider,
		display: Display_Templates.Apple_Dark
	},
	{
		provider: "email",
		display: Display_Templates.Email_Dark
	},
]






let signInOptionsContainer = document.getElementById("signInOptionsContainer")

let authenticationBindings = createFirebaseBindings(auth)

authenticationBindings.signInWithProvider = function(provider) {
	//Override signInWithProvider on native where we will want to use the native sign in APIs.
	let str = ""
	if (provider === googleProvider) {
		str = "google"
	}
	else if (provider === appleProvider) {
		str = "apple"
	}
	return window.signInWithProvider(str, {skipNativeAuth: true}).then((signInResult) => {
		let cred;
		if (provider instanceof GoogleAuthProvider) {
			cred = provider.constructor.credential(signInResult.credential.idToken)
		}
		else {
			cred = provider.credential({
				idToken: signInResult.credential.idToken,
				rawNonce: signInResult.credential.nonce
			})
		}

		return signInWithCredential(auth, cred)
	})
}

function ui_reinit() {
	Initialize_UI(authenticationBindings, providers, signInOptionsContainer)
}
ui_reinit()

auth.onAuthStateChanged(function(newAuth) {
	console.log(newAuth)
})


const accounts = require("./src/firebase/accounts.js")

let signedInStatusText = document.getElementById("signedInStatusText")

let signOutButton = document.getElementById("signOutButton")

let manageAccountButton = document.getElementById("manageAccountButton")




const {loadFavorites, getFavoritesLastModified, writeFavorites, mergeFavoritesObjects} = require("./src/addToFavorites.js")
const getSearchLink = require("./src/getSearchLink.js")
let notificationsState = document.getElementById("notificationsState")

function updateSignInStatus() {
	let user = accounts.getCurrentUser()
	console.warn(user)
	let text;
	if (user) {
		//Remove the sign in options
		while (signInOptionsContainer.lastChild) {signInOptionsContainer.lastChild.remove()}
		//Show account management.
		manageAccountButton.style.display = signOutButton.style.display = ""
		text = `Signed in as ${accounts.getCurrentUserDetails().email}. `
	}
	else {
		//Display the sign in options
		ui_reinit()
		//Hide account management
		manageAccountButton.style.display = signOutButton.style.display = "none"
		text = `Sign in to Sync Favorites and Receive Notifications! `
		notificationsState.style.display = "none"
	}
	signedInStatusText.innerHTML = text
}

auth.onAuthStateChanged(updateSignInStatus)





signOutButton.addEventListener("click", async function() {
	await auth.signOut()
})

let deleteAccountButton = document.createElement("button")
deleteAccountButton.innerHTML = "Delete Account"
deleteAccountButton.addEventListener("click", async function() {
	if (confirm("Delete your account?")) {
		await auth.currentUser.delete()
	}
})

let passwordEntryField = document.createElement("input")
passwordEntryField.placeholder = "Enter New Password..."
passwordEntryField.type = "password"

let setPassword = document.createElement("button")

let togglePasswordVisibility = document.createElement("button")
togglePasswordVisibility.innerHTML = "Show"

let manageAccountWindow = document.createElement("div")
manageAccountWindow.style.textAlign = "center"
manageAccountWindow.innerHTML = "<h2>Manage Account</h2><p>Passwords are optional if you sign in with Google, Apple, or another service. Setting a password allows you to log in with your email and password as well. </p>"
manageAccountWindow.appendChild(passwordEntryField)
manageAccountWindow.appendChild(togglePasswordVisibility)
manageAccountWindow.appendChild(document.createElement("br"))
manageAccountWindow.appendChild(setPassword)

let deleteAccountWarning = document.createElement("p")
deleteAccountWarning.innerHTML = "Deleting your account will prevent syncing of your favorites data between devices. You can always create a new account later. "

manageAccountWindow.appendChild(deleteAccountWarning)
manageAccountWindow.appendChild(deleteAccountButton)

manageAccountButton.addEventListener("click", function() {
	createModal(manageAccountWindow)
})

setPassword.addEventListener("click", async function() {
	if (passwordEntryField.value.length === 0) {return} //Firebase accepts a blank string as a password - though it then throws internal auth errors, so it may be equivalent to disabling passwords.
	await updatePassword(auth.currentUser, passwordEntryField.value)
})

togglePasswordVisibility.addEventListener("click", function() {
	if (passwordEntryField.type === "password") {
		togglePasswordVisibility.innerHTML = "Hide"
		passwordEntryField.type = "text"
	}
	else {
		togglePasswordVisibility.innerHTML = "Show"
		passwordEntryField.type = "password"
	}
})


function setPasswordInfo() {
	let hasPassword = accounts.getCurrentUser()?.providerData?.some((provider) => {return provider.providerId === "password"})

	if (hasPassword) {
		setPassword.innerHTML = "Update Password"
	}
	else {
		setPassword.innerHTML = "Set Password"
	}
}
setPasswordInfo()
auth.onAuthStateChanged(setPasswordInfo)










//accounts.setData merges unless false is passed as a second argument.
//Therefore, we can indescriminately setData with our new favorites - it won't destroy anything already up there.
//But when things are updated individually on the client, we either need to overwrite or figure out how to delete specific map keys.


let notificationStatus = document.getElementById("notificationStatus")

let enableButton = document.getElementById("enable")
let disableButton = document.getElementById("disable")
let timeInput = document.getElementById("timeOfDay")
let disabledDate = document.getElementById("disabledDate")

let timeInputLabel = document.querySelector("label[for='timeOfDay']")
let disabledDateLabel = document.querySelector("label[for='disabledDate']")

enableButton.addEventListener("click", async function() {
	await accounts.setNotificationsConfig({
		enabled: true,
		noneUntil: 0,
	})
	updateNotificationsUI() //TODO: We don't actually need to issue a read here - we know the config, and what we changed.
})

disableButton.addEventListener("click", async function() {
	await accounts.setNotificationsConfig({
		enabled: false
	})
	updateNotificationsUI() //TODO: We don't actually need to issue a read here - we know the config, and what we changed.
})

timeInput.addEventListener("change", async function() {
	if (timeInput.value === "") {
		return
	}

	let [hours, minutes] = timeInput.value.split(":")
	let simDate = new Date().setHours(hours, minutes, 0, 0)
	simDate = new Date(simDate)

	let utcHours = String(simDate.getUTCHours()).padStart(2, 0)
	let utcMinutes = String(simDate.getUTCMinutes()).padStart(2, 0)

	await accounts.setNotificationsConfig({
		timeOfDay: utcHours + ":" + utcMinutes
	})
})

disabledDate.addEventListener("change", async function() {
	let noneUntil;
	if (disabledDate.value === "") {
		noneUntil = 0
	}
	else {
		noneUntil = new Date(timeInput.value + " " + disabledDate.value).getTime()
	}
	await accounts.setNotificationsConfig({noneUntil})
	updateNotificationsUI()
})

function getDisabledUntilPhrase(DateObj) {
	if (!(DateObj instanceof Date)) {DateObj = new Date(DateObj)} //Allow time strings or milliseconds since epoch.
	return "Email Notifications disabled until " + DateObj.toLocaleTimeString() + " on " + DateObj.toLocaleDateString()
}

async function updateNotificationsUI(data) {
	let notifications = await accounts.getNotificationsConfig(data)
	notificationsState.style.display = ""

	if (notifications.enabled) {
		enableButton.style.display = "none"
		disableButton.style.display = ""
		timeInputLabel.style.display = timeInput.style.display = ""
		disabledDateLabel.style.display = disabledDate.style.display = ""
	}
	else {
		notificationStatus.innerHTML = "Email Notifications Disabled"
		enableButton.style.display = ""
		disableButton.style.display = "none"
		timeInputLabel.style.display = timeInput.style.display = "none"
		disabledDateLabel.style.display = disabledDate.style.display = "none"
		return
	}

	let timeZoneOffset = new Date().getTimezoneOffset();

	let todaysDate = new Date(Date.now() - timeZoneOffset).toJSON().split("T")[0];

	disabledDate.min = todaysDate

	if (notifications.noneUntil > Date.now()) {
		notificationStatus.innerHTML = getDisabledUntilPhrase(notifications.noneUntil)
		disabledDate.value = new Date(notifications.noneUntil).toISOString().split("T")[0]
	}
	else {
		notificationStatus.innerHTML = "Email Notifications Enabled"
	}
}




//Manage favorites.
//alwaysOverwrite will be used for edits performed on this page.
async function syncFavorites(alwaysOverwrite = false) {
	if (!accounts.getCurrentUser()) {return}

	let localFavorites = loadFavorites()

	if (alwaysOverwrite) {
		accounts.setFavorites(localFavorites, false)
		return
	}

	let localLastModified = getFavoritesLastModified()

	let data = await accounts.getData()
	let netFavorites = await accounts.getFavorites(data)
	let netLastModified = await accounts.getFavoritesLastModified(data)

	await updateNotificationsUI(data)

	//If net modified more recently than local, overwrite local with net.
	//If local modified more recently than net:
	// - It is possible that this should be the new favorites entirely.
	// - It is possible that we just added a favorite, but are otherwise out of date and need to remove everything not in the sync.
	// - Without a change history, this is hard to determine. Therefore, we will take the non-destructive approach and merge.

	//The !== null check can be removed eventually.
	//favoritesLastModified is a recent addition, and therefore genuine favorites lists might not have it set.
	//Once favoritesLastModified has been out for long enough, it can be assumed that all users have it set.
	if (netLastModified > localLastModified && localLastModified !== null) {
		writeFavorites(netFavorites)
	}
	else {
		let newFavorites = mergeFavoritesObjects(localFavorites, netFavorites)
		console.log(localFavorites, netFavorites, newFavorites)
		writeFavorites(newFavorites)
		accounts.setFavorites(newFavorites)
	}
	dataChanged()
}

auth.onAuthStateChanged(function() {
	syncFavorites()
})


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

//Rendering code.
async function redrawRows() {
	//Clear the current list.
	let rows = currentSelections.children
	//The first child element is the header. Don't delete the firstChild, but the nextSibling.
	while (currentSelections.firstChild.nextSibling) {
		currentSelections.firstChild.nextSibling.remove()
	}

	let selections = loadFavorites()

	//We'll sort favorites by name.
	let ids = []
	let rowElems = [] //Objects. {name, row}. Stored here to sort.

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

			let nameAndSection = selections[gauge][id].name + ((selections[gauge][id].section)?(" (" + selections[gauge][id].section) + ")":"")

			let nameColumn = document.createElement("span")
			nameColumn.className = "nameColumn"
			nameColumn.innerHTML = `<a href="${getSearchLink([id], window.root)}">${nameAndSection}</a>`
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
					writeFavorites(selections)
					accounts.setFavorites(selections, false)
					dataChanged()
				})

				maxColumn.addEventListener("click", function(e) {
					//e.stopPropagation()
					let val = Number(prompt("What would you like the maximum to be?"))
					if (!val || isNaN(val)) {
						return alert("Please enter a number with no units. Ex, 425 or 8000")
					}
					selections[gauge][id].maximum = val
					writeFavorites(selections)
					accounts.setFavorites(selections, false)
					dataChanged()
				})

				let selector = createUnitsSelector()
				unitsColumn.appendChild(selector)

				selector.value = selections[gauge][id].units ?? "-"

				selector.addEventListener("input", function() {
					selections[gauge][id].units = selector.value
					writeFavorites(selections)
					accounts.setFavorites(selections, false)
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
					writeFavorites(selections)
					accounts.setFavorites(selections, false)
					dataChanged()
				}
			})

			rowElems.push({row, name: nameAndSection})
		}
	}

	rowElems.sort((a, b) => {
		if (a.name > b.name) {return 1}
		else if (a.name < b.name) {return -1}
		return 0
	})

	rowElems.forEach((obj) => {
		currentSelections.appendChild(obj.row)
	})

	let favoritesLinks = document.getElementById("favoritesLinks")
	favoritesLinks.innerHTML = `${ids.length} rivers in favorites - `

	//On iOS, we want the search link to point to rivers.run, but go to the local server when clicked.
	let a = document.createElement("a")
	a.href = getSearchLink(ids)
	a.innerHTML = "View all favorites on rivers.run"
	a.addEventListener("click", function(e) {
		window.location.href = getSearchLink(ids, window.root)
		e.preventDefault()
	})
	favoritesLinks.appendChild(a)
}


async function dataChanged() {
	redrawRows()
}

redrawRows()



//Utility buttons at top - delete all favorites and scroll to bottom.
let deleteAllFavorites = document.getElementById("deleteAllFavorites")
deleteAllFavorites.addEventListener("click", function() {
	if (confirm("Delete all favorites?")) {
		writeFavorites({})
		accounts.setFavorites({}, false)
		dataChanged()
	}
})

let scrollToBottom = document.getElementById("scrollToBottom")
scrollToBottom.addEventListener("click", function() {
	window.scrollTo(0, 1e10)
})
