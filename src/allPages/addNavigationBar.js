
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