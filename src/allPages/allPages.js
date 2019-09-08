//This JavaScript file should run on all pages
//It defines global CSS rules, allows for forcing dark mode,
//defines the river-overview DOM element, and makes sure a viewport meta tag exists.

try {
	//IE11 polyfills
	//Note that there are more places that IE11 specific code is used.
	require("./IE11.js")
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
	        navigator.serviceWorker.register(root + 'sw.js');
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
