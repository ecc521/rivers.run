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
/******/ 	return __webpack_require__(__webpack_require__.s = 20);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */,
/* 1 */,
/* 2 */,
/* 3 */,
/* 4 */
/***/ (function(module, exports) {

function _loadURL(url) {
	//Return true if the request is successful. false otherwise
	return new Promise((resolve) => {
		if (navigator && navigator.sendBeacon && navigator.sendBeacon(url)) {
			resolve(true)
		}
		else if (window.fetch) {
			fetch(url, {mode: "no-cors"}).catch((e) => {
				console.warn(e) //Something didn't work out. Calling console.error causes another error to be reported, so
				//if this fails due to internet, we end up in an infinite loop.
				resolve(false)
			}).then((result) => {
				if (result && result.type === "opaque") {
					resolve(true)
				}
				else {
					resolve(false)
				}
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
			request.open("GET", url);
			request.send()
		}
	})
}


//Race conditions are possible, although unlikely to happen here (although not much breaks if they do)
//If the site is loaded offline, store the data and send it in the next time the site is loaded.
let urls = JSON.parse(localStorage.getItem("urlsToLoad") || "[]")
localStorage.setItem("urlsToLoad", JSON.stringify(urls))

for (let i=0;i<urls.length;i++) {
	let url = urls[i]
	_loadURL(url).then((result) => {
		//If the request succeeded, remove the URL from the queue
		if (result === true) {
			urls.splice(urls.indexOf(url), 1)
			localStorage.setItem("urlsToLoad", JSON.stringify(urls))
		}
	})
}

function loadURL(url) {
	if (window.location.hostname !== "rivers.run") {
		console.log("To avoid sending testing data to the server, refused to load " + url)
		return;
	}
	urls.push(url)
	localStorage.setItem("urlsToLoad", JSON.stringify(urls))
	let loader = _loadURL(url)
	loader.catch((e) => {
		console.warn(e)
	})
	loader.then((result) => {
		//If the request succeeded, remove the URL from the queue
		if (result === true) {
			urls.splice(urls.indexOf(url), 1)
			localStorage.setItem("urlsToLoad", JSON.stringify(urls))
		}
	})
}

module.exports = {
	loadURL
}


/***/ }),
/* 5 */
/***/ (function(module, exports, __webpack_require__) {

let previousVisits = (Number(localStorage.getItem("previousVisits")) || 0)
localStorage.setItem("previousVisits", previousVisits + 1)


//Data that we are collecting
//the useragent is last, because iOS is sonmetimes terminating the data sent after or part way through the useragent. Not sure why.
let data = {
	selectedColorScheme: localStorage.getItem("prefersDarkMode"), //Determining if you explicitly selected a color scheme
	usingDarkMode: window.darkMode, //Determining if you are using dark mode
	supportsDarkMode: window.matchMedia('(prefers-color-scheme: dark)').media !== "not all", //Determine if your browser supports automatic dark mode
	online: navigator.onLine, //Detect if the offline version of the site is being used
	hasServiceWorkers: 'serviceWorker' in navigator,//Detect if the browser supports serviceworkers
	timeStamp: Date.now(), //What time the page was visited at.
	referrer: document.referrer, //Used to detect how navigation is used
	url: window.location.href, //Used to detect how navigation is used
	previousVisits, //Used to detect if a visitor is unique
    userAgent: navigator.userAgent, //Information about the browser
}

//URL to submit the data to
let formURL = "https://docs.google.com/forms/d/e/1FAIpQLSfyTHeq0fp6-iofQacxfXcsSGjYymLJbLOPmlBBKBtttWvtcA/formResponse?ifq&entry.1198287313=" + JSON.stringify(data) + "&submit=Submit"
formURL = encodeURI(formURL)


__webpack_require__(4).loadURL(formURL)

module.exports = {data}


/***/ }),
/* 6 */,
/* 7 */,
/* 8 */,
/* 9 */,
/* 10 */,
/* 11 */,
/* 12 */,
/* 13 */,
/* 14 */,
/* 15 */,
/* 16 */,
/* 17 */,
/* 18 */,
/* 19 */,
/* 20 */
/***/ (function(module, exports, __webpack_require__) {

//This JavaScript file should run on all pages
//It defines global CSS rules, allows for forcing dark mode,
//defines the river-overview DOM element, and makes sure a viewport meta tag exists.

try {
	//IE11 polyfills
	//Note that there are more places that IE11 specific code is used.
	__webpack_require__(21)
}
catch(e) {
	console.error(e)
}

try {
	__webpack_require__(22) //Collect errors.
}
catch(e) {console.error(e)}


try {
	__webpack_require__(5) //Get site usage statistics.
}
catch(e) {console.error(e)}


//Define window.root (the site root)
try {
	__webpack_require__(23)
}
catch(e) {
	console.error(e)
}

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


try {
	__webpack_require__(24) //Add favicon, viewport meta, and manifest.
}
catch(e) {
	console.error(e)
}



try {
	window.styleSheet = document.styleSheets[0]

	if (!styleSheet) {
		console.warn("No stylesheet available. Without inline-style allowed, allPages.js may not work.")
	    let style = document.createElement("style")
		//Append to document.body if possible. Fallback to document.documentElement
	    ;(document.body && document.body.appendChild(style)) || document.documentElement.appendChild(style)
	    window.styleSheet = document.styleSheets[0]
	}
}
catch (e) {
	console.error(e)
}


try {
	//Add dark mode.
	//WARNING: It is imperative that this is the first thing to modify the stylesheet.
	__webpack_require__(25)
}
catch (e) {
	console.error(e)
}


try {
	//Make sure I don't hate the font
	styleSheet.insertRule("html, body {font-family: Arial, Helvetica, sans-serif}", styleSheet.cssRules.length)
}
catch (e) {
	console.error(e)
}

try {
	__webpack_require__(26)
}
catch (e) {
	console.error(e)
}


try {
	__webpack_require__(27)
}
catch(e) {
	console.error(e)
}




try {
	//Custom Events Polyfill. Used for river-overview tags.
	if (!window.customElements) {
		__webpack_require__(28)
	}
}
catch(e) {console.error(e)}

try {
	__webpack_require__(29)
}
catch (e) {
	console.error(e)
}


/***/ }),
/* 21 */
/***/ (function(module, exports) {

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
	//IE 11 elem.replaceWith() polyfill
	function ReplaceWithPolyfill() {
	  'use-strict'; // For safari, and IE > 10
	  var parent = this.parentNode, i = arguments.length, currentNode;
	  if (!parent) return;
	  if (!i) // if there are no arguments
		parent.removeChild(this);
	  while (i--) { // i-- decrements i and returns the value of i before the decrement
		currentNode = arguments[i];
		if (typeof currentNode !== 'object'){
		  currentNode = this.ownerDocument.createTextNode(currentNode);
		} else if (currentNode.parentNode){
		  currentNode.parentNode.removeChild(currentNode);
		}
		// the value of "i" below is after the decrement
		if (!i) // if currentNode is the first argument (currentNode === arguments[0])
		  parent.replaceChild(currentNode, this);
		else // if currentNode isn't the first
		  parent.insertBefore(currentNode, this.previousSibling);
	  }
	}
	if (!Element.prototype.replaceWith)
		Element.prototype.replaceWith = ReplaceWithPolyfill;
	if (!CharacterData.prototype.replaceWith)
		CharacterData.prototype.replaceWith = ReplaceWithPolyfill;
	if (!DocumentType.prototype.replaceWith) 
		DocumentType.prototype.replaceWith = ReplaceWithPolyfill;
	}
catch(e) {console.error(e)}

/***/ }),
/* 22 */
/***/ (function(module, exports, __webpack_require__) {

let loadURL = __webpack_require__(4).loadURL
let userInfo = __webpack_require__(5).data

function reportError(...error) {

	console.warn(...error)

	for (let i=0;i<error.length;i++) {
		//Make sure some non-enumerable properties are included.
		error[i] = JSON.parse(JSON.stringify(error[i], ["message", "arguments", "type", "name"]))
	}

	let data = {
		userInfo,
		error
	}

	let formURL = "https://docs.google.com/forms/d/e/1FAIpQLSd9h20lDBD4kTaNH8Ko6CAG9RGH1VCWwJKdfID_5RTTywTkFQ/formResponse?ifq&entry.1198287313=" + JSON.stringify(data) + "&submit=Submit"
	formURL = encodeURI(formURL)

	loadURL(formURL)
}


try {
	(function() {
		let _error = console.error;
		console.error = function(...data){
			_error(...data);
			reportError(...data);
		}
	}())
}
catch (e) {
	console.error(e) //PLEASE DON'T EVER RUN!
}


let listenersToAdd = [
	{
		target: window,
		name: "error"
	},
	{
		target: window,
		name: "unhandledrejection"
	},
	{
		target: document,
		name: "error"
	}
]


listenersToAdd.forEach((listener) => {
	try {
		listener.target.addEventListener(listener.name, reportError, {passive:true, capture:true},  true, true)
	}
	catch (e) {
		console.error(e) //PLEASE DON'T EVER RUN!
	}
})



/***/ }),
/* 23 */
/***/ (function(module, exports) {

//Get the site root of rivers.run
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
			window.root = components.join("/") + "/"
			break;
		}
	}
}
catch(e) {
	console.error(e)
}

/***/ }),
/* 24 */
/***/ (function(module, exports) {

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

/***/ }),
/* 25 */
/***/ (function(module, exports) {


//Determine if the user wants dark mode
//If prefers-color-scheme does not exist, the user needs to manually select dark/light mode
//If prefers-color-scheme does exist, we follow it, unless the user wants to override it

//This code is extremely sensitive to the design of the CSS
//The @media query must be last rule in first stylesheet for this to work.


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

/***/ }),
/* 26 */
/***/ (function(module, exports) {


//Create navigation bar
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
	
	let item6 = document.createElement("a")
	item6.href = root + "notifications.html"
	item6.innerHTML = "Alerts"
	items.push(item6)

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
	line-height: 17px;
	font-size: 17px;
	}
	`, styleSheet.cssRules.length)

	let shrinkNavbarAt = 380 //Pixels to shrink navbar at

	//Shrink the size of the header for smaller screens.
	styleSheet.insertRule(`
	@media screen and (max-width: ${shrinkNavbarAt}px) {
	.topnav a {
	padding: 10px 11px;
	line-height: 4.4vw;
	font-size: 4.4vw;
	}
	}
	`, styleSheet.cssRules.length)


	styleSheet.insertRule(".topnav a:hover {background-color: #359daa}", styleSheet.cssRules.length)
	styleSheet.insertRule(".topnavcurrent {background-color: #25d1a7}", styleSheet.cssRules.length)
	
	//Responsive menu to prevent overflow on smaller screens.
	let menu = document.createElement("a")
	menu.innerHTML = "☰" //TODO: Consider importing font, or something of the like. Trigam to Heaven icon.
	menu.addEventListener("click", function() {
		topnav.classList.toggle("expanded")
	})
	menu.className = "menu"
	topnav.appendChild(menu)	
	
	//Don't show dropdown by default.
	styleSheet.insertRule(`
	.topnav .menu {
	  display: none;
	}
	`, styleSheet.cssRules.length)
	
	let pxForMenu = 540 //How small must the screen be before the menu appears.
	
	styleSheet.insertRule(`
	@media screen and (max-width: ${pxForMenu}px) {
	  .topnav a.menu {
		float: right;
		display: block !important;
	  }
	}
	`, styleSheet.cssRules.length)
	
	
	//Display 5 navbar items at pxForMenu pixels
	styleSheet.insertRule(`
	@media screen and (max-width: ${pxForMenu}px) {
		.topnav a:nth-child(n+6) {display: none;}
	}
	`, styleSheet.cssRules.length)
		
	//Display 4 navbar items at 400 pixels
	styleSheet.insertRule(`
	@media screen and (max-width: 450px) {
		.topnav a:nth-child(n+5) {display: none;}
	}
	`, styleSheet.cssRules.length)
	
	//Display 4 navbar items at 400 pixels
	styleSheet.insertRule(`
	@media screen and (max-width: 400px) {
		.topnav a:nth-child(n+5) {display: none;}
	}
	`, styleSheet.cssRules.length)
	
	//Display 3 navbar items at 310 pixels
	styleSheet.insertRule(`
	@media screen and (max-width: 310px) {
		.topnav a:nth-child(n+4) {display: none;}
	}
	`, styleSheet.cssRules.length)
	
	
	styleSheet.insertRule(`
	@media screen and (max-width: ${pxForMenu}px) {
	  .topnav.expanded {position: relative;}
	  .topnav.expanded .menu {
		position: absolute;
		right: 0;
		top: 0;
	  }
	  .topnav.expanded a {
		float: none;
		display: block;
		text-align: left;
	  }
	}
	`, styleSheet.cssRules.length)
	
	
}
catch (e) {
	console.error(e)
}

/***/ }),
/* 27 */
/***/ (function(module, exports) {

//Add the disclaimer and other legal stuff at the bottom.
try {
	let div = document.createElement("div")
	
	div.style.textAlign = "center"
	div.style.margin = "40px"
	
	let content = document.createElement("p")
	div.appendChild(content)
	
	content.innerHTML = "Copyright © 2019, All Rights Reserved. "
	
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

/***/ }),
/* 28 */
/***/ (function(module, exports) {

(function(){
/*

 Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
 This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 Code distributed by Google as part of the polymer project is also
 subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
*/
'use strict';var aa=new Set("annotation-xml color-profile font-face font-face-src font-face-uri font-face-format font-face-name missing-glyph".split(" "));function g(a){var b=aa.has(a);a=/^[a-z][.0-9_a-z]*-[\-.0-9_a-z]*$/.test(a);return!b&&a}function l(a){var b=a.isConnected;if(void 0!==b)return b;for(;a&&!(a.__CE_isImportDocument||a instanceof Document);)a=a.parentNode||(window.ShadowRoot&&a instanceof ShadowRoot?a.host:void 0);return!(!a||!(a.__CE_isImportDocument||a instanceof Document))}
function n(a,b){for(;b&&b!==a&&!b.nextSibling;)b=b.parentNode;return b&&b!==a?b.nextSibling:null}
function p(a,b,d){d=void 0===d?new Set:d;for(var c=a;c;){if(c.nodeType===Node.ELEMENT_NODE){var e=c;b(e);var f=e.localName;if("link"===f&&"import"===e.getAttribute("rel")){c=e.import;if(c instanceof Node&&!d.has(c))for(d.add(c),c=c.firstChild;c;c=c.nextSibling)p(c,b,d);c=n(a,e);continue}else if("template"===f){c=n(a,e);continue}if(e=e.__CE_shadowRoot)for(e=e.firstChild;e;e=e.nextSibling)p(e,b,d)}c=c.firstChild?c.firstChild:n(a,c)}}function r(a,b,d){a[b]=d};function u(){this.a=new Map;this.g=new Map;this.c=[];this.f=[];this.b=!1}function ba(a,b,d){a.a.set(b,d);a.g.set(d.constructorFunction,d)}function ca(a,b){a.b=!0;a.c.push(b)}function da(a,b){a.b=!0;a.f.push(b)}function v(a,b){a.b&&p(b,function(b){return w(a,b)})}function w(a,b){if(a.b&&!b.__CE_patched){b.__CE_patched=!0;for(var d=0;d<a.c.length;d++)a.c[d](b);for(d=0;d<a.f.length;d++)a.f[d](b)}}
function x(a,b){var d=[];p(b,function(b){return d.push(b)});for(b=0;b<d.length;b++){var c=d[b];1===c.__CE_state?a.connectedCallback(c):y(a,c)}}function z(a,b){var d=[];p(b,function(b){return d.push(b)});for(b=0;b<d.length;b++){var c=d[b];1===c.__CE_state&&a.disconnectedCallback(c)}}
function A(a,b,d){d=void 0===d?{}:d;var c=d.u||new Set,e=d.i||function(b){return y(a,b)},f=[];p(b,function(b){if("link"===b.localName&&"import"===b.getAttribute("rel")){var d=b.import;d instanceof Node&&(d.__CE_isImportDocument=!0,d.__CE_hasRegistry=!0);d&&"complete"===d.readyState?d.__CE_documentLoadHandled=!0:b.addEventListener("load",function(){var d=b.import;if(!d.__CE_documentLoadHandled){d.__CE_documentLoadHandled=!0;var f=new Set(c);f.delete(d);A(a,d,{u:f,i:e})}})}else f.push(b)},c);if(a.b)for(b=
0;b<f.length;b++)w(a,f[b]);for(b=0;b<f.length;b++)e(f[b])}
function y(a,b){if(void 0===b.__CE_state){var d=b.ownerDocument;if(d.defaultView||d.__CE_isImportDocument&&d.__CE_hasRegistry)if(d=a.a.get(b.localName)){d.constructionStack.push(b);var c=d.constructorFunction;try{try{if(new c!==b)throw Error("The custom element constructor did not produce the element being upgraded.");}finally{d.constructionStack.pop()}}catch(t){throw b.__CE_state=2,t;}b.__CE_state=1;b.__CE_definition=d;if(d.attributeChangedCallback)for(d=d.observedAttributes,c=0;c<d.length;c++){var e=
d[c],f=b.getAttribute(e);null!==f&&a.attributeChangedCallback(b,e,null,f,null)}l(b)&&a.connectedCallback(b)}}}u.prototype.connectedCallback=function(a){var b=a.__CE_definition;b.connectedCallback&&b.connectedCallback.call(a)};u.prototype.disconnectedCallback=function(a){var b=a.__CE_definition;b.disconnectedCallback&&b.disconnectedCallback.call(a)};
u.prototype.attributeChangedCallback=function(a,b,d,c,e){var f=a.__CE_definition;f.attributeChangedCallback&&-1<f.observedAttributes.indexOf(b)&&f.attributeChangedCallback.call(a,b,d,c,e)};function B(a){var b=document;this.c=a;this.a=b;this.b=void 0;A(this.c,this.a);"loading"===this.a.readyState&&(this.b=new MutationObserver(this.f.bind(this)),this.b.observe(this.a,{childList:!0,subtree:!0}))}function C(a){a.b&&a.b.disconnect()}B.prototype.f=function(a){var b=this.a.readyState;"interactive"!==b&&"complete"!==b||C(this);for(b=0;b<a.length;b++)for(var d=a[b].addedNodes,c=0;c<d.length;c++)A(this.c,d[c])};function ea(){var a=this;this.b=this.a=void 0;this.c=new Promise(function(b){a.b=b;a.a&&b(a.a)})}function D(a){if(a.a)throw Error("Already resolved.");a.a=void 0;a.b&&a.b(void 0)};function E(a){this.c=!1;this.a=a;this.j=new Map;this.f=function(b){return b()};this.b=!1;this.g=[];this.o=new B(a)}
E.prototype.l=function(a,b){var d=this;if(!(b instanceof Function))throw new TypeError("Custom element constructors must be functions.");if(!g(a))throw new SyntaxError("The element name '"+a+"' is not valid.");if(this.a.a.get(a))throw Error("A custom element with name '"+a+"' has already been defined.");if(this.c)throw Error("A custom element is already being defined.");this.c=!0;try{var c=function(b){var a=e[b];if(void 0!==a&&!(a instanceof Function))throw Error("The '"+b+"' callback must be a function.");
return a},e=b.prototype;if(!(e instanceof Object))throw new TypeError("The custom element constructor's prototype is not an object.");var f=c("connectedCallback");var t=c("disconnectedCallback");var k=c("adoptedCallback");var h=c("attributeChangedCallback");var m=b.observedAttributes||[]}catch(q){return}finally{this.c=!1}b={localName:a,constructorFunction:b,connectedCallback:f,disconnectedCallback:t,adoptedCallback:k,attributeChangedCallback:h,observedAttributes:m,constructionStack:[]};ba(this.a,
a,b);this.g.push(b);this.b||(this.b=!0,this.f(function(){return fa(d)}))};E.prototype.i=function(a){A(this.a,a)};
function fa(a){if(!1!==a.b){a.b=!1;for(var b=a.g,d=[],c=new Map,e=0;e<b.length;e++)c.set(b[e].localName,[]);A(a.a,document,{i:function(b){if(void 0===b.__CE_state){var e=b.localName,f=c.get(e);f?f.push(b):a.a.a.get(e)&&d.push(b)}}});for(e=0;e<d.length;e++)y(a.a,d[e]);for(;0<b.length;){var f=b.shift();e=f.localName;f=c.get(f.localName);for(var t=0;t<f.length;t++)y(a.a,f[t]);(e=a.j.get(e))&&D(e)}}}E.prototype.get=function(a){if(a=this.a.a.get(a))return a.constructorFunction};
E.prototype.m=function(a){if(!g(a))return Promise.reject(new SyntaxError("'"+a+"' is not a valid custom element name."));var b=this.j.get(a);if(b)return b.c;b=new ea;this.j.set(a,b);this.a.a.get(a)&&!this.g.some(function(b){return b.localName===a})&&D(b);return b.c};E.prototype.s=function(a){C(this.o);var b=this.f;this.f=function(d){return a(function(){return b(d)})}};window.CustomElementRegistry=E;E.prototype.define=E.prototype.l;E.prototype.upgrade=E.prototype.i;E.prototype.get=E.prototype.get;
E.prototype.whenDefined=E.prototype.m;E.prototype.polyfillWrapFlushCallback=E.prototype.s;var F=window.Document.prototype.createElement,G=window.Document.prototype.createElementNS,ha=window.Document.prototype.importNode,ia=window.Document.prototype.prepend,ja=window.Document.prototype.append,ka=window.DocumentFragment.prototype.prepend,la=window.DocumentFragment.prototype.append,H=window.Node.prototype.cloneNode,I=window.Node.prototype.appendChild,J=window.Node.prototype.insertBefore,K=window.Node.prototype.removeChild,L=window.Node.prototype.replaceChild,M=Object.getOwnPropertyDescriptor(window.Node.prototype,
"textContent"),N=window.Element.prototype.attachShadow,O=Object.getOwnPropertyDescriptor(window.Element.prototype,"innerHTML"),P=window.Element.prototype.getAttribute,Q=window.Element.prototype.setAttribute,R=window.Element.prototype.removeAttribute,S=window.Element.prototype.getAttributeNS,T=window.Element.prototype.setAttributeNS,U=window.Element.prototype.removeAttributeNS,ma=window.Element.prototype.insertAdjacentElement,na=window.Element.prototype.insertAdjacentHTML,oa=window.Element.prototype.prepend,
pa=window.Element.prototype.append,V=window.Element.prototype.before,qa=window.Element.prototype.after,ra=window.Element.prototype.replaceWith,sa=window.Element.prototype.remove,ta=window.HTMLElement,W=Object.getOwnPropertyDescriptor(window.HTMLElement.prototype,"innerHTML"),ua=window.HTMLElement.prototype.insertAdjacentElement,va=window.HTMLElement.prototype.insertAdjacentHTML;var wa=new function(){};function xa(){var a=X;window.HTMLElement=function(){function b(){var b=this.constructor,c=a.g.get(b);if(!c)throw Error("The custom element being constructed was not registered with `customElements`.");var e=c.constructionStack;if(0===e.length)return e=F.call(document,c.localName),Object.setPrototypeOf(e,b.prototype),e.__CE_state=1,e.__CE_definition=c,w(a,e),e;c=e.length-1;var f=e[c];if(f===wa)throw Error("The HTMLElement constructor was either called reentrantly for this constructor or called multiple times.");
e[c]=wa;Object.setPrototypeOf(f,b.prototype);w(a,f);return f}b.prototype=ta.prototype;Object.defineProperty(b.prototype,"constructor",{writable:!0,configurable:!0,enumerable:!1,value:b});return b}()};function Y(a,b,d){function c(b){return function(d){for(var e=[],c=0;c<arguments.length;++c)e[c]=arguments[c];c=[];for(var f=[],m=0;m<e.length;m++){var q=e[m];q instanceof Element&&l(q)&&f.push(q);if(q instanceof DocumentFragment)for(q=q.firstChild;q;q=q.nextSibling)c.push(q);else c.push(q)}b.apply(this,e);for(e=0;e<f.length;e++)z(a,f[e]);if(l(this))for(e=0;e<c.length;e++)f=c[e],f instanceof Element&&x(a,f)}}void 0!==d.h&&(b.prepend=c(d.h));void 0!==d.append&&(b.append=c(d.append))};function ya(){var a=X;r(Document.prototype,"createElement",function(b){if(this.__CE_hasRegistry){var d=a.a.get(b);if(d)return new d.constructorFunction}b=F.call(this,b);w(a,b);return b});r(Document.prototype,"importNode",function(b,d){b=ha.call(this,b,!!d);this.__CE_hasRegistry?A(a,b):v(a,b);return b});r(Document.prototype,"createElementNS",function(b,d){if(this.__CE_hasRegistry&&(null===b||"http://www.w3.org/1999/xhtml"===b)){var c=a.a.get(d);if(c)return new c.constructorFunction}b=G.call(this,b,
d);w(a,b);return b});Y(a,Document.prototype,{h:ia,append:ja})};function za(){function a(a,c){Object.defineProperty(a,"textContent",{enumerable:c.enumerable,configurable:!0,get:c.get,set:function(a){if(this.nodeType===Node.TEXT_NODE)c.set.call(this,a);else{var d=void 0;if(this.firstChild){var e=this.childNodes,k=e.length;if(0<k&&l(this)){d=Array(k);for(var h=0;h<k;h++)d[h]=e[h]}}c.set.call(this,a);if(d)for(a=0;a<d.length;a++)z(b,d[a])}}})}var b=X;r(Node.prototype,"insertBefore",function(a,c){if(a instanceof DocumentFragment){var e=Array.prototype.slice.apply(a.childNodes);
a=J.call(this,a,c);if(l(this))for(c=0;c<e.length;c++)x(b,e[c]);return a}e=l(a);c=J.call(this,a,c);e&&z(b,a);l(this)&&x(b,a);return c});r(Node.prototype,"appendChild",function(a){if(a instanceof DocumentFragment){var c=Array.prototype.slice.apply(a.childNodes);a=I.call(this,a);if(l(this))for(var e=0;e<c.length;e++)x(b,c[e]);return a}c=l(a);e=I.call(this,a);c&&z(b,a);l(this)&&x(b,a);return e});r(Node.prototype,"cloneNode",function(a){a=H.call(this,!!a);this.ownerDocument.__CE_hasRegistry?A(b,a):v(b,
a);return a});r(Node.prototype,"removeChild",function(a){var c=l(a),e=K.call(this,a);c&&z(b,a);return e});r(Node.prototype,"replaceChild",function(a,c){if(a instanceof DocumentFragment){var e=Array.prototype.slice.apply(a.childNodes);a=L.call(this,a,c);if(l(this))for(z(b,c),c=0;c<e.length;c++)x(b,e[c]);return a}e=l(a);var f=L.call(this,a,c),d=l(this);d&&z(b,c);e&&z(b,a);d&&x(b,a);return f});M&&M.get?a(Node.prototype,M):ca(b,function(b){a(b,{enumerable:!0,configurable:!0,get:function(){for(var a=[],
b=0;b<this.childNodes.length;b++){var f=this.childNodes[b];f.nodeType!==Node.COMMENT_NODE&&a.push(f.textContent)}return a.join("")},set:function(a){for(;this.firstChild;)K.call(this,this.firstChild);null!=a&&""!==a&&I.call(this,document.createTextNode(a))}})})};function Aa(a){function b(b){return function(e){for(var c=[],d=0;d<arguments.length;++d)c[d]=arguments[d];d=[];for(var k=[],h=0;h<c.length;h++){var m=c[h];m instanceof Element&&l(m)&&k.push(m);if(m instanceof DocumentFragment)for(m=m.firstChild;m;m=m.nextSibling)d.push(m);else d.push(m)}b.apply(this,c);for(c=0;c<k.length;c++)z(a,k[c]);if(l(this))for(c=0;c<d.length;c++)k=d[c],k instanceof Element&&x(a,k)}}var d=Element.prototype;void 0!==V&&(d.before=b(V));void 0!==V&&(d.after=b(qa));void 0!==ra&&
r(d,"replaceWith",function(b){for(var e=[],c=0;c<arguments.length;++c)e[c]=arguments[c];c=[];for(var d=[],k=0;k<e.length;k++){var h=e[k];h instanceof Element&&l(h)&&d.push(h);if(h instanceof DocumentFragment)for(h=h.firstChild;h;h=h.nextSibling)c.push(h);else c.push(h)}k=l(this);ra.apply(this,e);for(e=0;e<d.length;e++)z(a,d[e]);if(k)for(z(a,this),e=0;e<c.length;e++)d=c[e],d instanceof Element&&x(a,d)});void 0!==sa&&r(d,"remove",function(){var b=l(this);sa.call(this);b&&z(a,this)})};function Ba(){function a(a,b){Object.defineProperty(a,"innerHTML",{enumerable:b.enumerable,configurable:!0,get:b.get,set:function(a){var e=this,d=void 0;l(this)&&(d=[],p(this,function(a){a!==e&&d.push(a)}));b.set.call(this,a);if(d)for(var f=0;f<d.length;f++){var t=d[f];1===t.__CE_state&&c.disconnectedCallback(t)}this.ownerDocument.__CE_hasRegistry?A(c,this):v(c,this);return a}})}function b(a,b){r(a,"insertAdjacentElement",function(a,e){var d=l(e);a=b.call(this,a,e);d&&z(c,e);l(a)&&x(c,e);return a})}
function d(a,b){function e(a,b){for(var e=[];a!==b;a=a.nextSibling)e.push(a);for(b=0;b<e.length;b++)A(c,e[b])}r(a,"insertAdjacentHTML",function(a,c){a=a.toLowerCase();if("beforebegin"===a){var d=this.previousSibling;b.call(this,a,c);e(d||this.parentNode.firstChild,this)}else if("afterbegin"===a)d=this.firstChild,b.call(this,a,c),e(this.firstChild,d);else if("beforeend"===a)d=this.lastChild,b.call(this,a,c),e(d||this.firstChild,null);else if("afterend"===a)d=this.nextSibling,b.call(this,a,c),e(this.nextSibling,
d);else throw new SyntaxError("The value provided ("+String(a)+") is not one of 'beforebegin', 'afterbegin', 'beforeend', or 'afterend'.");})}var c=X;N&&r(Element.prototype,"attachShadow",function(a){a=N.call(this,a);var b=c;if(b.b&&!a.__CE_patched){a.__CE_patched=!0;for(var e=0;e<b.c.length;e++)b.c[e](a)}return this.__CE_shadowRoot=a});O&&O.get?a(Element.prototype,O):W&&W.get?a(HTMLElement.prototype,W):da(c,function(b){a(b,{enumerable:!0,configurable:!0,get:function(){return H.call(this,!0).innerHTML},
set:function(a){var b="template"===this.localName,c=b?this.content:this,e=G.call(document,this.namespaceURI,this.localName);for(e.innerHTML=a;0<c.childNodes.length;)K.call(c,c.childNodes[0]);for(a=b?e.content:e;0<a.childNodes.length;)I.call(c,a.childNodes[0])}})});r(Element.prototype,"setAttribute",function(a,b){if(1!==this.__CE_state)return Q.call(this,a,b);var e=P.call(this,a);Q.call(this,a,b);b=P.call(this,a);c.attributeChangedCallback(this,a,e,b,null)});r(Element.prototype,"setAttributeNS",function(a,
b,d){if(1!==this.__CE_state)return T.call(this,a,b,d);var e=S.call(this,a,b);T.call(this,a,b,d);d=S.call(this,a,b);c.attributeChangedCallback(this,b,e,d,a)});r(Element.prototype,"removeAttribute",function(a){if(1!==this.__CE_state)return R.call(this,a);var b=P.call(this,a);R.call(this,a);null!==b&&c.attributeChangedCallback(this,a,b,null,null)});r(Element.prototype,"removeAttributeNS",function(a,b){if(1!==this.__CE_state)return U.call(this,a,b);var d=S.call(this,a,b);U.call(this,a,b);var e=S.call(this,
a,b);d!==e&&c.attributeChangedCallback(this,b,d,e,a)});ua?b(HTMLElement.prototype,ua):ma?b(Element.prototype,ma):console.warn("Custom Elements: `Element#insertAdjacentElement` was not patched.");va?d(HTMLElement.prototype,va):na?d(Element.prototype,na):console.warn("Custom Elements: `Element#insertAdjacentHTML` was not patched.");Y(c,Element.prototype,{h:oa,append:pa});Aa(c)};var Z=window.customElements;if(!Z||Z.forcePolyfill||"function"!=typeof Z.define||"function"!=typeof Z.get){var X=new u;xa();ya();Y(X,DocumentFragment.prototype,{h:ka,append:la});za();Ba();document.__CE_hasRegistry=!0;var customElements=new E(X);Object.defineProperty(window,"customElements",{configurable:!0,enumerable:!0,value:customElements})};
}).call(self);

//# sourceMappingURL=custom-elements.min.js.map


/***/ }),
/* 29 */
/***/ (function(module, exports) {

//Add the river-overview tags
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

/***/ })
/******/ ]);
//# sourceMappingURL=allPages.js.map