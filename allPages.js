//This is extremely sensitive to the design of the CSS
//The @media query must be last rule in first stylesheet for this to work
let styleSheet = document.styleSheets[0]



//Determine if the user wants dark mode
//If prefers-color-scheme does not exist, the user needs to manually select dark/light mode
//If prefers-color-scheme does exist, we follow it, unless the user wants to override it

//Basic checking to make sure we don't mess with/error on pages that don't support dark mode
if (styleSheet.rules[styleSheet.rules.length - 1] instanceof CSSMediaRule) {
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
        let cssText = styleSheet.rules[styleSheet.rules.length-1].cssText
        //Trim off the @media ... { and trailing }
        cssText = cssText.slice(cssText.indexOf("{") + 1, -1)
        let darkModeRules = cssText.split("\n")
        for (let i=0;i<darkModeRules.length;i++) {
            let rule = darkModeRules[i]
            if (rule === "") {continue;}
            styleSheet.insertRule(rule, styleSheet.rules.length)
        }    
    }

    if (window.darkMode === false && window.matchMedia('(prefers-color-scheme: dark)').matches === true) {
        styleSheet.removeRule(styleSheet.rules.length - 1)
    }
}





//Make sure I don't hate the font
styleSheet.addRule("html body", "font-family: Arial, Helvetica, sans-serif", styleSheet.rules.length)




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

styleSheet.addRule(".topnav", "overflow: hidden", styleSheet.rules.length)
styleSheet.addRule(".topnav", "background-color: #24b9cc", styleSheet.rules.length)
styleSheet.addRule(".topnav", "margin:0px", styleSheet.rules.length)

styleSheet.addRule(".topnav a", "float: left", styleSheet.rules.length)
styleSheet.addRule(".topnav a", "display: block", styleSheet.rules.length)
styleSheet.addRule(".topnav a", "color: black", styleSheet.rules.length)
styleSheet.addRule(".topnav a", "text-align: center", styleSheet.rules.length)
styleSheet.addRule(".topnav a", "padding: 12px 13px", styleSheet.rules.length)
//Not sure what the one below is for
styleSheet.addRule(".topnav a", "text-decoration: none", styleSheet.rules.length)
styleSheet.addRule(".topnav a", "font-size: 17px", styleSheet.rules.length)


styleSheet.addRule(".topnav a:hover", "background-color: #359daa", styleSheet.rules.length - 1)
styleSheet.addRule(".topnavcurrent", "background-color: #25d1a7", styleSheet.rules.length - 1)





