
let addGraphs = require("./addGraphs.js").addGraphs
let {calculateColor, calculateAge, calculateDirection} = require("./flowInfoCalculations.js")


let skillTranslations = {
	"?": "Skill Unknown",
	"FW": "Flat Water",
	"B": "Beginner",
	"N": "Novice",
	"N+": "Novice Plus",
	"LI-": "Low-Intermediate Minus",
	"LI": "Low-Intermediate",
	"LI+": "Low-Intermediate Plus",
	"I-": "Intermediate Minus",
	"I": "Intermediate",
	"I+": "Intermediate Plus",
	"HI-": "High-Intermediate Minus",
	"HI": "High-Intermediate",
	"HI+": "High-Intermediate Plus",
	"A-": "Advanced Minus",
	"A": "Advanced",
	"A+": "Advanced Plus",
	"E-": "Expert Minus",
	"E": "Expert",
	"E+": "Expert Plus"
}


function addHandlers(button, locate) {
	let river = ItemHolder[locate]

				button.addEventListener("mouseover", function(){
					button.style.backgroundColor =  calculateColor(river, {highlighted: true})
				})

				button.addEventListener("mouseout", function(){
					button.style.backgroundColor = calculateColor(river)
				})

				window.addEventListener("colorSchemeChanged", function() {
					if (river.dam) {
						button.style.background = createStripes()
					}
					button.style.backgroundColor = calculateColor(river)
				})

    //Code that runs when the button is clicked
    button.onclick = function () {
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

			if (river.id) {
				//river.id should always be defined.
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


			function addNotificationsSelector(usgsID) {
				//As of now, we will only use river names, not sections. Causes some overlap, but sections may change, not the name.
				let data = {}

				let existing;
				let current;

				function resyncData() {
					existing = JSON.parse(localStorage.getItem("flownotifications") || "{}")
					current = existing[usgsID]
					if (current) {
						current = current[river.name]
					}
				}

				resyncData()

				console.log(current)

				//Add the notification selector.
				let description = document.createElement("p")
				description.innerHTML = "Set alerts for " + ((usgsarray[usgsID] && usgsarray[usgsID].name) || "this river") + ":<br>"
				
				let low = document.createElement("input")
				low.type = "text"
				low.placeholder = "Minimum"
				low.style.fontSize = "16px"
				low.style.fontWeight = "bold"
				low.style.width = "80px"
				low.value = (current && current.minimum) || ""

				let high = document.createElement("input")
				high.placeholder = "Maximum"
				high.style.fontSize = "16px"
				high.style.fontWeight = "bold"
				high.style.width = "100px"
				high.value = (current && current.maximum) || ""
				high.type = "text"

				let units = document.createElement("select")
				units.style.fontSize = "16px"

				let blank = document.createElement("option")
				blank.selected = true
				blank.value = ""
				blank.innerHTML = "Units"
				units.appendChild(blank)

				let feet = document.createElement("option")
				feet.value = "ft"
				feet.innerHTML = "Feet"
				units.appendChild(feet)

				let cfs = document.createElement("option")
				cfs.value = "cfs"
				cfs.innerHTML = "CFS"
				units.appendChild(cfs)

				units.value = (current && current.units) || ""

				let save = document.createElement("button")
				save.style.fontSize = "16px"
				save.innerHTML = "Save"

				save.addEventListener("click", function() {
					let lowStr = low.value.trim()
			        let lowValue = parseFloat(lowStr)
			        let lowType = lowStr.match(/[^\d|.]+/) //Match a series of non-digits

			        if (lowType) {
			            lowType = lowType[0].trim().toLowerCase() //Use the first match
			        }

					let highStr = high.value.trim()
					let highValue = parseFloat(highStr)
					let highType = highStr.match(/[^\d|.]+/) //Match a series of non-digits

					if (highType) {
						highType = highType[0].trim().toLowerCase() //Use the first match
					}

					if (lowType === "feet") {lowType = "ft"}
					if (highType === "feet") {highType = "ft"}

					if (lowType === highType && !units.value) {
						if (highType === "ft") {
							units.value = "ft"
						}
						if (highType === "cfs") {
							units.value = "cfs"
						}
					}

					if (units.value && ((highType && highType !== units.value) || (lowType && lowType !== units.value))) {
						//If the units in the box do not match units.value, alert the user.
						alert("You have put units into the fields that do not match the selected units.")
						return;
					}

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
					existing[usgsID][river.name] = data

					localStorage.setItem("flownotifications", JSON.stringify(existing))

					window.open("notifications.html")
				})

				let manage = document.createElement("button")
				manage.innerHTML = "Manage Notifications"
				manage.style.fontSize = "16px"
				manage.addEventListener("click", function() {
					window.open("notifications.html")
				})

				let container = document.createElement("div")
				container.appendChild(description)
				container.appendChild(low)
				container.appendChild(high)
				container.appendChild(units)
				container.appendChild(save)
				container.appendChild(manage)
				div.appendChild(container)
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


			let addedUSGSDisclaimer = false
			let addedVirtualGaugeDisclaimer = false

			//Auxillary function
			//TODO: Show button to see code used by virtual gauge.
			function addUSGSGraphs(usgsID, relatedGauge) {

				addNotificationsSelector(usgsID) //TODO: Do this above every gauge, not just the main gauge.

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

                let data = self.usgsarray[usgsID]
                if (data) {

					function addDisclaimer(text) {
						let disclaimer = document.createElement("p")
	                    disclaimer.style.fontWeight = "bold"
	                    disclaimer.style.textAlign = "center"
	                    disclaimer.innerHTML = text
	                    return div.appendChild(disclaimer)
					}

					let isVirtualGauge = usgsID.startsWith("virtual:")

					//Add the disclaimer about USGS Gauges.
					if (!addedUSGSDisclaimer && !isVirtualGauge) {
						let disclaimer = addDisclaimer("Disclaimer: USGS Gauge data is provisional, and MIGHT be incorrect. Use at your own risk.")
						if (!oldDataWarning) {
	                        disclaimer.style.marginTop = "2em" //Space the disclaimer from the content above
	                    }
	                    else {
	                        disclaimer.style.marginTop = "0.5em" //Make the disclaimer closer to the warning
	                        oldDataWarning.style.marginBottom = "0.5em"
	                    }
						addedUSGSDisclaimer = true
					}

					//Add the disclaimer about virtual gauges.
					if (!addedVirtualGaugeDisclaimer && isVirtualGauge) {
						let disclaimer = addDisclaimer("Disclaimer: Virtual gauges are community provided, based off provisional data, and condition dependent. Use at your own risk.")
						if (!oldDataWarning) {
	                        disclaimer.style.marginTop = "2em" //Space the disclaimer from the content above
	                    }
	                    else {
	                        disclaimer.style.marginTop = "0.5em" //Make the disclaimer closer to the warning
	                        oldDataWarning.style.marginBottom = "0.5em"
	                    }
						addedUSGSDisclaimer = true
					}

					if (relatedGauge) {
						div.appendChild(document.createElement("br"))
						div.appendChild(document.createElement("br"))
						//Not really a disclaimer, but the styling works well.
						addDisclaimer("<br><br>The gauge below is related to this river, but is not the primary gauge for it")
					}
					console.time("Add Graphs")
                    addGraphs(div, data)
					console.timeEnd("Add Graphs")
                }
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





}


function createStripes(newColor = window.darkMode ? "rgba(256,256,256,0.2)":"rgba(170,170,170,0.33)", oldColor = "rgba(0,0,0,0)") {
		//If the river has a dam, stripe it.

		let background = "linear-gradient(150deg"

		for (let i=0;i<19;i++) {
			background += ", "
			background += i % 3 ? oldColor:newColor
		}

        background += ")"

		return background
}




function River(locate, event) {

    //Copies name, section, skill, rating, writeup, tags, usgs, plat,plon, tlat,tlon, aw, dam
    Object.assign(this, event)
    //tags needs to be a string. It can't be undefined
    this.tags = this.tags || ""
    //Convert the numeric value to the filename

	this.rating = parseFloat(this.rating)
	//Consider allowing ratings less than 1.
    if (this.rating < 1 || this.rating > 5 || isNaN(this.rating) || this.rating === undefined) {
        this.rating = "Error"
    }

    this.skill = this.skill || "?"

    this.base = "b" + locate
    this.expanded = 0
    this.index = locate

	if (this.relatedusgs) {
		try {
			this.relatedusgs = JSON.parse(this.relatedusgs)
		}
		catch(e) {console.warn(e);}
	}

    this.create = function (forceregenerate) {
        //Only create the button once - It's about 3 times faster.
        if (!this.finished || forceregenerate) {

            var button = document.createElement("button")
            button.id = this.base + 1

            function AddSpan(text) {
                let span = document.createElement("span")
                span.innerHTML = text
                span.className = "riverspan"
                button.appendChild(span)
                return span
            }

            AddSpan(this.name)
            AddSpan(this.section)

			function addClassSpan(river) {
				let riverclass = river.class || ""
				//Put a zero width space between a parantheses and the preceeding character so that the browser knows it can split the line.
				riverclass = riverclass.split("(").join("\u200b(")
				AddSpan(riverclass).classList.add("classspan")
			}

			function addSkillSpan(river) {
				//Add a setting for the tooltips.
				if (localStorage.getItem("skillTooltips") === "false") {
					AddSpan(river.skill).classList.add("skillspan")
				}
				else {
					let skillSpan = document.createElement("span")
					skillSpan.className = "riverspan skillspan tooltip"

					let tooltip = document.createElement("div")
					tooltip.innerHTML = river.skill
					tooltip.className = "tooltip"

					let tooltiptext = document.createElement("span")
					tooltiptext.innerHTML = skillTranslations[river.skill]
					tooltiptext.className = "tooltiptext"

					skillSpan.style.borderBottom = "none"

					tooltip.appendChild(tooltiptext)
					skillSpan.appendChild(tooltip)
					button.appendChild(skillSpan)
				}
			}

			if (localStorage.getItem("classOrSkill") === "class") {
				//Put class first so that it will show up if screen small.
				addClassSpan(this)
				addSkillSpan(this)
			}
			else {
				//Put skill first so that it will show up if screen small.
				addSkillSpan(this)
				addClassSpan(this)
			}

            //Star images for rating
            if (this.rating === "Error") {
				//Make sure that the span is the correct width, but inivisble.
                let span = AddSpan("☆☆☆☆☆")
				span.style.opacity = "0.2"
				span.classList.add("emptyStars")
            }
            else {
				let span = document.createElement("span")
                span.className = "riverspan"

				//We will use one empty span to set the width of the containing span.
				//We will use another empty span to overlay the full stars
                let spacer = document.createElement("span")
				spacer.className = "emptyStars"
				spacer.innerHTML = "☆☆☆☆☆"
				spacer.style.opacity = "0"
                span.appendChild(spacer)

                let empty = document.createElement("span")
				empty.className = "emptyStars"
				empty.innerHTML = "☆☆☆☆☆"
				empty.style.position = "absolute"
				empty.style.zIndex = "1" //Overlay the full stars
                span.appendChild(empty)

				let full = document.createElement("span")
				full.className = "fullStars"
				full.innerHTML = "★★★★★"
				full.style.width = this.rating*20 + "%"
                span.appendChild(full)

                button.appendChild(span)
            }

			//Load this.flow from usgsarray.
			let data = usgsarray[this.usgs]
			if (data) {
	            let cfs = data["00060"]
	            let feet = data["00065"]

	            //Prevent "TypeError: Can't Read Property 'values' of undefined"
	            if (cfs) {cfs = cfs.values}
	            if (feet) {feet = feet.values}


	            let latestCfs, latestFeet;
	            if (cfs) {
	                latestCfs = cfs[cfs.length - 1].value
	            }
	            if (feet) {
	                latestFeet = feet[feet.length - 1].value
	            }

	            this.feet = latestFeet
	            this.cfs = latestCfs

	            if (latestCfs && latestFeet) {
	                this.flow = latestCfs + "cfs " + latestFeet + "ft"
	            }
	            else if (latestCfs) {
	                this.flow = cfs[cfs.length - 1].value + " cfs"
	            }
	            else if (latestFeet) {
	                this.flow = feet[feet.length - 1].value + " ft"
	            }
			}

            if (this.flow) {
				let value = this.flow + calculateDirection(this.usgs)
				//If the user has color blind mode enabled, add river.running to one digit onto the flow data.
				if (localStorage.getItem("colorBlindMode") === "true" && calculateColor(this) && this.running !== undefined) {
					value += "(" + Math.round(this.running*10)/10 + ")"
				}
				value += this.dam ? "Dam" : ""
                AddSpan(value)
            }
			else if (this.dam) {AddSpan("Dam")}


            button.className = "riverbutton"
            //Add the click handler
            addHandlers(button, locate)

            //Store button for reuse later
            this.finished = button

        }

		this.updateExpansion = function() {
			//Do not use "this". If called from event listener on window it will fail.
			let river = ItemHolder[locate]
			//Make sure it is expanded. Otherwise, there is no need to update the expansion - and
			//updating the expansion can take a lot of time, expecially if it causes reflow.
			if (river.expanded) {
				river.finished.onclick()
				river.finished.onclick()
			}
		}

		window.addEventListener("colorSchemeChanged", this.updateExpansion)

		if (this.dam) {
			this.finished.style.background = createStripes()
		}
		if (calculateColor(this)) {
			this.finished.style.backgroundColor = calculateColor(this)
		}
		else if (this.dam) {
			//Background color gets overwrote by background. This class uses !important to prevent that.
			this.finished.classList.add("riverbuttonDam")
		}

        //Return finished button
        return this.finished

    }


    this.delete = function () {
        let river = ItemHolder[locate]
        function Remove(Code) {
            let ToDelete = document.getElementById(river.base + Code)
            if (ToDelete) {
                ToDelete.parentNode.removeChild(ToDelete)
            }
        }

        //Reset background color
        let reset = document.getElementById(river.base + 1)
        if (reset) {
            reset.style.backgroundColor = ""
        }

        Remove(2)
        Remove(1)

    }
}

export {
	River
}
