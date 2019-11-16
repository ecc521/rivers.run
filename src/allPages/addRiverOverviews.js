//Add the river-overview tags
try {
	//Add the modal styles
	styleSheet.insertRule(`
	.modal {
	display: none;
	position:fixed;
	z-index:100;
	padding-top: 5%;
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
	background-color: #fefefe;
	margin: auto;
	padding: 20px;
	border: 1px solid #888;
	width: 90%;
	margin-bottom:100px;
	margin-top:60px;
	}`,styleSheet.cssRules.length)

	styleSheet.insertRule(`
	.modal-close {
	color: #aaaaaa;
	float: right;
	font-size: 28px;
	font-weight: bold;
	}`,styleSheet.cssRules.length)

	styleSheet.insertRule(`
	.modal-close:hover, .modal-close:focus {
	color: #000;
	text-decoration: none;
	cursor: pointer;
	}`,styleSheet.cssRules.length)


	window.addDarkModeCSS(`
	.modal-content {
	background-color:black !important;
	color:#cfcfcf !important;
	`)


	//Create the modal element
	let overview_modal = document.createElement("div")
	overview_modal.className = "modal"

	let modal_content = document.createElement("div")
	modal_content.className = "modal-content"

	let overview_modal_close = document.createElement("span")
	overview_modal_close.className = "modal-close"
	overview_modal_close.innerHTML = "×"

	let overview_modal_text = document.createElement("p")

	overview_modal.appendChild(modal_content)
	modal_content.appendChild(overview_modal_close)
	modal_content.appendChild(overview_modal_text)

	document.body.appendChild(overview_modal)



	//Make the modal disappear when the close button is clicked, or when area outside content is clicked
	overview_modal_close.onclick = function() {
	    overview_modal.style.display = "none"
	}

	window.addEventListener("click", function(event) {
	    if (event.target === overview_modal) {
	        overview_modal.style.display = "none"
	    }
	})


	//Create the river-overview element
	class RiverOverview extends HTMLElement {
	    constructor() {
	        super();

	        function openOverview() {
	            let text = "This overview (" + this.innerHTML + ") is not available. This is likely due to a programming or data entry error"
	            if (window.overviews && window.overviews[this.innerText.trim()]) {
	                text = window.overviews[this.innerText.trim()]
	            }

	            overview_modal_text.innerHTML = text
	            overview_modal.style.display = "block"

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