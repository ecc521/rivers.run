//This JavaScript file should run on all pages
//It defines global CSS rules, allows for forcing dark mode,
//defines the river-overview DOM element, and makes sure a viewport meta tag exists.

try {
	if (!window.customElements) {
		require("../node_modules/@webcomponents/custom-elements/custom-elements.min.js")
	}
}
catch(e) {console.error(e)}

try {
	//IE 11 Event and CustomEvent polyfill.
	(function () {
	  if (
	      typeof window.CustomEvent === "function" ||
	      // In Safari, typeof CustomEvent == 'object' but it otherwise works fine
	      window.CustomEvent.toString().indexOf('CustomEventConstructor')>-1
	  ) { return; }

	  function CustomEvent ( event, params ) {
	    params = params || { bubbles: false, cancelable: false, detail: undefined };
	    var evt = document.createEvent( 'CustomEvent' );
	    evt.initCustomEvent( event, params.bubbles, params.cancelable, params.detail );
	    return evt;
	   }

	  CustomEvent.prototype = window.Event.prototype;

	  window.CustomEvent = CustomEvent;
	  window.Event = CustomEvent
	})();
}
catch(e) {console.error(e)}

try {
	//IE doesn't define console unless devtools is open.
	if(!window.console) {window.console={}}

	['assert', 'clear', 'count', 'debug', 'dir', 'dirxml', 'error', 'exception', 'group', 'groupCollapsed', 'groupEnd', 'info', 'log', 'markTimeline', 'profile', 'profileEnd', 'table', 'time',
	'timeEnd', 'timeline', 'timelineEnd', 'timeStamp', 'trace', 'warn'].forEach((method) => {
		if (!window.console[method]) {
			//When the console is opened, all of the old messages should be dumped within 5 seconds.
			window.console[method] = function(...data) {
				let interval = setInterval(function() {
					if(window.console[method].toString().indexOf('[native code]') > -1 || window.console[method].toString().indexOf("__BROWSERTOOLS_CONSOLE_SAFEFUNC") > -1) {
						console.log(...data)
						window.console[method](...data)
						clearInterval(interval)
					}
				}, 5000)
			}
		}
	})
}
catch(e) {console.error(e)}

try {
	//IE11 Polyfill. The gaurd appears to be unneeded.
	if (!NodeList.prototype.forEach) {
		NodeList.prototype.forEach = Array.prototype.forEach;
	}
}
catch(e) {console.error(e)}

try {
	//IE 11 elem.remove() polyfill
	if (!('remove' in Element.prototype)) {
	    Element.prototype.remove = function() {
	        if (this.parentNode) {
	            this.parentNode.removeChild(this);
	        }
	    };
	}
}
catch(e) {
	console.error(e)
}

try {
	require("./reportErrors.js") //Collect errors.
}
catch(e) {console.error(e)}

try {
	require("./collectVisitorInformation.js") //Get site usage statistics.
}
catch(e) {console.error(e)}


//Create navigation bar

let root; //Where rivers.run is located
//This should allow rivers.run to the run from a directory or subdirectory.

try {
	let scripts = document.querySelectorAll("script")
	for (let i=0;i<scripts.length;i++) {
		//Find the script tag that is for allPages.js
		if (scripts[i].src.includes("allPages.js")) {
			//Since allPages.js is 2 directories in from the root, go back two directories to find the root.
			let components = scripts[i].src.split("/")
			components.pop()
			components.pop()
			root = components.join("/") + "/"
			window.root = root
			break;
		}
	}
}
catch(e) {
	console.error(e)
}

console.log(root)


try {
	if ('serviceWorker' in navigator) {
	    window.addEventListener('load', function() {
	        navigator.serviceWorker.register(root + 'sw.js');
	    });
	}
}
catch (e) {
	console.error(e)
}


//Add the favicon if it does not exist.
try {
 	if (!document.querySelector("link[rel='shortcut icon']")) {
		let sizes = [16,24,32,64,96,160,196]
		sizes.forEach((size) => {
			let favicon = document.createElement("link")
			favicon.rel = "shortcut icon"
			favicon.type = "image/png"
			favicon.sizes = size + "x" + size
			favicon.href = root + `resources/icons/${size}x${size}-Water-Drop.png`
			document.head.appendChild(favicon)
		})
	}
}
catch(e) {
    console.error(e)
}

//Add the web app manifest.
try {
 	if (!document.querySelector("link[rel='manifest']")) {
		let manifest = document.createElement("link")
		manifest.rel = "manifest"
		manifest.href = root + `manifest.json`
		document.head.appendChild(manifest)
	}
}
catch(e) {
    console.error(e)
}


//Add the viewport meta tag if it does not exist.
try {
	if (!document.querySelector("meta[name=viewport]")) {
        let meta = document.createElement("meta")
        meta.name = "viewport"
        meta.content = "width=device-width, initial-scale=1"
        document.head.appendChild(meta)
	}
}
catch(e) {
    console.error(e)
}


//This is extremely sensitive to the design of the CSS
//The @media query must be last rule in first stylesheet for this to work
let styleSheet;
try {
	styleSheet = document.styleSheets[0]

	if (!styleSheet) {
		console.warn("No stylesheet available. Without inline-style allowed, allPages.js may not work.")
	    let style = document.createElement("style")
		//Append to document.body if possible. Fallback to document.documentElement
	    ;(document.body && document.body.appendChild(style)) || document.documentElement.appendChild(style)
	    styleSheet = document.styleSheets[0]
	}
}
catch (e) {
	console.error(e)
}


//Determine if the user wants dark mode
//If prefers-color-scheme does not exist, the user needs to manually select dark/light mode
//If prefers-color-scheme does exist, we follow it, unless the user wants to override it

try {
	let mediaRule = styleSheet.cssRules[styleSheet.cssRules.length-1]
	if (!mediaRule) {mediaRule = styleSheet.cssRules[styleSheet.insertRule("@media all {}", styleSheet.cssRules.length)]} //If there isn't a rule, create a blank one.

	//Since we can't directly modify a CSSMediaRule, we will create a containing CSSMediaRule, then modify the media rule inside it.
	//This prevents us from having to find where the media rule is in the list
	let container = styleSheet.cssRules[styleSheet.insertRule("@media all {}", styleSheet.cssRules.length)]
	let mediaMatch = window.matchMedia('(prefers-color-scheme: dark)')

	function calculateDarkMode() {
		let startingMode = window.darkMode

        let darkMode = localStorage.getItem("prefersDarkMode")

        if (darkMode === null) {
            darkMode = mediaMatch.matches
        }

		if (darkMode === true || darkMode === "true") {window.darkMode = true}
		else {window.darkMode = false}

		if (window.darkMode !== startingMode) {
			window.dispatchEvent(new Event("colorSchemeChanged"))
		}
	}

		//Detect changes in color scheme
		mediaMatch.onchange = calculateDarkMode
		window.addEventListener("storage", calculateDarkMode)

		let isIE11 = !!window.MSInputMethodContext && !!document.documentMode;

		if (isIE11) {
			console.log("IE 11 does not support nested media queries. As such, reloads will be required to change color scheme.")
			try{calculateDarkMode()} catch(e) {}//This will set window.darkMode but error on the event dispatch.
			if (window.darkMode) {
				mediaRule = styleSheet.cssRules[styleSheet.insertRule(mediaRule.cssText.replace("not all", "all"), styleSheet.cssRules.length)]
			}
			else {
				mediaRule = styleSheet.cssRules[styleSheet.insertRule(mediaRule.cssText.replace("all", "not all"), styleSheet.cssRules.length)]
			}
		}
		else {
			mediaRule = container.cssRules[container.insertRule(mediaRule.cssText, container.cssRules.length)]
			styleSheet.deleteRule(styleSheet.cssRules.length-2)
		}

        //Style links so that they are visible in dark mode
        //Unvisited Link. Lightish blue.
        mediaRule.insertRule("a:link {color: rgb(100,150,255);}", mediaRule.cssRules.length)
        //Visited link. Pinkish-purple.
        mediaRule.insertRule("a:visited {color: rgb(200,0,255);}", mediaRule.cssRules.length)
        //Hovering over link
        mediaRule.insertRule("a:hover {color: green;}", mediaRule.cssRules.length)
        //Quick flash of color when link clicked
        mediaRule.insertRule("a:active {color: red;}", mediaRule.cssRules.length)

		//Enable or disable the media rule.
		window.addEventListener("colorSchemeChanged", function() {
			let cssText = mediaRule.cssText
			if (window.darkMode === true) {
				cssText = cssText.replace(/@media [^{]+{/, "@media all {")
			}
			else if (window.darkMode === false) {
				cssText = cssText.replace(/@media [^{]+{/, "@media not all {")
			}
			container.deleteRule(container.cssRules.length - 1)
			container.insertRule(cssText, container.cssRules.length)
			mediaRule = container.cssRules[container.cssRules.length - 1]
		})

		window.addDarkModeCSS = function(css) {
			mediaRule.insertRule(css, mediaRule.cssRules.length)
		}

		calculateDarkMode()
}
catch (e) {
    console.error(e)
}





try {
	//Make sure I don't hate the font
	styleSheet.insertRule("html body {font-family: Arial, Helvetica, sans-serif}", styleSheet.cssRules.length)
}
catch (e) {
	console.error(e)
}



//Create navigation bar
//TODO: Add alerts tab, potentially for larger screens only, and under a menu for smaller ones.
try {

	let topnav = document.createElement("div")
	topnav.className = "topnav"

	let items = []

	let item1 = document.createElement("a")
	item1.href = root
	item1.innerHTML = "River Info"
	items.push(item1)

	let item2 = document.createElement("a")
	item2.href = root + "about.html"
	item2.innerHTML = "About"
	items.push(item2)

	let item3 = document.createElement("a")
	item3.href = root + "FAQ.html"
	item3.innerHTML = "FAQ"
	items.push(item3)

	let item4 = document.createElement("a")
	item4.href = root + "settings.html"
	item4.innerHTML = "Settings"
	items.push(item4)

	let item5 = document.createElement("a")
	item5.href = root + "clubs.html"
	item5.innerHTML = "Clubs"
	items.push(item5)

	for (let i=0;i<items.length;i++) {
	    let link = items[i]
		//If the link is to the current page, highlight it.
	    if (link.href === window.location.origin + window.location.pathname) {
	        link.className = "topnavcurrent"
	    }
	    topnav.appendChild(link)
	}

	document.body.insertBefore(topnav, document.body.firstChild)


	styleSheet.insertRule(`
	.topnav {
	overflow: hidden;
	background-color: #24b9cc;
	margin:0px;
	}
	`, styleSheet.cssRules.length)


	styleSheet.insertRule(`
	.topnav a {
	float: left;
	display: block;
	color:black;
	text-align:center;
	padding: 12px 13px;
	text-decoration: none; /*Avoid the links being underlined*/
	font-size: 17px;
	}
	`, styleSheet.cssRules.length)


	//Make sure the header doesn't go onto multiple lines
	styleSheet.insertRule(`
	@media screen and (max-width: 386px) {
	.topnav a {
	padding: 10px 11px;
	font-size: 4.3vw;
	}
	}
	`, styleSheet.cssRules.length)


	styleSheet.insertRule(".topnav a:hover {background-color: #359daa}", styleSheet.cssRules.length)
	styleSheet.insertRule(".topnavcurrent {background-color: #25d1a7}", styleSheet.cssRules.length)

}
catch (e) {
	console.error(e)
}


//The remaining code is for the river-overview tags
try {
	//Add the modal styles
	styleSheet.insertRule(`
	.modal {
	display: none;
	position:fixed;
	z-index:2;
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
	    customElements.define('river-overview', RiverOverview);
	}
	catch (e) {
	    console.error(e)
	    //Alert firefox users about the flag
	    if (navigator.userAgent.includes("Firefox")) {
	        setTimeout(function() {
	            alert("In order to view area overviews, you will need a browser that supports DOM customElements. You may be able to enable customElements in about:config")
	        },4000)
	    }
	}
}
catch (e) {
	console.error(e)
}
