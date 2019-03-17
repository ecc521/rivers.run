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
        console.log(item.href, window.location.pathname.slice(1))
        item.className = "topnavcurrent"
    }
    topnav.appendChild(item)
}

document.body.insertBefore(topnav, document.body.firstChild)

let styleSheet = document.styleSheets[0]
//If there are no rules in styleSheet, the index is negative, causing an error
styleSheet.addRule(".topnav", "overflow: hidden", Math.max(styleSheet.rules.length - 1, 0))
styleSheet.addRule(".topnav", "background-color: #24b9cc", styleSheet.rules.length - 1)
styleSheet.addRule(".topnav", "margin:8px", styleSheet.rules.length - 1)

styleSheet.addRule(".topnav a", "float: left", styleSheet.rules.length - 1)
styleSheet.addRule(".topnav a", "display: block", styleSheet.rules.length - 1)
styleSheet.addRule(".topnav a", "color: black", styleSheet.rules.length - 1)
styleSheet.addRule(".topnav a", "text-align: center", styleSheet.rules.length - 1)
styleSheet.addRule(".topnav a", "padding: 14px 16px", styleSheet.rules.length - 1)
//Not sure what the one below is for
styleSheet.addRule(".topnav a", "text-decoration: none", styleSheet.rules.length - 1)
styleSheet.addRule(".topnav a", "font-size: 17px", styleSheet.rules.length - 1)


styleSheet.addRule(".topnav a:hover", "background-color: #359daa", styleSheet.rules.length - 1)
styleSheet.addRule(".topnavcurrent", "background-color: #25d1a7", styleSheet.rules.length - 1)
