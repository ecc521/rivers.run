window.colorBlindMode = false

function updateSettings() {
	let prior = window.colorBlindMode
	window.colorBlindMode = (localStorage.getItem("colorBlindMode") === "true")

	if (window.colorBlindMode) {
		document.body.classList.add("colorBlindMode")
	}
	else {
		document.body.classList.remove("colorBlindMode")
	}

	if (prior !== window.colorBlindMode) {
		window.dispatchEvent(new Event("colorSchemeChanged"))
	}
}

window.addEventListener("storage", updateSettings)
updateSettings()
