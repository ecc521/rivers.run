
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

		//TODO: Remove this at some point. 
		//Migrate to new property name.
		let oldPropTheme = localStorage.getItem("theme")
		if (oldPropTheme) {
			localStorage.setItem("userTheme", oldPropTheme)
			localStorage.removeItem("theme")
		}

        let darkMode = localStorage.getItem("userTheme")

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
