const {skillTranslations} = require("./skillTranslations.js")    
const addGraphs = require("./addGraphs.js").addGraphs
const {calculateAge} = require("./flowInfoCalculations.js")

//Code that runs when the button is clicked
    function riverbuttonClicked(button, river) {
		
        if (river.expanded === 0) {
            river.expanded = 1
            var div = document.createElement("div")

			div.innerHTML = ""

			//Only show a link if river.dam is a link. This allows rivers to be marked as dams and explainations to be put in the writeups.
			if (river.dam && river.dam.trim().startsWith("http")) {
                //Adding to div.innerHTML works, but logs CSP errors
                let link = document.createElement("a")
                link.target = "_blank"
                link.rel = "noopener"
                link.href = river.dam
                link.innerHTML = "This river has a dam. View information."
                div.appendChild(link)
				div.appendChild(document.createElement("br"))
				div.appendChild(document.createElement("br"))
            }

			div.innerHTML += river.writeup + "<br><br>"

			if (river.class && river.skill) {
				div.innerHTML += "This river is class " + river.class + " and is rated " + skillTranslations[river.skill] + ".<br>"
			}
			else if (river.class) {
				div.innerHTML += "This river is rated class " + river.class + ".<br>"
			}
			else if (river.skill) {
				div.innerHTML += "This river is rated " + skillTranslations[river.skill] + ".<br>"
			}


			if (river.averagegradient) {div.innerHTML += "Average gradient: " + river.averagegradient + " feet per mile.<br>"}
			if (river.maxgradient) {div.innerHTML += "Maximum gradient: " + river.maxgradient + " feet per mile.<br>"}

			if (river.plat && river.plon) {
                div.innerHTML += "Put-In GPS Coordinates: " + river.plat + ", " + river.plon + "<br>"
            }

            if (river.tlat && river.tlon) {
                div.innerHTML += "Take-Out GPS Coordinates: " + river.tlat + ", " + river.tlon + "<br>"
            }

			//Show the user the values being used for determining relative flow.
            let values = ["minrun", "lowflow", "midflow", "highflow", "maxrun"]
			let flowRange = document.createElement("p")
			flowRange.innerHTML = ""
            for (let i=0;i<values.length;i++) {
                let name = values[i]
                if (river[name] && !isNaN(parseFloat(river[name]))) {
                    flowRange.innerHTML += name + ":" + river[name] + " "
                }
            }
			if (flowRange.innerHTML !== "") {div.appendChild(flowRange)}

			//river.id should always be defined.
            div.appendChild(document.createElement("br"))
            let link = document.createElement("a")
            link.target = "_blank"
            link.rel = "noopener"
            link.href = "https://docs.google.com/document/d/" + river.id
            link.innerHTML = "Edit this river"
            div.appendChild(link)

            if (river.aw) {
                div.appendChild(document.createElement("br"))
                let link = document.createElement("a")
                link.target = "_blank"
                link.rel = "noopener"
                link.href = "https://www.americanwhitewater.org/content/River/detail/id/" + river.aw
                link.innerHTML = "View this river on American Whitewater"
                div.appendChild(link)
            }


			function addNotificationsSelector(usgsID) {
				let data = {
					id: river.id,
					name: river.name
				}

				let existing;
				let current;

				function resyncData() {
					existing = JSON.parse(localStorage.getItem("flownotifications") || "{}")
					current = existing[usgsID]
					if (current) {
						current = current[river.id]
					}
				}

				resyncData()

				console.log(current)

				//Container for the river alert creator.
				let container = document.createElement("div")
				container.className = "notificationsContainer"
				div.appendChild(container)

				//Describe what this does, and alert the user if their browser is unsupported.
				let description = document.createElement("p")
				container.appendChild(description)
				description.innerHTML = "Set alerts for " + ((usgsarray[usgsID] && usgsarray[usgsID].name) || "this river") + ":<br>"
				description.style.marginBottom = "0.5em" //Make the description closer to what it is describing...

				if (!("PushManager" in window) || !("Notification" in window) || !("serviceWorker" in navigator)) {
					description.innerHTML += "Your browser does not support flow alerts. You can try using Firefox, Chrome, Opera, or Edge, or Samsung Internet. On iOS, Apple provides no reasonable way to send web notifications, and uses their control of the App Store to prevent other browsers from supporting notifications. Rivers.run is working on email notifications to remedy this situation. "
					return;
				}

				let low = document.createElement("input")
				low.className = "minimum"
				low.type = "number"
				low.placeholder = "Minimum"
				low.value = (current && current.minimum) || ""

				let high = document.createElement("input")
				high.className = "maximum"
				high.placeholder = "Maximum"
				high.value = (current && current.maximum) || ""
				high.type = "number"

				let units = document.createElement("select")

				let blank = document.createElement("option")
				blank.selected = true
				blank.disabled = true
				blank.value = ""
				blank.innerHTML = "Units"
				units.appendChild(blank)

				let feet = document.createElement("option")
				feet.value = "ft"
				feet.innerHTML = "Feet"
				feet.pattern = "[0-9]"
				units.appendChild(feet)

				let cfs = document.createElement("option")
				cfs.value = "cfs"
				cfs.innerHTML = "CFS"
				cfs.pattern = "[0-9]"
				units.appendChild(cfs)

				units.value = (current && current.units) || ""

				let save = document.createElement("button")
				save.innerHTML = "Save"

				save.addEventListener("click", function() {
			        let lowValue = parseFloat(low.value)
					let highValue = parseFloat(high.value)

					data.minimum = lowValue
					data.maximum = highValue
					data.units = units.value

					if (isNaN(lowValue)) {
						alert("Minimum must be a number. Ex: 2.37, 3000")
						return
					}

					if (isNaN(highValue)) {
						alert("Maximum must be a number. Ex: 2.37, 3000")
						return
					}

					if (!units.value) {
						alert("Please specify whether feet or cfs should be used.")
						return;
					}

					resyncData() //Make sure we don't restore rivers that were removed while this river was open.

					existing[usgsID] = existing[usgsID] || {}
					existing[usgsID][river.id] = data

					localStorage.setItem("flownotifications", JSON.stringify(existing))

					window.open("notifications.html")
				})

				let manage = document.createElement("button")
				manage.innerHTML = "Manage Notifications"
				manage.addEventListener("click", function() {
					window.open("notifications.html")
				})

				container.appendChild(low)
				container.appendChild(high)
				container.appendChild(units)
				container.appendChild(save)
				container.appendChild(manage)
			}


            if (river.usgs) {
                //Adding to div.innerHTML works, but logs CSP errors
                div.appendChild(document.createElement("br"))
                let link = document.createElement("a")
                link.target = "_blank"
                link.rel = "noopener"
                link.href = "https://waterdata.usgs.gov/nwis/uv?site_no=" + river.usgs
                link.innerHTML = "View flow information on USGS"
                div.appendChild(link)
            }

			div.appendChild(document.createElement("br"))
			let disclaimer = document.createElement("a")
			disclaimer.href = "legal/DISCLAIMER.html"
			disclaimer.target = "_blank"
			disclaimer.innerHTML = "Rivers.run Content and Flow Disclaimer"
			div.appendChild(disclaimer)

			let addedUSGSDisclaimer = false
			let addedVirtualGaugeDisclaimer = false

			//Auxillary function
			//TODO: Show button to see code used by virtual gauge.
			function addUSGSGraphs(usgsID, relatedGauge) {

				let data = self.usgsarray[usgsID]
				if (!data) {return;}
				else {
					console.log("No flow data for " + usgsID)
				}

				//Alert the user if the data is (at least 2 hours) old
				let dataAge
                try {
                    dataAge = calculateAge(usgsID)
                }
                catch(e) {
                    console.error(e)
                    dataAge = null
                }
                let maxAge = 1000*60*60*2
                let oldDataWarning;
				if (dataAge > maxAge) {
					oldDataWarning = document.createElement("p")
					oldDataWarning.innerHTML = "Check the dates! This river data is more than " + Math.floor(dataAge/1000/60/60) + " hours old!"

					oldDataWarning.className = "oldDataWarning"
					div.appendChild(oldDataWarning)
				}

				function addDisclaimer(text) {
					let disclaimer = document.createElement("p")
					disclaimer.style.fontWeight = "bold"
					disclaimer.style.textAlign = "center"
					disclaimer.innerHTML = text
					return div.appendChild(disclaimer)
				}

				if (relatedGauge) {
					//Space out the gauges.
					div.appendChild(document.createElement("br"))
					div.appendChild(document.createElement("br"))
					div.appendChild(document.createElement("br"))
				}
				addNotificationsSelector(usgsID)

				console.time("Add Graphs")
				addGraphs(div, data)
				console.timeEnd("Add Graphs")
			}

            //USGS data may not have loaded yet
			if (self.usgsarray) {
				river.usgs && addUSGSGraphs(river.usgs)
				if (river.relatedusgs) {
					for (let i=0;i<river.relatedusgs.length;i++) {
						if (river.relatedusgs[i] === "") {continue;}
						addUSGSGraphs(river.relatedusgs[i], true)
					}
				}
			}


            div.style.padding = "6px"
            div.id = river.base + 2
            button.parentNode.insertBefore(div, button.nextSibling)
        }
        else {
            river.expanded = 0
            var elem = document.getElementById(river.base + 2)
            if (elem) {
                elem.parentNode.removeChild(elem)
            }

        }
    }
	
	module.exports = {
		riverbuttonClicked
	}