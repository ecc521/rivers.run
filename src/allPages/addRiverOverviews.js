//Add the river-overview tags
try {
	//Add the modal styles
	styleSheet.insertRule(`
	.modal {
	display: flex;
	justify-content: center;
	align-items: center;
	position:fixed;
	z-index:100;
	left:0;
	top:0;
	width:100%;
	height: 100%;
	overflow:auto;
	background-color: rgba(0,0,0,0.4);
	}`, styleSheet.cssRules.length)

	styleSheet.insertRule(`
	.modal-content {
	color:black;
	max-height: 90vh;
	overflow: scroll;
	background-color: #fefefe;
	padding: 12px;
	border: 1px solid #888;
	width: calc(92% - 24px);
	}`,styleSheet.cssRules.length)

	styleSheet.insertRule(`
	.modal-close {
	color: #aaa;
	float: right;
	font-size: 28px;
	font-weight: bold;
	}`,styleSheet.cssRules.length)

	styleSheet.insertRule(`
	.modal-close:hover, .modal-close:focus {
	color: #888;
	text-decoration: none;
	cursor: pointer;
	}`,styleSheet.cssRules.length)


	window.addDarkModeCSS(`
	.modal-content {
	background-color:black !important;
	color:#cfcfcf !important;
	`)


	function createModal(content) {
		//Create the modal element
		let overview_modal = document.createElement("div")
		overview_modal.className = "modal"

		let modal_content = document.createElement("div")
		modal_content.className = "modal-content"

		let overview_modal_close = document.createElement("span")
		overview_modal_close.className = "modal-close"
		overview_modal_close.innerHTML = "×"

		overview_modal.appendChild(modal_content)
		modal_content.appendChild(overview_modal_close)
		modal_content.appendChild(content)

		document.body.appendChild(overview_modal)

		//Make the modal disappear when the close button is clicked, or when area outside content is clicked
		overview_modal_close.onclick = function() {
			overview_modal.remove()
		}

		window.addEventListener("click", function(event) {
			if (event.target === overview_modal) {
				overview_modal.remove()
			}
		})
	}
	window.createModal = createModal



	//Create the river-overview element
	class RiverOverview extends HTMLElement {
	    constructor() {
	        super();

	        async function openOverview() {
				let overviewName = this.innerText.trim().split("/").join("_")
				let request = await fetch(window.root + "overviews/" + overviewName)
				let response = await request.text()

				let iframe = document.createElement("iframe")
				// iframe.src = window.root + "overviews/" + overviewName
				iframe.srcdoc = response
				iframe.style.width = "100%"
				iframe.style.height = "82vh"
				iframe.style.border = "none"

				iframe.sandbox = "allow-same-origin allow-popups allow-popups-to-escape-sandbox"

				iframe.addEventListener("load", function() {
					let doc = iframe.contentDocument
					//Remove Google Docs maxWidth and padding
					doc.body.style.maxWidth = ""
					doc.body.style.padding = ""
					doc.body.querySelectorAll("a").forEach((elem) => {
						elem.target = "_blank"
					})

					//Invert the Google Doc, excluding images (double invert = normal).
					let darkModeInversionCSS = `
					body {
						background-color: black !important;
						filter: invert(1) !important;
					}
					img {
						filter: invert(1) !important;
					}
					`

					function setDarkMode() {
						let toDelete = doc.querySelector("#darkModeInversionCSS")
						if (toDelete) {toDelete.remove()}
						if (window.darkMode) {
							let elem = doc.createElement("style")
							elem.innerHTML = darkModeInversionCSS
							elem.id = "darkModeInversionCSS"
							doc.body.appendChild(elem)
						}
					}

					setDarkMode()
					window.addEventListener("colorSchemeChanged", setDarkMode)
				})

				createModal(iframe)
	        }

			let element = this

	        //Style so that text looks like a link/button
	        this.style.cursor = "pointer"
			function setColor() {
				if (window.darkMode) {
					element.style.color = "rgb(100, 150, 255)"
				}
				else {
					element.style.color = "rgb(51, 51, 255)"
				}
			}
			setColor()
			window.addEventListener("colorSchemeChanged", setColor)
	        this.style.textDecoration = "underline"

	        this.addEventListener("click", openOverview)

	    }
	}

	try {
		//We shouldn't have an issue here given the polyfill.
	    customElements.define('river-overview', RiverOverview);
	}
	catch (e) {
	    console.error(e)
	}
}
catch (e) {
	console.error(e)
}
