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
function addLine(GraphName, timeframe, Source, canvas, horizontal, vertical, color, graphtype, numplace) {
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

    ctx.lineWidth = Math.ceil(Math.min(width, height)/70)

    ctx.beginPath();

    if (graphtype === 2) {
        width = width*0.86 //We need to put values on both sides
        ctx.lineWidth = Math.ceil(ctx.lineWidth/1.3) //Because there are two lines, make the lines thinner.
    }
    else {
        width = width*0.93
    }

    var calcvertical = []
    for (var i = 0;i<vertical.length;i++) {
        if (!isNaN(Number(vertical[i])) && (vertical[i]) !== "") {
            calcvertical.push(vertical[i])
        }
        //else {
        //This is a valid warning - It just got TOO ANNOYING
        //console.warn("Element " + i + " in list is an invalid number. It had a value of: " + vertical[i])
        //}
    }

    var vscale = Math.max(...calcvertical) - Math.min(...calcvertical)
    var hscale = Math.max(...horizontal) - Math.min(...horizontal)
    vscale = height/vscale
    hscale = width/hscale
    var voffset = Math.min(...calcvertical)
    var hoffset = Math.min(...horizontal)

    hoffset -= (Math.max(...horizontal) - Math.min(...horizontal))*0.07

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

    if (numplace === 0 || numplace === undefined) {
        var start = 1
        }
    else {
        var start = canvas.width-(canvas.width*0.07)
        }
        ctx.font = "bold " + ctx.font
    for(var i = 1;i<11;i++) {
        var Text = ((Math.max(...calcvertical) - Math.min(...calcvertical))*((i-1)/10))+Math.min(...calcvertical)

        let precision = Math.max(0, 3-String(Math.round(Text)).length)

        Text = Number(Text.toFixed(precision))

        ctx.fillText(Text, start, (height*(11-i))/10-5);
    }

    //Top one
    Text = ((Math.max(...calcvertical) - Math.min(...calcvertical))*((i-1)/10))+Math.min(...calcvertical)

    let precision = Math.max(0, 3-String(Math.round(Text)).length)

    Text = Number(Text.toFixed(precision))

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
    addLine
}
