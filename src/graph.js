function fillParameters(options) {
	//Process options, filling in parameters with defaults.
	
	//Should y1 and y2, or even each individual line, be able to set xAlias and yAlias? (I would think so).
	options.xAlias = options.xAlias || "x"
	options.yAlias = options.yAlias || "y"

	function sortPoints(a,b) {return a[options.xAlias]-b[options.xAlias]} //Sort the points in a line, x values ascending
	
	function prepareYAxis(y) {
		//If lines is a line, instead of an array of lines, put it in an array.
		if (!(y.lines[0] instanceof Array)) {
			y.lines = [y.lines]
		}
		//Iterate through each point and find the minimum and maximum x and y values
		//TODO: Delete invalid points and lines without any points (after invalid points removed).
		y.lines.forEach((line) => {
			line.forEach((point) => {
				if (point[options.xAlias] < y.xmin || isNaN(y.xmin)) {y.xmin = point[options.xAlias]}
				if (point[options.xAlias] > y.xmax || isNaN(y.xmax)) {y.xmax = point[options.xAlias]}
				if (point[options.yAlias] < y.ymin || isNaN(y.ymin)) {y.ymin = point[options.yAlias]}
				if (point[options.yAlias] > y.ymax || isNaN(y.ymax)) {y.ymax = point[options.yAlias]}
			})
			line = line.sort(sortPoints)
		})
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
	}
	
	
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
		ctx.fillStyle = options.backgroundColor
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
	
	function goToPoint(point, min, range, move = false) {
		let horizontal = getHorizontalCoordinate(point[options.xAlias], options.x1.min, options.x1.range)
		let vertical = getVerticalCoordinate(point[options.yAlias], min, range)
				
		if (move) {ctx.moveTo(horizontal, vertical)}
		else {
			ctx.lineTo(horizontal, vertical)
		}
	}
	
	let index = 0
	function nextLineColor() {
		let color = (options.lineColors && options.lineColors[index++])	
		if (color) {
			if (typeof color === "string") {
				ctx.strokeStyle = color
			}
			else if (color instanceof Array){
				//An array containing all the color stops that need to be added.
				//Ex. [[0,"#00FF00"],[1,"#0000FF"]] to go from green to blue.
	    		let gradient = ctx.createLinearGradient(0, lineCanvas.height, 0, 0); //Color stop 0 is bottom of graph. Color stop 1 is top of graph.
				color.forEach((colorStop) => {
					gradient.addColorStop(colorStop[0], colorStop[1])
				})
        		ctx.strokeStyle = gradient;
			}
			else {
				throw "Unsupported color type " + color
			}
		}
	}
	
	options.y1.lines.forEach((line) => {
		nextLineColor()
		ctx.beginPath()
		line.forEach((point, index) => {
			if (index === 0) {goToPoint(point, options.y1.min, options.y1.range, true)}
			goToPoint(point, options.y1.min, options.y1.range)
		})
		ctx.stroke()
	})
	
	if (options.y2) {
		options.y2.lines.forEach((line) => {
			nextLineColor()
			ctx.beginPath()
			line.forEach((point, index) => {
				if (index === 0) {goToPoint(point, options.y2.min, options.y2.range, true)}
				goToPoint(point, options.y2.min, options.y2.range)
			})
			ctx.stroke()
		})	
	}
	
	
				
	return lineCanvas
	
}


window.createGraph = createGraph

/*
var arr1 = usgsarray["01650500"].feet;
var arr2 = usgsarray["01650500"].cfs;
console.time("createCanvas");
var canvas = createGraph({
	xAlias:"dateTime",
	yAlias:"value",
	lineColors:["#00FFFF",[[0,"#FF0000"],[0.5,"#00FF00"],[1,"#0000FF"]]],
	backgroundColor: "black",
	y1: {
		lines: arr1
	},
	y2: {
		lines:arr2
	}
})
console.timeEnd("createCanvas");
document.documentElement.insertBefore(canvas, document.body)
*/

/*
createGraph({
	y1: {
		lines: [
			{x: 100, y:200} //An individual point.
		] //Array of points, or an array of arrays of points.
		min: //Optional. Specify minimum y value for this axis.
		max: //Optional. Specify maximum y value for this axis
	}
	y2: {} //Optional. Same as y1, except other axis.
})
*/




//Graph Code
//It's Ugly... It should be fixed
//BUT IT WORKS

//addline(canvas, horizontal, vertical, color, graphtype, numplace)

//canvas - HTML canvas element
//horizontal - array of horizontal values. Pass 0 and it will evenly space.
//vertical - array of vertical values

//color - Optional. Color of line. Default black
//graphtype - Optional. Specify 2 to put 2 lines and 2 scales on one graph. See numplace below
//numplace - Use only if you are using graphtype = 2.
//If you specify 0 or do not pass a value, the line's scale will be on the left side of the graph.
//If you specify 1, the line's scale will be on the right side of the graph

function addLine(GraphName, timeframe, Source, canvas, horizontal, vertical, color, graphtype, numplace, maxDigitsBeforeRounding = 6) {
    if (graphtype === 3) {
        var endcolor = numplace
        }
    if (graphtype !== 2) {
        numplace = 0
    }
    var height = canvas.height*0.80
    var width = canvas.width

    var ctx = canvas.getContext('2d');

    if (!isNaN(Number(horizontal))) {
        horizontal = []
        for (var i = 0;i<vertical.length;i++) {
            horizontal.push(i*width)
        }
    }
    if (horizontal.length !== vertical.length) {
        console.warn("Uneven amount of datapoints. " + horizontal.length + " horizontal points found, but " + vertical.length + " vertical points found.")
    }

    color = color || "#000000"

    ctx.lineWidth = Math.ceil(Math.min(width, height)/60)

    ctx.beginPath();

    if (graphtype === 2) {
        width = width*0.83 //We need to put values on both sides
		//Because there are two lines, make the second line thinner so that it can't entirely cover the first. (first is about double the size.)
		if (numplace === 1) {
        	ctx.lineWidth = Math.ceil(ctx.lineWidth/1.6) //Thinner
		}
		else {
        	ctx.lineWidth = Math.ceil(ctx.lineWidth*1.1) //Slightly Wider
		}
    }
    else {
        width = width*0.93
    }

	//Eliminate invalid values so that they can't cause issues in calculating min/max.
    var calcvertical = []
    for (var i = 0;i<vertical.length;i++) {
        if (!isNaN(Number(vertical[i])) && (vertical[i]) !== "") {
            calcvertical.push(vertical[i])
        }
    }
	
	let verticalMax = Math.max(...calcvertical)
	let verticalMin = Math.min(...calcvertical)
	let horizontalMax = Math.max(...horizontal)
	let horizontalMin = Math.min(...horizontal)
	
    var vscale = verticalMax - verticalMin
    var hscale = horizontalMax - horizontalMin
    vscale = height/vscale
    hscale = width/hscale
    var voffset = verticalMin
    var hoffset = horizontalMin

    hoffset -= (Math.max(...horizontal) - Math.min(...horizontal))*0.1

    var px = Math.floor(((canvas.width)*0.07)/2.6)
    ctx.font = (px + 'px serif')
    if (color.length === 9) {
        color = color.slice(0,7)
    }
    ctx.fillStyle = color
    ctx.strokeStyle = color

    if (graphtype === 3) {
        var grd = ctx.createLinearGradient(0, 0, 0, height);
        grd.addColorStop(0, color);
        grd.addColorStop(1, endcolor);
        ctx.strokeStyle = grd;
        ctx.fillStyle = grd;
    }

	function round(Text) {
		let precision = Math.max(0, Math.min(maxDigitsBeforeRounding-String(Math.round(Text)).length, 2))
		return Number(Text.toFixed(precision))
	}
	
    if (numplace === 0 || numplace === undefined) {
        var start = 1
        }
    else {
        var start = canvas.width-(canvas.width*0.07)
        }
        ctx.font = "bold " + ctx.font
    for(var i = 1;i<11;i++) {
        var Text = round(((Math.max(...calcvertical) - Math.min(...calcvertical))*((i-1)/10))+Math.min(...calcvertical))

        ctx.fillText(Text, start, (height*(11-i))/10-5);
    }

    //Top one
    Text = round(((Math.max(...calcvertical) - Math.min(...calcvertical))*((i-1)/10))+Math.min(...calcvertical))
	
    ctx.fillText(Text, start, 27);


    var px = Math.floor(((canvas.width)*0.07)/2.4)
    ctx.font = (px + 'px serif')
    if (color.length === 9) {
        color = color.slice(0,7)
    }


    if (!window.darkMode) {
        ctx.fillStyle = "black"
    }
    else {
        //Dark Mode
        ctx.fillStyle = "#eeeeee"
    }



    function formatDate(date) {
        var time = String(date.getHours())

        if (date.getHours() < 10) {
            time = "0" + time
        }
        time += ":"
        if (date.getMinutes() < 10) {
            time += "0" + date.getMinutes()
        }
        else {
            time += date.getMinutes()
        }
        time += " " + (date.getMonth()+1) + "/" + date.getDate() + "/" +date.getFullYear()
        return time
    }

    var time1 = new Date(timeframe[0])
    var time2 = new Date(timeframe[timeframe.length - 1])
    var time3 = new Date(((time2-time1)/2)+time1.getTime())

    var starttime = formatDate(time1)
    var endtime = formatDate(time2)
    var midtime = formatDate(time3)

    ctx.fillText(starttime, 10, (canvas.height*(11/12))-(canvas.height*0.06)-12)

    ctx.textAlign = "end";
    ctx.fillText(endtime, canvas.width-10, (canvas.height*(11/12))-(canvas.height*0.06)-12)

    ctx.textAlign = "center";
    ctx.fillText(midtime, canvas.width/2, (canvas.height*(11/12))-(canvas.height*0.06)-12)

    ctx.textAlign = "start";

	ctx.lineJoin = "round" //Round out edges, and make sure that lines don't spike off the canvas (miter is a really bad default)

    var px = Math.floor(((canvas.width)*0.07)/2.0)
    ctx.font = (px + 'px serif')
    ctx.fillStyle = color
    //We need to create a gradient for just the text "Water Temperature (F)"
    if (graphtype === 3) {
        var grd = ctx.createLinearGradient(0, height, 200, height);
        grd.addColorStop(0, color);
        grd.addColorStop(1, endcolor);
        ctx.strokeStyle = grd;
        ctx.fillStyle = grd;
    }

    if (graphtype === 2) {
        if (numplace === 0 || numplace === undefined) {
            ctx.fillText("Flow (Cubic Feet/Second)", start+5, (canvas.height*(11/12)));
        }
        else {
            ctx.textAlign = "right";
            ctx.fillText("Gauge Height (Feet)", start-5, (canvas.height*(11/12)));
            ctx.textAlign = "start";
        }
    }
    else if (graphtype === 3) {
        ctx.fillText("Water Temperature (°F)", start+5, (canvas.height*(11/12)));
    }
    else {
        if (GraphName === "Precipitation") {
            ctx.fillText("Precipitation (Inches)", start+5, (canvas.height*(11/12)));
            var fulldayprecip = 0
            var halfdayprecip = 0
            var preciplist = vertical.slice(-96)
            var preciplist = preciplist.map(Number)
            //convert strings to numbers
            preciplist.forEach(function(value){
                fulldayprecip += value
            })
            preciplist = preciplist.slice(-48)
            preciplist.forEach(function(value){
                halfdayprecip += value
            })

            fulldayprecip = fulldayprecip.toFixed(2)
            halfdayprecip = halfdayprecip.toFixed(2)

            ctx.fillText("Last 24 Hours: " + fulldayprecip + "\"", canvas.width-770, (canvas.height*(11/12)));
            ctx.fillText("Last 12 Hours: " + halfdayprecip + "\"", canvas.width-400, (canvas.height*(11/12)));
        }
        else if (GraphName === "cfs") {
            ctx.fillText("Flow (Cubic Feet/Second)", start+5, (canvas.height*(11/12)));
        }
        else if (GraphName === "height") {
            ctx.fillText("Gauge Height (Feet)", start+5, (canvas.height*(11/12)));
        }
        else {
            ctx.fillText("Labeling Error...", start+5, (canvas.height*(11/12)));
        }
    }

    //set it back
    if (graphtype === 3) {
        //The area that actually has the graph is the top 80% height wise
        var grd = ctx.createLinearGradient(0, 0, 0, canvas.height*0.8);
        grd.addColorStop(0, color);
        grd.addColorStop(1, endcolor);
        ctx.strokeStyle = grd;
        ctx.fillStyle = grd;
    }

    if (!window.darkMode) {
        ctx.fillStyle = "black"
    }
    else {
        //Dark Mode
        ctx.fillStyle = "#eeeeee"
    }

    ctx.textAlign = "center";
	//Fill the name of the gauge. Max 1150px.
    ctx.fillText(Source, canvas.width/2 , canvas.height-10, 1150);
    ctx.textAlign = "start";

    function H(Value) {
        return Math.round((Value-hoffset)*hscale)
    }

    function V(Value) {
        return Math.round(height-((Value-voffset)*vscale))
    }


    for (var p = 0;p<Math.min(vertical.length, horizontal.length);p++) {
        if (!isNaN(Number(vertical[p])) && vertical[p] !== "") {
            ctx.moveTo(H(horizontal[p]), V(vertical[p]))
            break;
        }
    }


    var valid = 1

    for (var i = p;i<Math.min(vertical.length, horizontal.length);i++) {
        if (!isNaN(Number(vertical[i])) && vertical[i] !== "") {
            if (valid === 1) {
                ctx.lineTo(H(horizontal[i]), V(vertical[i]))
            }
            else {
                ctx.moveTo(H(horizontal[i]), V(vertical[i])+10)
                ctx.lineTo(H(horizontal[i]), V(vertical[i]))
                valid = 1
            }
        }
        else {
            valid = 0
        }
    }


    ctx.stroke();
    ctx.beginPath()

    ctx.lineWidth = Math.ceil(ctx.lineWidth/10)

    if (!window.darkMode) {
        ctx.strokeStyle = "000000AA"
    }
    else {
        //Dark Mode
        ctx.strokeStyle = "#ccccccAA"
    }

    for (var i = 1;i<11;i++) {
        ctx.moveTo(0, height*(11-i)/10)
        ctx.lineTo(canvas.width, height*(11-i)/10)
    }
    ctx.stroke()
}


module.exports = {
    addLine,
	createGraph
}
