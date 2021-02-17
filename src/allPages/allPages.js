//This JavaScript file should run on all pages
//It defines global CSS rules, allows for forcing dark mode,
//defines the river-overview DOM element, and makes sure a viewport meta tag exists.

try {
	window.isAndroid = false
	if (document.referrer && document.referrer.includes("android-app://run.rivers.twa")) {
	  window.isAndroid = true
	}
}
catch (e) {console.error(e)}

if (window.Capacitor) {
	try {
		//Cover up the alert about using the https://rivers.run server. Might not be needed in production.
		for (let i=0;i<10;i++) {
			if (window.location.hash === "#f7s") {
				window.sessionFirstLaunch = true //App was just launched, not navigated to from another page.
				window.location.hash = "#"
			}
			if (window.sessionFirstLaunch) {
				Capacitor.Plugins.Toast.show({
					text: 'Welcome to rivers.run! Happy Paddling!',
					duration: "long"
				})
			}
 		}
	}
	catch (e) {console.error(e)}

	try {
		//Hide splash screen.
		Capacitor.Plugins.SplashScreen.hide()
	}
	catch(e) {console.error(e)}
}

require("./universalLinks.js")

try {
	//IE11 polyfills
	//Note that there are more places that IE11 specific code is used.
	//Rivers.run no longer supports IE11. These should be removed at some point once we can certify that they don't impact
	//any supported browsers as well.
	require("./IE11.js")
}
catch(e) {
	console.error(e)
}

//Define window.root (the site root)
try {
	require("./getSiteRoot.js")
}
catch(e) {
	console.error(e)
}

try {
	if ('serviceWorker' in navigator) {
	    window.addEventListener('load', function() {
	        navigator.serviceWorker.register(root + 'packagedsw.js');
	    });
	}
}
catch (e) {
	console.error(e)
}


try {
	require("./addTags.js") //Add favicon, viewport meta, and manifest.
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
	require("./addDarkMode.js")
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
	require("./addNavigationBar.js")
}
catch (e) {
	console.error(e)
}

if (window.Capacitor) {
	//This code may not need to be Capacitor specific.
	try {
		//setOverlaysWebView doesn't work on iOS.
		//Therefore, we must use CSS to work around the notch.
		//We also use an element to set notch color.
		//This elem goes above navbar, so it is here.
		let elem = document.createElement("div")
		elem.id = "iosStatusBarBackground"
		document.documentElement.prepend(elem)

		//Navigation bar background color.
		styleSheet.insertRule(`
		#iosStatusBarBackground {
		  display: none;
		  background-color: rgb(36, 185, 204);
		}`)

		//Cover up anything covering up the battery and clock, etc.
		styleSheet.insertRule(`
			@media (orientation: portrait) {
				#iosStatusBarBackground {
					display: block;
					position: sticky;
					top: 0;
					height: env(safe-area-inset-top);
				}
			}
	`, styleSheet.cssRules.length)
	}
	catch(e) {console.error(e)}
}

try {

	styleSheet.insertRule(`#externalAppStoresDiv {
		text-align: center;
		margin-top: 40px;
}`, styleSheet.cssRules.length)


	styleSheet.insertRule(`#externalAppStoresDiv * {
	height: 70px;
	max-width: 90%;
	margin: 0px 8px 16px 8px;
}`, styleSheet.cssRules.length)

	require("./addExternalAppStores.js")
}
catch (e) {console.error(e)}

try {
	require("./addLegalStuff.js")
}
catch(e) {
	console.error(e)
}




try {
	//Custom Events Polyfill. Used for river-overview tags.
	if (!window.customElements) {
		require("../../node_modules/@webcomponents/custom-elements/custom-elements.min.js")
	}
}
catch(e) {console.error(e)}

try {
	require("./addRiverOverviews.js")
}
catch (e) {
	console.error(e)
}
