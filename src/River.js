//Used for converting flow values between feet and meters.
window.meterInFeet = 3.2808399
window.cubicMeterInFeet = meterInFeet**3

let {calculateColor, calculateDirection, calculateRelativeFlow} = require("./flowInfoCalculations.js")

const {skillTranslations} = require("./skillTranslations.js")
const {riverbuttonClicked} = require("./riverExpansion.js")

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
	//Creating the tooltips is expensive. Try creating them only when the user hovers.

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

	function getLatest(river, prop) {
		let data = gauges[river.gauge]
		if (data) {
			return data.getLatestReading(prop)?.[prop]
		}
	}

	Object.defineProperty(river, "feet", {
		get: function getLatestCFS() {
			return getLatest(river, "feet")
		}
	})

	Object.defineProperty(river, "cfs", {
		get: function getLatestCFS() {
			return getLatest(river, "cfs")
		}
	})

	Object.defineProperty(river, "meters", {
		get: function getLatestMeters() {
			if (!river.feet) {return undefined}
			return Math.round(river.feet / meterInFeet * 100) / 100 //Round to 2 digits
		}
	})

	Object.defineProperty(river, "cms", {
		get: function getLatestCubicMeters() {
			if (!river.cfs) {return undefined}
			return Math.round(river.cfs / cubicMeterInFeet * 100) / 100 //Round to 2 digits
		}
	})

	Object.defineProperty(river, "mainGaugeUnits", {
		get: function getMainGaugeUnits() {
			let data = gauges[this.gauge]
			if (data) {
				return data.units || "feet"
			}
		}
	})

	Object.defineProperty(river, "flow", {
		get: function getRiverFlow() {

			let volumeUnits, stageUnits;
			if (river.mainGaugeUnits === "feet") {
				stageUnits = "feet"
				volumeUnits = "cfs"

			}
			else if (river.mainGaugeUnits === "m") {
				stageUnits = "meters"
				volumeUnits = "cms"
			}

			let latestStage = river[stageUnits]
			let latestVolume = river[volumeUnits]

			if (stageUnits === "feet") {stageUnits = "ft"}
			if (stageUnits === "meters") {stageUnits = "m"}

			if ((latestVolume != null) && (latestStage != null)) {
				return latestVolume + volumeUnits + " " + latestStage + stageUnits
			}
			else if (latestVolume != null) {
				return latestVolume + " " + volumeUnits
			}
			else if (latestStage != null) {
				return latestStage + " " + stageUnits
			}
		}
	})
}

function addFlowSpan(river, button) {
	//If there is already a flowspan, get rid of it.
	let current = button.querySelector(".flowspan")
	if (current) {current.remove()}

	if (river.flow) {
		let value = river.flow + (calculateDirection(river.gauge) || "")
		//TODO: Show the text "Dam" if there is plenty of space to do so. Consider using a smaller icon instead.
		//value += this.dam ? "Dam" : ""
		AddSpan(value, button, "flowspan")
	}
	else if (river.dam) {AddSpan("Dam", button, "flowspan")}
}


function addFlowStyling(river, button) {
	if (river.dam) {
		button.classList.add("riverbuttonDam")
	}
	if (calculateColor(river.running)) {
		button.style.backgroundColor = calculateColor(river.running)
	}
}


function River(locate, event) {

	let river = this //Allow for incapsulation if this changes.

	//Copies name, section, skill, rating, writeup, tags, gauge, etc.
	Object.assign(this, event)
	//These need to be a string. They can't be undefined
	this.name = this.name || ""
	this.section = this.section || ""
	this.writeup = this.writeup || ""
	this.tags = this.tags || ""
	this.class = this.class || ""
	//Convert the numeric value to the filename

	this.access = this.access || []
	for (let i=0;i<this.access.length;i++) {
		let accessPoint = this.access[i]
		if (!accessPoint.label) {
			//Define label as non-emunerable so that it is not copied by writeupmaker.
			Object.defineProperty(accessPoint, "label", {
				enumerable: false,
				value: "A" + (i+1)
			})
		}
	}

	this.rating = parseFloat(this.rating)
	//Consider allowing ratings less than 1.
	if (this.rating < 1 || this.rating > 5 || isNaN(this.rating) || this.rating === undefined) {
		this.rating = "Error"
	}

	this.skill = (this.skill || "?").toUpperCase()

	if (!this.id) {
		this.id = this.gauge.toLowerCase() //toLowerCase to maintain backwards compatilibity with old "usgs:" + this.usgs system.
		this.isGauge = true
	}

	this.base = "b" + locate
	this.expanded = 0
	this.index = locate

	this.create = function (forceregenerate) {
		//Only create the button once - It's about 3 times faster.
		if (!this.finished || forceregenerate) {

			var button = document.createElement("button")
			button.id = this.base + 1

			if (this.isGauge) {
				button.classList.add("riverbuttonGauge")
			}

			AddSpan(this.name, button)
			AddSpan(this.section, button)

			//Put skill first so that it will show up if screen small.
			addSkillSpan(this, button)
			addClassSpan(this, button)

			//Star images for rating
			addRatingSpan(this, button)

			addFlowSpan(this, button)


			button.classList.add("riverbutton")

			button.addEventListener("click", function() {
				riverbuttonClicked(button, river)
			})

			window.addEventListener("colorSchemeChanged", function() {
				river.updateExpansion()
				river.finished.style.backgroundColor = calculateColor(river.running)
			})

			//Store button for reuse later
			this.finished = button

		}

		this.updateExpansion = function() {
			//Do not use "this". If called from event listener on window it will fail.
			//Make sure it is expanded. Otherwise, there is no need to update the expansion - and
			//updating the expansion can take a lot of time, expecially if it causes reflow.
			if (river.expanded) {
				river.finished.click()
				river.finished.click()
			}
		}

		addFlowStyling(this, this.finished)

		//Return finished button
		return this.finished

	}

	addFlowData(this) //Defines river.cfs, river.feet, and river.flow
	calculateRelativeFlow(this) //Defines river.running

	this.updateFlowData = function(noExpansion) {
		if (this.finished) {
			addFlowSpan(this, this.finished) //Update the flowspan if it exists.
			addFlowStyling(this, this.finished) //And make sure colors, etc, are updated.
		}
		if (this.updateExpansion && !noExpansion) {
			this.updateExpansion()
		}
	}

	this.updateFlowData()

	this.delete = function () {
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
