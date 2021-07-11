function fillParameters(options) {
	//Process options, filling in parameters with defaults.

	function prepareYAxis(y) {
		//If lines is a line, instead of an array of lines, put it in an array.
		if (typeof y !== "object") {
			console.warn("y1 was not an object. If y2 is not valid, errors may result. ")
			return undefined
		}
		if (!(y.lines instanceof Array)) {
			y.lines = [y.lines]
		}
		let totalPoints = 0; //If there are zero total points, we will delete this y value and warn the user.

		//Iterate through each point and find the minimum and maximum x and y values
		//TODO: Delete invalid points and lines without any points (after invalid points removed).
		y.lines.forEach((line) => {
			if (typeof line !== "object") {console.warn("Line is not an object. "); return}
			if (!(line.points instanceof Array)) {console.warn("line.points is not an array. "); return}

			line.xAlias = line.xAlias || "x"
			line.yAlias = line.yAlias || "y"
			line.forecastAlias = line.forecastAlias || "forecast"

			line.points.forEach((point) => {
				if (typeof point !== "object") {console.warn("Point is not an object. "); return}
				totalPoints++
				if (point[line.xAlias] < y.xmin || isNaN(y.xmin)) {y.xmin = Number(point[line.xAlias])}
				if (point[line.xAlias] > y.xmax || isNaN(y.xmax)) {y.xmax = Number(point[line.xAlias])}
				if (point[line.yAlias] < y.ymin || isNaN(y.ymin)) {y.ymin = Number(point[line.yAlias])}
				if (point[line.yAlias] > y.ymax || isNaN(y.ymax)) {y.ymax = Number(point[line.yAlias])}
			})
			function sortPoints(a,b) {return a[line.xAlias]-b[line.xAlias]} //Sort the points in a line, x values ascending
			line.points = line.points.sort(sortPoints)
		})

		if (isNaN(y.ymin) || isNaN(y.ymax) || isNaN(y.xmin) || isNaN(y.xmax)) {
			console.warn("A y-axis had no valid points, so is being removed. If there is not an axis with valid points, errors may result. ");
			return undefined;
		}

		//If the user didn't explicitly define the range for y2, use ymin and ymax
		if (isNaN(y.max)) {y.max = y.ymax}
		if (isNaN(y.min)) {y.min = y.ymin}
		if (y.min > y.max) {
			let temp = y.min
			y.min = y.max
			y.max = temp
			console.warn("y.min was greater than y.max. Swapped.")
		}
		y.range = y.max - y.min
		y.yrange = y.ymax - y.ymin
		y.xrange = y.xmax - y.xmin
		return y
	}

	options.y1 = prepareYAxis(options.y1)

	if (options.y2) {
		options.y2 = prepareYAxis(options.y2)
		if (!options.y1) {
			console.log("y1 was either invalid or not present. Subsituting y2. ")
			options.y1 = options.y2
			delete options.y2
		}
	}

	if (!options.y1) {throw "There is no valid y axis. "}

	//We don't allow for 2 x-axis.
	//The x1 parameter is optional, and used to set bounds other than those required to display all points.
	options.x1 = options.x1 || {}
	//If the user didn't provide a minimum or a maximum, fill it in using xmin and xmax on y1 and (possibly) y2.
	if (isNaN(options.x1.min)) {
		options.x1.min = options.y1.xmin;
		if (options.y2) {options.x1.min = Math.min(options.x1.min, options.y2.xmin)}
	}
	if (isNaN(options.x1.max)) {
		options.x1.max = options.y1.xmax;
		if (options.y2) {options.x1.max = Math.min(options.x1.max, options.y2.xmax)}
	}
	if (options.x1.min > options.x1.max) {
		let temp = options.x1.min
		options.x1.min = options.x1.max
		options.x1.max = temp
		console.warn("x1.min was greater than x1.max. Swapped.")
	}
	options.x1.range = options.x1.max - options.x1.min

	return options
}


function createGraph(options) {

	options = fillParameters(options)

	console.log(options)

	let lineCanvas = document.createElement("canvas")
	lineCanvas.width = options.width || 600
	lineCanvas.height = options.height || 400

	let ctx = lineCanvas.getContext("2d")

	if (options.backgroundColor) {
		let initial = ctx.fillStyle
		setLineColor(options.backgroundColor, undefined, "fillStyle")
		ctx.fillRect(0, 0, lineCanvas.width, lineCanvas.height)
		ctx.fillStyle = initial
	}

	ctx.lineWidth = options.lineWidth || Math.ceil(lineCanvas.width/75)
	ctx.lineJoin = options.lineJoin || "round" //Round will make sure that lines don't spike way through the point they stop at, unlike miter, a bad default.

	//Function to scale x and y values to their location on the graph.
	//TODO: Add logarithmic scale. Consider whether one axis should be able to be logarithmic while the other is linear.
	function getVerticalCoordinate(value, minvalue, range) {
		let offset = value-minvalue
		if (offset !== 0) {offset /= range}
		return lineCanvas.height - lineCanvas.height * offset
	}

	function getHorizontalCoordinate(value, minvalue, range) {
		let offset = value-minvalue
		if (offset !== 0) {offset /= range}
		return lineCanvas.width * offset
	}

	function goToPoint(x, y, min, range, move = false) {
		let horizontal = getHorizontalCoordinate(x, options.x1.min, options.x1.range)
		let vertical = getVerticalCoordinate(y, min, range || 0.01) //Pass 0.01 so that, if the range is zero, we will just display a line along the line bottom.

		if (move) {ctx.moveTo(horizontal, vertical)}
		else {
			ctx.lineTo(horizontal, vertical)
		}
	}

	let index = 0

	//Chrome has a bug where gradients are incorrectly applied if maxWidth is specified, and ends up being applied.
	//https://bugs.chromium.org/p/chromium/issues/detail?id=1030655&q=maxWidth&colspec=ID%20Pri%20M%20Stars%20ReleaseBlock%20Component%20Status%20Owner%20Summary%20OS%20Modified

	//We should consider using ctx.measureText(text).width - to work around this (although it is rare for the 6 digits neccessary for this bug to manifest to be present).
	function setLineColor(color, gradientOptions = {}, prop = "strokeStyle") {
		if (color) {
			if (typeof color === "string") {
				ctx[prop] = color
				return color
			}
			else if (color instanceof Array){
				//An array containing all the color stops that need to be added.
				//Ex. [[0,"#00FF00"],[1,"#0000FF"]] to go from green to blue.
				let y1 = gradientOptions.y1
				if (y1 == undefined) {y1 = lineCanvas.height}
	    		let gradient = ctx.createLinearGradient(gradientOptions.x1 || 0, y1, gradientOptions.x2 || 0, gradientOptions.y2 || 0); //Color stop 0 is bottom of graph. Color stop 1 is top of graph.
				color.forEach((colorStop) => {
					gradient.addColorStop(colorStop[0], colorStop[1])
				})
        		ctx[prop] = gradient;
				return gradient
			}
			else {
				throw "Unsupported color type " + color
			}
		}
	}

	let defaultForecastDashing = [1,3]

	options.y1.lines.forEach((line) => {
		setLineColor(line.color)
		ctx.beginPath()

		let forecastDashing = line.forecastDashing || defaultForecastDashing

		line.points.forEach((point, index) => {
			if (point[line.forecastAlias]) {
				ctx.setLineDash(forecastDashing)
			}
			else {ctx.setLineDash([])}

			goToPoint(point[line.xAlias], point[line.yAlias], options.y1.min, options.y1.range, (index === 0)?true:false)
			ctx.stroke()
		})
	})

	if (options.y2) {
		options.y2.lines.forEach((line) => {
			setLineColor(line.color)
			ctx.beginPath()

			let forecastDashing = line.forecastDashing || defaultForecastDashing

			line.points.forEach((point, index) => {
				if (point[line.forecastAlias]) {
					ctx.setLineDash(forecastDashing)
				}
				else {ctx.setLineDash([])}

				goToPoint(point[line.xAlias], point[line.yAlias], options.y2.min, options.y2.range, (index === 0)?true:false)
				ctx.stroke()
			})
		})
	}

	let finalCanvas = document.createElement("canvas")
	finalCanvas.width = lineCanvas.width
	finalCanvas.height = lineCanvas.height

	ctx = finalCanvas.getContext("2d")

	if (options.backgroundColor) {
		let initial = ctx.fillStyle
		setLineColor(options.backgroundColor, undefined, "fillStyle")
		ctx.fillRect(0, 0, lineCanvas.width, lineCanvas.height)
		ctx.fillStyle = initial
	}

	//0.01 padding to add space on right of scrubber (so that the user can scrub to the end!)
	let padding = options.padding || {top: 0, bottom:0.16, left: 0.1, right: options.y2?0.1:0.01} //Percentage of width and height on either side to be used for legend, etc.

	//TODO: Padding should be increased if needed to fit legend. Use ctx.measureText to do this.
	ctx.drawImage(lineCanvas, finalCanvas.width * padding.left, finalCanvas.height * padding.top, finalCanvas.width * (1 - padding.left - padding.right), finalCanvas.height * (1 - padding.top - padding.bottom))

	let textSize = Math.ceil(finalCanvas.height * padding.bottom / 4)
	if (options.graphNameColor) {
		ctx.fillStyle = options.graphNameColor
	}
	ctx.textAlign = "center";
	ctx.font = textSize * 1.15 + "px serif"
	ctx.fillText(options.name || "", finalCanvas.width*0.5, finalCanvas.height - textSize / 3.5, finalCanvas.width) //Center bottom

	ctx.font = "bold " + textSize + "px Arial"

	if (options.y1.textColor) {
		setLineColor(options.y1.textColor, {x1:textSize / 2, x2: textSize / 2 + ctx.measureText(options.y1.name || "").width, y1: 0, y2: 0}, "fillStyle")
	}
	ctx.textAlign = "left";
	ctx.fillText(options.y1.name || "", textSize / 2, finalCanvas.height*0.93, finalCanvas.width * 0.4) //Bottom left

	let y2Text = options.y2
	if (options.additionalText) {
		//additionalText adds the ability to place text where the y2 text would normally go.
		if (!y2Text) {
			y2Text = {
				name: options.additionalText.text,
				textColor: options.additionalText.color
			}
		}
		else {console.warn("Ignoring additionalText as there is a second y axis. ")}
	}

	if (y2Text) {
		if (y2Text.textColor) {
			setLineColor(y2Text.textColor, {x1:finalCanvas.width - textSize / 2, x2: finalCanvas.width - textSize / 2 + ctx.measureText(y2Text.name || "").width, y1: 0, y2: 0}, "fillStyle")
		}
		ctx.textAlign = "right";
		ctx.fillText(y2Text.name || "", finalCanvas.width - textSize / 2, finalCanvas.height*0.93, finalCanvas.width * 0.4) //Bottom right
	}


	//Draw x axis legend.
	//As of now, we will assume x-axis is composed of timeStamps.
	//TODO: Add more options for x-axis display.

	function formatDate(timeStamp) {
		//Ex: 19:49 12/4
		return timeStamp.getHours() + ":" + (timeStamp.getMinutes() < 10?"0":"") + timeStamp.getMinutes() + " " + (timeStamp.getMonth() + 1) + "/" + timeStamp.getDate()
	}

	if (options.x1.textColor) {
		ctx.fillStyle = options.x1.textColor
	}

	let xAxisMarkers = 5
	for (let i=0;i<xAxisMarkers;i++) {
		let value = formatDate(new Date(options.x1.min + options.x1.range * (i/(xAxisMarkers-1))))
		ctx.textAlign = "center"
		let rightPadding = padding.right
		if (rightPadding === 0) {rightPadding = (ctx.measureText("23:59 12/31").width * 0.51) / finalCanvas.width} //Make sure that we don't overflow on the right side when there is only one axis.
		ctx.fillText(value, (finalCanvas.width * padding.left) + (finalCanvas.width * (1 - padding.left - rightPadding)) * (i/(xAxisMarkers-1)), finalCanvas.height * (1-padding.bottom) + textSize)
	}


	//Height of actual line graph portion.
	let availHeight = (finalCanvas.height * (1-padding.top-padding.bottom))

	let maxFontSize = availHeight / 10 * 0.45 //Allow using up to 45% of distance between lines.
	let legendTextFontSize = Math.min(textSize, maxFontSize)
	ctx.font = "bold " + legendTextFontSize + "px Arial"


	function roundLegendValue(value, rangeVariation) {
		//Rounds a number on the legend to a reasonable number of digits.
		//Range variation is the distance between the minimum and maximum value that value has been over the graph.
		let maxDigits = 2
		let digits = Math.round(2-Math.log10(rangeVariation))
		digits = Math.max(0, Math.min(maxDigits, digits))
		if (value > 10000) {
			digits = 0
		}
		return Math.round(value * 10**digits)/10**digits
	}

	//Add the horizontal lines and values.
	let markerAmount = 10
	ctx.lineWidth = options.legendLineWidth || availHeight / 400
	for (let i=0;i<=markerAmount;i++) {
		let topOffset = finalCanvas.height * padding.top
		let vertical = (availHeight * i/markerAmount) + topOffset

		if (options.legendLineColor) {
			setLineColor(options.legendLineColor)
		}

		ctx.moveTo(0, vertical)
		ctx.lineTo(finalCanvas.width, vertical)

		//Add some seperation between value and line.
		vertical -= maxFontSize/8

		if (options.y1.legendTextColor) {
			setLineColor(options.y1.legendTextColor, undefined, "fillStyle")
		}

		ctx.textAlign = "left"
		if (i === 0) {
			ctx.fillText(roundLegendValue(options.y1.max, options.y1.yrange), legendTextFontSize / 4, maxFontSize, finalCanvas.width * padding.left - legendTextFontSize / 2)
		}
		let y1Value = roundLegendValue(options.y1.min + options.y1.yrange * ((markerAmount-i)/markerAmount), options.y1.yrange)

		ctx.fillText(y1Value, legendTextFontSize / 4, vertical, finalCanvas.width * padding.left - legendTextFontSize / 2)

		if (options.y2) {
			if (options.y2.legendTextColor) {
				setLineColor(options.y2.legendTextColor, undefined, "fillStyle")
			}
			ctx.textAlign = "left"
			if (i === 0) {
				ctx.fillText(roundLegendValue(options.y2.max, options.y2.yrange), (finalCanvas.width * (1 - padding.right)) + legendTextFontSize / 4, maxFontSize, finalCanvas.width * padding.right - legendTextFontSize / 2)
			}
			let y2Value = roundLegendValue(options.y2.min + options.y2.range * ((markerAmount-i)/markerAmount), options.y2.yrange)
			ctx.fillText(y2Value, (finalCanvas.width * (1 - padding.right)) + legendTextFontSize / 4, vertical, finalCanvas.width * padding.right - legendTextFontSize / 2)
		}
	}
	ctx.stroke()


	//Create the container and tooltip. 
	let graphContainerDiv = document.createElement("div")
	graphContainerDiv.appendChild(finalCanvas)

	let verticalLine = document.createElement("div")
	verticalLine.style.width = "2px"
	verticalLine.style.position = "absolute"
	verticalLine.style.backgroundColor = options.graphNameColor
	verticalLine.style.pointerEvents = "none"
	graphContainerDiv.appendChild(verticalLine)

	let tooltip = document.createElement("div")
	tooltip.style.position = "absolute"
	tooltip.style.color = options.graphNameColor
	tooltip.style.backgroundColor = options.backgroundColor
	tooltip.style.border = "1px solid " + options.graphNameColor
	tooltip.style.pointerEvents = "none"
	graphContainerDiv.appendChild(tooltip)

	function handleMoveEvent(event) {
		if (event.touches) {
			event.preventDefault() //I believe some old Android browsers need this for touch events.
			event = event.touches[0] //Use the first touch (should usually be the only touch as well)
		}

		let bounds = finalCanvas.getBoundingClientRect()

		//offsetX and offetY don't exist for touch events, so compute those.
		let xPos = event.clientX - bounds.left
		let yPos = event.clientY - bounds.top
		let width = bounds.width

		let percent = xPos/width

		//Clamp to edges.
		percent = Math.max(padding.left, percent)
		percent = Math.min(1 - padding.right, percent)

		let percentInElem = percent //Percentage of the way in the element to place.
		verticalLine.style.transform = "translateY(-" + bounds.height + "px)"
		verticalLine.style.height = bounds.height * (1 - padding.bottom) + "px"
		verticalLine.style.left = bounds.left + (bounds.width * percentInElem) + "px"

		//Tooltip always goes to left right now, as there must always be a legend there (and therefore it won't overflow)
		tooltip.style.transform = "translateY(-" + (bounds.height - yPos) + "px)"

		if (percent < 0.3) {
			tooltip.style.right = ""
			tooltip.style.left = bounds.left + (bounds.width * percentInElem) + 10 + "px" //Add a tiny bit to get it away from mouse pointer.
		}
		else {
			tooltip.style.left = ""
			tooltip.style.right = bounds.right - (bounds.width * percentInElem) + 5 + "px" //Add a bit for visuals.
		}

		//Scale within range.
		percent = (percent - padding.left) / (1 - padding.left - padding.right)

		let xVal = options.x1.min + (options.x1.range * percent)

		tooltip.innerHTML = formatDate(new Date(xVal))

		let isForecast;
		function addLines(lines) {
			lines.forEach((line) => {
				let lastIndex;
				let index = line.points.findIndex((point, index) => {
					if (point?.[line.yAlias] === undefined) {return}
					if (point[line.xAlias] > xVal) {
						return true
					}
					else {
						lastIndex = index
					}
				})

				let point = line.points[lastIndex]

				if (point?.[line.yAlias] === undefined) {return} //Avoid erroring.
				tooltip.innerHTML += `<br>${point[line.yAlias]} ${line.scrubUnits}`

				if (point[line.forecastAlias]) {isForecast = true}
			})
		}

		addLines(options.y1.lines)

		if (options.y2) {
			addLines(options.y2.lines)
		}

		if (isForecast) {tooltip.innerHTML += "<br>Forecast"}
	}

	finalCanvas.addEventListener("mousemove", handleMoveEvent)
	finalCanvas.addEventListener("touchmove", handleMoveEvent)

	return {container: graphContainerDiv, canvas: finalCanvas}
}


window.createGraph = createGraph

module.exports = {
	createGraph
}
