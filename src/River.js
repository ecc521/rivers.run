let {calculateColor, calculateDirection, calculateRelativeFlow} = require("./flowInfoCalculations.js")

const {skillTranslations} = require("./skillTranslations.js")
const {riverbuttonClicked} = require("./riverExpansion.js")

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


	button.addEventListener("click", function() {
		riverbuttonClicked(button, river)
	})
}


function createStripes(newColor = window.darkMode ? "rgba(256,256,256,0.25)":"rgba(170,170,170,0.33)", oldColor = "rgba(0,0,0,0)") {
		//If the river has a dam, stripe it.

		let background = "linear-gradient(150deg"

		for (let i=0;i<19;i++) {
			background += ", "
			background += i % 3 ? oldColor:newColor
		}

        background += ")"

		return background
}



function AddSpan(text, elem, className) {
	let span = document.createElement("span")
    span.innerHTML = text
    span.className = "riverspan"
	if (className) {span.classList.add(className)}
	elem.appendChild(span)
    return span
}


			function addClassSpan(river, button) {
				let riverclass = river.class || ""
				//Put a zero width space between a parantheses and the preceeding character so that the browser knows it can split the line.
				//This helps make the browser correctly wrap class instead of overflowing.
				riverclass = riverclass.split("(").join("\u200b(")
				AddSpan(riverclass, button).classList.add("classspan")
			}

			function addSkillSpan(river, button) {
				//Check if the user has disabled tooltips.
				if (localStorage.getItem("skillTooltips") === "false") {
					AddSpan(river.skill, button).classList.add("skillspan")
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


function addRatingSpan(river, button) {
            //Star images for rating
            if (river.rating === "Error") {
				//Make sure that the span is the correct width, but inivisble.
                let span = AddSpan("☆☆☆☆☆", button)
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
				full.style.width = river.rating*20 + "%"
                span.appendChild(full)

                button.appendChild(span)
            }
}


function addFlowData(river) {
	try {
			//Load this.flow from usgsarray.
			let data = usgsarray[river.usgs]
			if (data) {
	            let cfs = data.cfs
	            let feet = data.feet

	            let latestCfs, latestFeet;
				try {
					if (cfs) {
						let latestCFSReading = cfs[cfs.length - 1]
						if (latestCFSReading) {
							//Equipment malfunctions, conversion table changes/creation, backwater at measurement site, etc, will result in USGS intentionally making values null.
							latestCfs = latestCFSReading.value
						}
					}
				}
				catch(e) {console.error(e);console.log(river.usgs)}
				try {
					if (feet) {
						let latestFeetReading = feet[feet.length - 1]
						if (latestFeetReading) {
							//Though issues are alot rarer than with CFS, equipment malfunctions can cause this to be null. 
							latestFeet = latestFeetReading.value
						}
					}
				}
				catch(e) {console.error(e);console.log(river.usgs)}

	            river.feet = latestFeet
	            river.cfs = latestCfs

	            if (latestCfs && latestFeet) {
	                river.flow = latestCfs + "cfs " + latestFeet + "ft"
	            }
	            else if (latestCfs) {
	                river.flow = cfs[cfs.length - 1].value + " cfs"
	            }
	            else if (latestFeet) {
	                river.flow = feet[feet.length - 1].value + " ft"
	            }
			}
	}
	catch(e) {console.error(e)}
}



function addFlowSpan(river, button) {
			//If there is already a flowspan, get rid of it.
			let current = button.querySelector(".flowspan")
			if (current) {current.remove()}
	
            if (river.flow) {
				let value = river.flow + (calculateDirection(river.usgs) || "")
				//If the user has color blind mode enabled, add river.running to one digit onto the flow data.
				if (localStorage.getItem("colorBlindMode") === "true" && calculateColor(river) && river.running !== undefined) {
					value += "(" + Math.round(river.running*10)/10 + ")"
				}
				//TODO: Show the text "Dam" if there is plenty of space to do so. Consider using a smaller icon instead.
				//value += this.dam ? "Dam" : ""
                AddSpan(value, button, "flowspan")
            }
			else if (river.dam) {AddSpan("Dam", button, "flowspan")}
}


function addFlowStyling(river, button) {
		if (river.dam) {
			button.style.background = createStripes()
		}
		if (calculateColor(river)) {
			button.style.backgroundColor = calculateColor(river)
		}
		else if (river.dam) {
			//Background color gets overwrote by background. This class uses !important to prevent that.
			button.classList.add("riverbuttonDam")
		}
}


function River(locate, event) {

    //Copies name, section, skill, rating, writeup, tags, usgs, plat,plon, tlat,tlon, aw, dam
    Object.assign(this, event)
    //tags and writeup need to be a string. They can't be undefined
    this.tags = this.tags || ""
    this.writeup = this.writeup || ""
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
			
			if (!this.id) {
				button.classList.add("riverbuttonGauge")
			}			

            AddSpan(this.name, button)
            AddSpan(this.section, button)


			if (localStorage.getItem("classOrSkill") === "class") {
				//Put class first so that it will show up if screen small.
				addClassSpan(this, button)
				addSkillSpan(this, button)
			}
			else {
				//Put skill first so that it will show up if screen small.
				addSkillSpan(this, button)
				addClassSpan(this, button)
			}

            //Star images for rating
            addRatingSpan(this, button)

			addFlowData(this)

			addFlowSpan(this, button)


            button.classList.add("riverbutton")
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
				river.finished.click()
				river.finished.click()
			}
		}

		window.addEventListener("colorSchemeChanged", this.updateExpansion) //TODO: This event listener should not remain forever.

		addFlowStyling(this, this.finished)

        //Return finished button
        return this.finished

    }
	
	
	this.updateFlowData = function() {
		addFlowData(this) //Update the flow information on the river object.
		if (this.finished) {
			addFlowSpan(this, this.finished) //Update the flowspan if it exists.
			addFlowStyling(this, this.finished) //And make sure colors, etc, are updated.
		}
		else {
			calculateRelativeFlow(this) //Adds the lowflow, relative flow, and other values to the object.
		}
		if (this.updateExpansion) {
			this.updateExpansion()
		}
	}

	this.updateFlowData()

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

module.exports = {
	River
}
