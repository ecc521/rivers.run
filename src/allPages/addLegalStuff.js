//Add the disclaimer and other legal stuff at the bottom.
try {
	let div = document.createElement("div")

	div.style.textAlign = "center"
	div.style.marginTop = "16px"

	let content = document.createElement("p")
	div.appendChild(content)

	content.innerHTML = "Copyright © 2020, All Rights Reserved. "

	let privacy = document.createElement("a")
	privacy.innerHTML = "Privacy Policy"
	privacy.target = "_blank"
	privacy.href = root + "legal/" + "Privacy Policy.html"
	content.appendChild(privacy)

	content.innerHTML += " "

	let terms = document.createElement("a")
	terms.innerHTML = "Terms of Service"
	terms.target = "_blank"
	terms.href = root + "legal/" + "Terms of Service.html"
	content.appendChild(terms)

	content.innerHTML += " "

	let disclaimer = document.createElement("a")
	disclaimer.innerHTML = "Disclaimer"
	disclaimer.target = "_blank"
	disclaimer.href = root + "legal/" + "DISCLAIMER.html"
	content.appendChild(disclaimer)

	document.documentElement.appendChild(div)
}
catch (e) {
	console.error(e)
}

//Add the disclaimer as a yellow bar at the bottom.
try {
	let storageKey = "hasSeenDisclaimer"
	if (!localStorage.getItem(storageKey)) {
		let disclaimer = document.createElement("div")
		disclaimer.innerHTML = "Paddle at your own risk."

		let link = document.createElement("a")
		link.innerHTML = "Read More"
		link.href = window.root + "legal/DISCLAIMER.html"
		link.target = "_blank"
		link.style.marginLeft = "4px"

		disclaimer.appendChild(link)

		disclaimer.style.position = "fixed"
		disclaimer.style.bottom = "0"
		disclaimer.style.zIndex = 60000 //Ridiculous. Must be on top.
		disclaimer.style.backgroundColor = "yellow"
		disclaimer.style.color = "black"
		disclaimer.style.width = "100vw"
		disclaimer.style.padding = "6px 0px 6px 0px" //Expand it on the top and bottom to make it more visible.
		disclaimer.style.display = "flex"
		disclaimer.style.alignItems = "center"
		disclaimer.style.justifyContent = "center"
		disclaimer.style.flexDirection = "row"

		let closeButton = document.createElement("button")
		closeButton.innerHTML = "✖️"
		closeButton.style.fontSize = "20px"
		closeButton.style.border = "none"
		closeButton.style.background = "none"
		closeButton.addEventListener("click", function() {
			localStorage.setItem(storageKey, true)
			disclaimer.remove()
		})

		disclaimer.appendChild(closeButton)

		document.body.appendChild(disclaimer)
	}
}
catch (e) {console.error(e)}
