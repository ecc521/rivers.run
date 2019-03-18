//This is extremely sensitive to the design of the CSS
//The @media query must be last rule in first stylesheet for this to work
let styleSheet = document.styleSheets[0]



//Determine if the user wants dark mode
//If prefers-color-scheme does not exist, the user needs to manually select dark/light mode
//If prefers-color-scheme does exist, we follow it, unless the user wants to override it

try {
    //Basic checking to make sure we don't mess with/error on pages that don't support dark mode
    if (styleSheet.cssRules[styleSheet.cssRules.length - 1] instanceof CSSMediaRule) {
        window.darkMode = localStorage.getItem("prefersDarkMode")
        //Convert string to boolean
        if (window.darkMode === "null") {window.darkMode = null}
        if (window.darkMode === "false") {window.darkMode = false}
        if (window.darkMode === "true") {window.darkMode = true}


        if (window.darkMode === null) {
            window.darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches
        }

        //Override browser to engage or disengage dark mode
        if (window.darkMode === true && window.matchMedia('(prefers-color-scheme: dark)').matches === false) {
            let cssText = styleSheet.cssRules[styleSheet.cssRules.length-1].cssText
            //Trim off the @media ... { and trailing }
            cssText = cssText.slice(cssText.indexOf("{") + 1, -1)
            let darkModeRules = cssText.split("\n")
            for (let i=0;i<darkModeRules.length;i++) {
                let rule = darkModeRules[i]
                if (rule.trim() === "") {continue}
                styleSheet.insertRule(rule, styleSheet.cssRules.length)
            }    
        }

        if (window.darkMode === false && window.matchMedia('(prefers-color-scheme: dark)').matches === true) {
            styleSheet.removeRule(styleSheet.cssRules.length - 1)
        }
		
		if (window.darkMode) {
			//Style links so that they are visible in dark mode
			
			//Unvisited Link
			styleSheet.insertRule("a:link {color: #3333FF;}", styleSheet.cssRules.length)
			//Visited link
			styleSheet.insertRule("a:visited {color: purple;}", styleSheet.cssRules.length)
			//Hovering over link
			styleSheet.insertRule("a:hover {color: green;}", styleSheet.cssRules.length)
			//Quick flash of color when link clicked
			styleSheet.insertRule("a:active {color: red;}", styleSheet.cssRules.length)
		}
    }
}
catch (e) {
    console.error(e)
}






//Make sure I don't hate the font
styleSheet.insertRule("html body {font-family: Arial, Helvetica, sans-serif}", styleSheet.cssRules.length)




//Crwate navigation bar
let topnav = document.createElement("div")
topnav.className = "topnav"

let items = []

let item1 = document.createElement("a")
item1.href = "/"
item1.innerHTML = "River Info"
items.push(item1)

let item2 = document.createElement("a")
item2.href = "about.html"
item2.innerHTML = "About"
items.push(item2)

let item3 = document.createElement("a")
item3.href = "FAQ.html"
item3.innerHTML = "FAQ"
items.push(item3)

let item4 = document.createElement("a")
item4.href = "settings.html"
item4.innerHTML = "Settings"
items.push(item4)


for (let i=0;i<items.length;i++) {
    let item = items[i]
    if (new URL(item.href).pathname === window.location.pathname) {
        item.className = "topnavcurrent"
    }
    topnav.appendChild(item)
}

document.body.insertBefore(topnav, document.body.firstChild)

styleSheet.insertRule(".topnav {overflow: hidden}", styleSheet.cssRules.length)
styleSheet.insertRule(".topnav {background-color: #24b9cc}", styleSheet.cssRules.length)
styleSheet.insertRule(".topnav {margin:0px}", styleSheet.cssRules.length)

styleSheet.insertRule(".topnav a {float: left}", styleSheet.cssRules.length)
styleSheet.insertRule(".topnav a {display: block}", styleSheet.cssRules.length)
styleSheet.insertRule(".topnav a {color: black}", styleSheet.cssRules.length)
styleSheet.insertRule(".topnav a {text-align: center}", styleSheet.cssRules.length)
styleSheet.insertRule(".topnav a {padding: 12px 13px}", styleSheet.cssRules.length)
//Not sure what the one below is for
styleSheet.insertRule(".topnav a {text-decoration: none}", styleSheet.cssRules.length)
styleSheet.insertRule(".topnav a {font-size: 17px}", styleSheet.cssRules.length)


styleSheet.insertRule(".topnav a:hover {background-color: #359daa}", styleSheet.cssRules.length)
styleSheet.insertRule(".topnavcurrent {background-color: #25d1a7}", styleSheet.cssRules.length)





