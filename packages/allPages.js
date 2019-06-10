/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, { enumerable: true, get: getter });
/******/ 		}
/******/ 	};
/******/
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = function(exports) {
/******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		}
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/
/******/ 	// create a fake namespace object
/******/ 	// mode & 1: value is a module id, require it
/******/ 	// mode & 2: merge all properties of value into the ns
/******/ 	// mode & 4: return value when already ns object
/******/ 	// mode & 8|1: behave like require
/******/ 	__webpack_require__.t = function(value, mode) {
/******/ 		if(mode & 1) value = __webpack_require__(value);
/******/ 		if(mode & 8) return value;
/******/ 		if((mode & 4) && typeof value === 'object' && value && value.__esModule) return value;
/******/ 		var ns = Object.create(null);
/******/ 		__webpack_require__.r(ns);
/******/ 		Object.defineProperty(ns, 'default', { enumerable: true, value: value });
/******/ 		if(mode & 2 && typeof value != 'string') for(var key in value) __webpack_require__.d(ns, key, function(key) { return value[key]; }.bind(null, key));
/******/ 		return ns;
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 10);
/******/ })
/************************************************************************/
/******/ ({

/***/ 10:
/***/ (function(module, exports, __webpack_require__) {

//This JavaScript file should run on all pages
//It defines global CSS rules, allows for forcing dark mode,
//defines the river-overview DOM element, and makes sure a viewport meta tag exists.

try {
	__webpack_require__(11) //Get site usage statistics
}
catch(e) {console.error(e)}


if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('sw.js');
    });
}



//Add the favicon if it does not exist.
try {
    ;(function addFavicon() {
        let tags = document.head.querySelectorAll("link")
        for (let i=0;i<tags.length;i++) {
            if (tags[i].rel === "shortcut icon") {return} //There is already a favicon
        }
		let sizes = [16,24,32,64,96,160,196]
		sizes.forEach((size) => {
			let favicon = document.createElement("link")
			favicon.rel = "shortcut icon"
			favicon.type = "image/png"
			favicon.href = `resources/icons/${size}x${size}-Water-Drop.png`
			document.head.appendChild(favicon)
		})
    })()
}
catch(e) {
    console.error(e)
}



//Add the viewport meta tag if it does not exist.
try {
    ;(function addViewportMeta() {
        let tags = document.head.querySelectorAll("meta")
        for (let i=0;i<tags.length;i++) {
            if (tags[i].name = "viewport") {return} //There is already a viewmport meta tag
        }
        let meta = document.createElement("meta")
        meta.name = "viewport"
        meta.content = "width=device-width, initial-scale=1"
        document.head.appendChild(meta)
    })()
}
catch(e) {
    console.error(e)
}


//This is extremely sensitive to the design of the CSS
//The @media query must be last rule in first stylesheet for this to work
let styleSheet = document.styleSheets[0]

if (!styleSheet) {
    console.warn("No stylesheet available. There must be an existing stylesheet in order for allPages.js to function properly without inline style allowed or without document.documentElement (which may always exist).")
    let style = document.createElement("style")
    document.documentElement.appendChild(style)
    styleSheet = document.styleSheets[0]
}


//Determine if the user wants dark mode
//If prefers-color-scheme does not exist, the user needs to manually select dark/light mode
//If prefers-color-scheme does exist, we follow it, unless the user wants to override it

try {
	//Since we can't directly modify a CSSMediaRule, we will create a CSSMediaRule, then modify the media rule inside it.
	//This prevents us from having to remember where the media rule is in the list
	
	let container = styleSheet.cssRules[styleSheet.insertRule("@media all {}", styleSheet.cssRules.length)]
	let mediaMatch = window.matchMedia('(prefers-color-scheme: dark)')
	
	
	function calculateDarkMode() {
		let startingMode = window.darkMode
		
        let darkMode = localStorage.getItem("prefersDarkMode")

        if (darkMode === null) {
            darkMode = mediaMatch.matches
        }
		
	        //Convert string to boolean
		if (darkMode === "true") {window.darkMode = true}
		else {window.darkMode = false}	
		
		if (window.darkMode !== startingMode) {
			window.dispatchEvent(new Event("colorSchemeChanged"))
		}
	}
	
		//Detect changes in color scheme
		mediaMatch.onchange = calculateDarkMode
		window.addEventListener("storage", calculateDarkMode)
		
        let mediaRule = styleSheet.cssRules[styleSheet.cssRules.length-2]
		
		mediaRule = container.cssRules[container.insertRule(mediaRule.cssText, container.cssRules.length)]
		styleSheet.deleteRule(styleSheet.cssRules.length-2)
	
		
		
        //Style links so that they are visible in dark mode
        //Unvisited Link
        mediaRule.insertRule("a:link {color: #3333FF;}", mediaRule.cssRules.length)
        //Visited link
        mediaRule.insertRule("a:visited {color: purple;}", mediaRule.cssRules.length)
        //Hovering over link
        mediaRule.insertRule("a:hover {color: green;}", mediaRule.cssRules.length)
        //Quick flash of color when link clicked
        mediaRule.insertRule("a:active {color: red;}", mediaRule.cssRules.length)
		
		//Enable or disable the media rule.
		window.addEventListener("colorSchemeChanged", function() {
			let cssText = mediaRule.cssText
			if (window.darkMode === true) {
				cssText = cssText.replace(/@media [^{]+{/, "@media all {")
				container.deleteRule(container.cssRules.length - 1)
				container.insertRule(cssText, container.cssRules.length)
			}
			else if (window.darkMode === false) {
				cssText = cssText.replace(/@media [^{]+{/, "@media not all {")
				container.deleteRule(container.cssRules.length - 1)
				container.insertRule(cssText, container.cssRules.length)
			}
		})
		
		calculateDarkMode()
}
catch (e) {
    console.error(e)
}






//Make sure I don't hate the font
styleSheet.insertRule("html body {font-family: Arial, Helvetica, sans-serif}", styleSheet.cssRules.length)




//Create navigation bar
//Where rivers.run is located
//This should allow rivers.run to the run from a directory
let root = window.location.href
root = root.slice(0,root.lastIndexOf("/") + 1) //Add 1 so we don't clip trailing slash

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


let currentPage = window.location.href.slice(root.length)
if (currentPage.indexOf("#") !== -1) {
    currentPage = currentPage.slice(0, currentPage.indexOf("#"))
}


for (let i=0;i<items.length;i++) {
    let item = items[i]

    let target = item.href.slice(root.length)

    if (target === currentPage) {
        item.className = "topnavcurrent"
    }
    topnav.appendChild(item)
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







//The remaining code is for the river-overview tags

//Add the modal styles
styleSheet.insertRule(`
.modal {
display: none;
position:fixed;
z-index:1;
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


if (window.darkMode) {
    styleSheet.insertRule(`
.modal-content {
background-color:black;
color:#cfcfcf;
}`, styleSheet.cssRules.length)
}


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


        //Style so that text looks like a link/button
        this.style.cursor = "pointer"
        this.style.color = "rgb(51, 51, 255)"
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


/***/ }),

/***/ 11:
/***/ (function(module, exports) {

let previousVisits = (Number(localStorage.getItem("previousVisits")) || 0)
localStorage.setItem("previousVisits", previousVisits + 1)


//Data that we are collecting
let data = {
  userAgent: navigator.userAgent, //Information about the browser
	selectedColorScheme: localStorage.getItem("prefersDarkMode"), //Determining if you explicitly selected a color scheme
	usingDarkMode: window.darkMode, //Determining if you are using dark mode
	supportsDarkMode: window.matchMedia('(prefers-color-scheme: dark)').media !== "not all", //Determine if your browser supports automatic dark mode
	online: navigator.onLine, //Detect if the offline version of the site is being used
	hasServiceWorkers: 'serviceWorker' in navigator,//Detect if the browser supports serviceworkers
	timeStamp: Date.now(), //What time the page was visited at.
	referrer: document.referrer, //Used to detect how navigation is used
	previousVisits, //Used to detect if a visitor is unique
	url: window.location.href //Used to eliminate data sent due to development work
}

//URL to submit the data to
let formURL = "https://docs.google.com/forms/d/e/1FAIpQLSfyTHeq0fp6-iofQacxfXcsSGjYymLJbLOPmlBBKBtttWvtcA/formResponse?ifq&entry.1198287313=" + JSON.stringify(data) + "&submit=Submit"
formURL = encodeURI(formURL)

function loadURL() {
	//Return true if the request is successful. false otherwise
	return new Promise((resolve, reject) => {
		if (window.fetch) {
			let request = fetch(formURL, {mode: "no-cors"})
			request.then((result) => {
				if (result.type === "opaque") {
					resolve(true)
				}
        else {
          resolve(false)
        }
			})
			request.catch((e) => {
				console.error(e)
				resolve(false)
			})
		}
		else {

			//For browsers that don't support fetch
			//I have no way to actually assure that the request went through using
			//XMLHttpRequest, and merely assume that it went through if anything happens

      //Since browsers that support serviceWorker also support fetch, don't bother checking
      //that the user is online or trying to bypass cache/serviceWorker

			let request = new XMLHttpRequest()
				request.onload = function(event) {
					resolve(true)
				};
				request.onerror = function(event) {
					resolve(true)
				};
			request.open("GET", formURL);
			request.send()
		}
	})
}


//Race conditions are possible, although unlikely to happen here (although not much breaks if they do)
//If the site is loaded offline, store the data and send it in the next time the site is loaded.
let urls = JSON.parse(localStorage.getItem("urlsToLoad") || "[]")
urls.push(formURL)
localStorage.setItem("urlsToLoad", JSON.stringify(urls))

for (let i=0;i<urls.length;i++) {
	let url = urls[i]
	loadURL(url).then((result) => {
		//If the request succeeded, remove the URL from the queue
		if (result === true) {
			urls.splice(urls.indexOf(url), 1)
			localStorage.setItem("urlsToLoad", JSON.stringify(urls))
		}
	})
}


/***/ })

/******/ });
//# sourceMappingURL=allPages.js.map