//This JavaScript file should run on all pages
//It defines global CSS rules, allows for forcing dark mode, and
//defines the river-overview DOM element


//This is extremely sensitive to the design of the CSS
//The @media query must be last rule in first stylesheet for this to work
let styleSheet = document.styleSheets[0]

if (!styleSheet) {
    console.warn("No stylesheet available. There must be an existing stylesheet in order for allPages.js to function properly without inline style allowed or without document.body.")
    let style = document.createElement("style")
    document.body.appendChild(style)
    styleSheet = document.styleSheets[0]
}


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

overview_modal.onclick = function() {
    this.style.display = "none"
}

	
//Create the river-overview element
class RiverOverview extends HTMLElement {
  constructor() {
	  super();

	  function openOverview() {
		  let text = "This overview (" + this.innerHTML + ") is not available. This is likely due to a programming or data entry error"
		  if (window.overviews && window.overviews[this.innerHTML]) {
		  	text = window.overviews[this.innerHTML]
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

customElements.define('river-overview', RiverOverview);
