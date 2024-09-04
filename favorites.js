import {PasswordConfirmingUnit, PasswordEntryBox} from "./passwordUIClasses";

let signedInManager = document.getElementById("signedInManager")

let EMAIL_PROVIDER = "email";
function createButtonForProvider(providerDetails) {
	//Creates a stylized UI button given the provided parameters. Will NOT add event listeners to the button.
	//All buttons should be the same size (this is sometimes a branding requirement)

	let button = document.createElement("button")
	button.classList.add("loginProviderButton")

	if (providerDetails.icon) {
		//Add an icon, left justified, and centered vertically within the button.
		let imageComponent = document.createElement("img")
		imageComponent.src = providerDetails.icon

		imageComponent.style.filter = providerDetails.iconFilter //We will allow for filters to be applied to the icon (like inverting).

		button.append(imageComponent)
	}

	let textComponent = document.createElement("span")
	textComponent.innerHTML = `Sign in with ${providerDetails.name}`
	button.appendChild(textComponent)


	button.style.backgroundColor = providerDetails.backgroundColor
	button.style.color = providerDetails.color

	return button
}

//Everything related to account management must be stored in signedInManager

import { GoogleAuthProvider, OAuthProvider, FacebookAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, fetchSignInMethodsForEmail } from "firebase/auth";
const {auth} = require("./src/firebase/accounts.js")

window.fetchSignInMethodsForEmail = fetchSignInMethodsForEmail
window.signInWithPopup = signInWithPopup

let googleProvider = new GoogleAuthProvider()
let appleProvider = new OAuthProvider()
let facebookProvider = new FacebookAuthProvider()

//Add email scope.
googleProvider.addScope("https://www.googleapis.com/auth/userinfo.email")
appleProvider.addScope("email")
facebookProvider.addScope("email")

let providers = [
	{
		provider: googleProvider,
		name: "Google",
		icon: "resources/loginProviders/google.svg",
		backgroundColor: "#fff",
		color: "black"
	},
	{
		provider: appleProvider,
		name: "Apple",
		icon: "resources/loginProviders/apple.svg",
		backgroundColor: "black",
		color: "white",
		iconFilter: "invert(1)" //Invert logo for dark background
	},
	// {
	// 	provider: facebookProvider,
	// 	name: "Facebook",
	// 	icon: "resources/loginProviders/facebook.svg",
	// 	backgroundColor: "#1a77f2",
	// 	color: "white",
	// },
	{
		provider: EMAIL_PROVIDER,
		name: "Email",
		icon: "resources/loginProviders/email.svg",
		backgroundColor: "firebrick",
		color: "white",
		iconFilter: "invert(1)" //Invert logo for dark background
	},
]

window.providers = providers



//We JUST need a password form for changing passwords.
//We need the full flow for other stuff.

class EmailLoginInterface {
	container = document.createElement("div") //Container for the login interface

	emailEntryForm = document.createElement("form") //Form used to choose the email being used.

	constructor() {
		this.container.classList.add("emailLoginInterface")

		this.emailEntryForm.addEventListener("submit", (function(e) {
			e.preventDefault()
			history.replaceState(null, "") //Emulate a navigation.
			this.continueWithEmail(emailInput.value)
		}).bind(this))

		let emailInput = document.createElement("input")
		emailInput.type = "email"
		emailInput.placeholder = "Enter Email..."
		emailInput.autocomplete = "email"
		// emailInput.addEventListener("keyup", (function(keyEvent) {
		// 	if (keyEvent.key === "Enter") {
		// 		this.emailEntryForm.requestSubmit()
		// 	}
		// }).bind(this))

		this.emailEntryForm.appendChild(emailInput)


		let continueButton = document.createElement("button")
		continueButton.innerHTML = "Continue"
		// continueButton.addEventListener("click", (function() {
		// 	this.emailEntryForm.requestSubmit()
		// }).bind(this))
		this.emailEntryForm.appendChild(continueButton)

		let cancelButton = document.createElement("button")
		cancelButton.innerHTML = "Cancel"
		cancelButton.addEventListener("click", (function() {
			this.container.remove()
		}).bind(this))
		this.emailEntryForm.appendChild(cancelButton)

		this.requestEmail()
	}

	clearContainer() {
		while (this.container.lastChild) {
			this.container.lastChild.remove()
		}
	}

	requestEmail() {
		this.clearContainer()
		this.container.appendChild(this.emailEntryForm)
	}

	async continueWithEmail(emailAddress) {
		let loginProviders;
		try {
			loginProviders = await fetchSignInMethodsForEmail(auth, emailAddress)
		}
		catch (e) {
			console.error(e)
			alert("Error with Firebase: " + e.message)
			return;
		}

		if (loginProviders.length > 0 && !loginProviders.includes("password")) {
			//The user cannot log in with email password.
			let message = `This account has no password. You must use a social login (previously used ${loginProviders.join(", ")})`
			alert(message)
			return
		}

		this.clearContainer()

		let loginSubmissionForm = document.createElement("form")

		this.container.appendChild(loginSubmissionForm)

		let emailDisplayInput = document.createElement("input")
		emailDisplayInput.type = "email"
		emailDisplayInput.autocomplete = "email"
		emailDisplayInput.value = emailAddress
		emailDisplayInput.setAttribute("readonly", true)
		loginSubmissionForm.appendChild(emailDisplayInput)

		let submitButton = document.createElement("button")

		let passwordUnit;
		if (loginProviders.includes("password")) {
			//Bring up the email password form.
			submitButton.innerText = "Log In"
			passwordUnit = new PasswordEntryBox({
				hidden: true,
				minLength: 6,
				autoComplete: "current-password",
				placeholder: "Enter Password..."
			})
			loginSubmissionForm.appendChild(passwordUnit.container)

			//Forgot Password Button
			let forgotPasswordButton = document.createElement("button")
			forgotPasswordButton.innerHTML = "Forgot Password"
			forgotPasswordButton.addEventListener("click", function() {
				sendPasswordResetEmail(auth, emailAddress)
				alert("Password Reset Email Sent")
			})
			loginSubmissionForm.appendChild(forgotPasswordButton)
		}
		else if (loginProviders.length === 0) {
			//Bring up the create password form
			submitButton.innerText = "Sign Up"
			passwordUnit = new PasswordConfirmingUnit({
				hidden: true,
				minLength: 6,
				autoComplete: "new-password"
			})
			loginSubmissionForm.appendChild(passwordUnit.container)
		}

		loginSubmissionForm.addEventListener("submit", (function(e) {
			console.warn("Submitted")
			e.preventDefault()
			history.replaceState(null, "") //Emulate a navigation.
			if (loginProviders.includes("password")) {
				handleFirebasePromise(signInWithEmailAndPassword(auth, emailAddress, passwordUnit.getValue()))
			}
			else {
				handleFirebasePromise(createUserWithEmailAndPassword(auth, emailAddress, passwordUnit.getValue()))
			}
		}))


		loginSubmissionForm.appendChild(submitButton)

		//Button to back out and change email
		let backButton = document.createElement("button")
		backButton.innerText = "Back"
		backButton.addEventListener("click", (function() {
			this.requestEmail()
		}).bind(this))
		loginSubmissionForm.appendChild(backButton)

	}
}


for (let providerDetails of providers) {
	let button = createButtonForProvider(providerDetails)
	signedInManager.appendChild(button)

	button.addEventListener("click", function() {
		if (providerDetails.provider !== EMAIL_PROVIDER) {
			signInWithPopup(auth, providerDetails.provider)
		}
		else {
			signedInManager.appendChild(new EmailLoginInterface().container)
		}
	})
}





window.auth = auth










auth.onAuthStateChanged(function(newAuth) {
	console.log(newAuth)
})






throw "Bye"

async function handleFirebasePromise(prom) {
	//Handle common Firebase error codes.
	try {
		let res = await prom
		console.log(res)
	}
	catch (e) {
		if (e.code === "auth/user-not-found") {
			alert("No user found with selected email. ")
		}
		else if (e.code === "auth/unauthorized-domain") {
			alert("Error from Auth Provider: Unauthorized Domain")
		}
		else if (e.code === "auth/weak-password") {
			alert("Password too weak - must be at least 6 characters. ")
		}
		else if (e.code === "auth/wrong-password") {
			alert("Incorrect Password. ")
		}
		else if (e.code === "auth/too-many-requests") {
			alert("Too many requests. You can reset your password or try again later. ")
		}
		else if (e.code === "auth/requires-recent-login") {
			//Use reauthenticateWithCredential??
			alert("You must sign in again before you can perform this action. ")
		}
		else {
			console.error(e)
			alert("Unknown Error from Auth Provider: " + e.message)
		}
	}
}

//












//
// function getCurrentUser() {
// 	return auth.currentUser
// }
//
// function getCurrentUserDetails() {
// 	//If we are not currently signed in, the fields will be undefined.
// 	//{email: string, displayName: string}
// 	let user = getCurrentUser()
// 	let userDetails = {}
// 	user?.providerData.forEach((profile) => {
// 		userDetails.displayName = userDetails.displayName ?? profile.displayName
// 		userDetails.email = userDetails.email ?? profile.email
// 	});
// 	return userDetails
// }
//
// function signOutCurrentUser() {
// 	return auth.signOut()
// }
//
// function deleteCurrentUserAccount() {
// 	return auth.currentUser.delete()
// }
//
//
// // const accounts = require("./src/firebase/accounts.js")
//
// let signedInManager = document.getElementById("signedInManager")
// let signedInStatusText = document.getElementById("signedInStatusText")
//
// let signOutButton = document.getElementById("signOutButton")
// let signInButton = document.getElementById("signInButton")
//
// let manageAccountButton = document.getElementById("manageAccountButton")
//
//
//
//
// const {loadFavorites, getFavoritesLastModified, writeFavorites, mergeFavoritesObjects} = require("./src/addToFavorites.js")
// const getSearchLink = require("./src/getSearchLink.js")
// let notificationsState = document.getElementById("notificationsState")
//
// function updateSignInStatus() {
// 	let user = getCurrentUser()
// 	console.warn(user)
// 	let text;
// 	if (user) {
// 		signInButton.style.display = "none"
// 		manageAccountButton.style.display = signOutButton.style.display = ""
// 		text = `Signed in as ${getCurrentUserDetails().email}. `
// 		signInOptionsContainer.style.display = "none"
// 	}
// 	else {
// 		manageAccountButton.style.display = signOutButton.style.display = "none"
// 		signInButton.style.display = ""
// 		text = `Sign in to Sync Favorites and Receive Notifications! `
// 		notificationsState.style.display = "none"
// 	}
// 	signedInStatusText.innerHTML = text
// }
//
// auth.onAuthStateChanged(updateSignInStatus)
//
//
//
//
//
// signOutButton.addEventListener("click", async function() {
// 	await signOutCurrentUser()
// })
//
// let deleteAccountButton = document.createElement("button")
// deleteAccountButton.innerHTML = "Delete Account"
//
// let passwordEntryField = document.createElement("input")
// passwordEntryField.placeholder = "Enter New Password..."
// passwordEntryField.type = "password"
//
// let setPassword = document.createElement("button")
//
// let togglePasswordVisibility = document.createElement("button")
// togglePasswordVisibility.innerHTML = "Show"
//
// let manageAccountWindow = document.createElement("div")
// manageAccountWindow.style.textAlign = "center"
// manageAccountWindow.innerHTML = "<h2>Manage Account</h2><p>Passwords are optional if you sign in with Google, Apple, or another service. Setting a password allows you to log in with your email and password as well. </p>"
// manageAccountWindow.appendChild(passwordEntryField)
// manageAccountWindow.appendChild(togglePasswordVisibility)
// manageAccountWindow.appendChild(document.createElement("br"))
// manageAccountWindow.appendChild(setPassword)
//
// let deleteAccountWarning = document.createElement("p")
// deleteAccountWarning.innerHTML = "Deleting your account will prevent syncing of your favorites data between devices. You can always create a new account later. "
//
// manageAccountWindow.appendChild(deleteAccountWarning)
// manageAccountWindow.appendChild(deleteAccountButton)
//
// manageAccountButton.addEventListener("click", function() {
// 	createModal(manageAccountWindow)
// })
//
// setPassword.addEventListener("click", async function() {
// 	if (passwordEntryField.value.length === 0) {return} //Firebase accepts a blank string as a password - though it then throws internal auth errors, so it may be equivalent to disabling passwords.
// 	await updatePassword(passwordEntryField.value)
// })
//
// togglePasswordVisibility.addEventListener("click", function() {
// 	if (passwordEntryField.type === "password") {
// 		togglePasswordVisibility.innerHTML = "Hide"
// 		passwordEntryField.type = "text"
// 	}
// 	else {
// 		togglePasswordVisibility.innerHTML = "Show"
// 		passwordEntryField.type = "password"
// 	}
// })
//
//
// function setPasswordInfo() {
// 	let hasPassword = getCurrentUser()?.providerData?.some((provider) => {return provider.providerId === "password"})
//
// 	if (hasPassword) {
// 		setPassword.innerHTML = "Update Password"
// 	}
// 	else {
// 		setPassword.innerHTML = "Set Password"
// 	}
// }
// setPasswordInfo()
// auth.onAuthStateChanged(setPasswordInfo)
//
//
//
//
//





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
