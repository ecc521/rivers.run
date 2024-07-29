
//Create navigation bar
try {

	let topnav = document.createElement("div")
	topnav.className = "topnav"

	let items = []

	function addItem(text, src) {
		let item = document.createElement("a")
		item.innerHTML = text
		item.href = src
		items.push(item)
	}

	addItem("River Info", root)
	addItem("Map", root + "map.html")
	addItem("Favorites", root + "favorites.html")
	addItem("FAQ", root + "FAQ.html")
	addItem("Settings", root + "settings.html")
	addItem("Clubs", root + "clubs.html")

	addItem("Voice", root + "voice.html")

	if (!window.isNative) {
		addItem("About", root + "about.html")
	}

	for (let i=0;i<items.length;i++) {
	    let link = items[i]
		//If the link is to the current page, highlight it.
	    if (link.href === window.location.origin + window.location.pathname) {
	        link.className = "topnavcurrent"
	    }
	    topnav.appendChild(link)
	}

	document.documentElement.prepend(topnav)


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


	function widthForElemCount(elemCount = items.length) {
		let sum = 0;
		for (let i=0;i<Math.min(items.length, elemCount);i++) {
			sum += items[i].offsetWidth
		}
		let navbarPadding = window.innerWidth - topnav.offsetWidth
		return sum + navbarPadding
	}


	styleSheet.insertRule(`
	@media screen and (max-width: ${widthForElemCount()}px) {
	  .topnav a.menu {
		float: right;
		display: block !important;
	  }
	}
	`, styleSheet.cssRules.length)

	styleSheet.insertRule(`
	@media screen and (max-width: ${widthForElemCount()}px) {
	  .topnav.expanded {position: relative;}
	  .topnav.expanded .menu {
		position: absolute;
		right: 0;
		top: 0;
	  }
	  .topnav.expanded a {
		float: none;
		display: block !important;
		text-align: left;
	  }
	}
	`, styleSheet.cssRules.length)

	//Hide last item below widthForElemCount() pixels.
	styleSheet.insertRule(`
	@media screen and (max-width: ${widthForElemCount()}px) {
		.topnav a:nth-child(n+${items.length}) {display: none;}
	}
	`, styleSheet.cssRules.length)

	for (let i=items.length - 1;i>0;i--) {
		let menuWidth = 45 //TODO: Calculate this dynamically.
		let neededWidth = widthForElemCount(i) + menuWidth

		//Hide elements that do not fit below neededWidth
		styleSheet.insertRule(`
		@media screen and (max-width: ${neededWidth}px) {
			.topnav a:nth-child(n+${i}) {display: none;}
		}
		`, styleSheet.cssRules.length)
	}

}
catch (e) {
	console.error(e)
}
