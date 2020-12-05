//Add the disclaimer and other legal stuff at the bottom.
try {
	let div = document.createElement("div")

	div.style.textAlign = "center"
	div.style.margin = "40px"

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
