const {skillTranslations} = require("./skillTranslations.js")
const addGraphs = require("./addGraphs.js").addGraphs
const {calculateAge} = require("./flowInfoCalculations.js")
const {createDeviceNotificationsWidget, createEmailNotificationsWidget} = require("./notificationsWidget.js")

//Code that runs when the button is clicked
    function riverbuttonClicked(button, river) {
        if (river.expanded === 0) {
            river.expanded = 1
            createExpansion(button, river)
        }
        else {
			//Delete the expansion.
            river.expanded = 0
            var elem = document.getElementById(river.base + 2)
            if (elem) {
                elem.parentNode.removeChild(elem)
            }

        }
    }




function createExpansion(button, river) {
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

			if (!river.isGauge) {
				//All rivers have an ID. All gauges do not.
				div.appendChild(document.createElement("br"))
				let link = document.createElement("a")
				link.target = "_blank"
				link.rel = "noopener"
				link.href = "https://docs.google.com/document/d/" + river.id
				link.innerHTML = "Edit this river"
				div.appendChild(link)
			}
            if (river.aw) {
                div.appendChild(document.createElement("br"))
                let link = document.createElement("a")
                link.target = "_blank"
                link.rel = "noopener"
                link.href = "https://www.americanwhitewater.org/content/River/detail/id/" + river.aw
                link.innerHTML = "View this river on American Whitewater"
                div.appendChild(link)
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
				if (!data) {console.log("No flow data for " + usgsID); return;}

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
				div.appendChild(createDeviceNotificationsWidget(river, usgsID))
				div.appendChild(createEmailNotificationsWidget(river, usgsID))

				console.time("Add Graphs")
				let graphs = addGraphs(data)
				div.appendChild(graphs)

				//Fetch comprehensive flow data, then update the graphs.
				//TODO: Add XMLHttpRequest fallback.
				if (!usgsarray[usgsID].full) {
					fetch("gaugeReadings/" + usgsID).then((response) => {
						response.json().then((newData) => {
							usgsarray[usgsID] = newData
							usgsarray[usgsID].full = true
							graphs.replaceWith(addGraphs(self.usgsarray[usgsID]))
							if (oldDataWarning) {oldDataWarning.remove()}
						})
					})
				}

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



	module.exports = {
		riverbuttonClicked
	}
