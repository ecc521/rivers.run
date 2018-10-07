//Graph Code
function CreateURL(SiteNumber) {
if (typeof(SiteNumber) === "number") {
console.warn("A number (" + SiteNumber + ") was passed where a string is needed. If the number contained leading zeros that CreateURL is unable to replace, you may get an error.")
}
SiteNumber = String(SiteNumber)
if (SiteNumber.length < 8) {
var OldNum = SiteNumber
SiteNumber = "0".repeat(8-SiteNumber.length) + SiteNumber
console.warn("Changed " + OldNum + " to " + SiteNumber + ". It is reccomended to pass strings instead of integers so that modification is not required.")
}
var DaysBack = 1//Days of history to load.
var time = new Date(Date.now())
var Str1 = time.getFullYear() + "-" + (time.getMonth()+1) + "-" + time.getDate()
time = new Date(Date.now() - 86400000*DaysBack)
var Str2 = time.getFullYear() + "-" + (time.getMonth()+1) + "-" + time.getDate()
return "https://waterdata.usgs.gov/nwis/uv?cb_00045=on&cb_00010=on&cb_00045=on&cb_00060=on&cb_00065=on&format=rdb&site_no=" + SiteNumber + "&period=&begin_date=" + Str2 + "&end_date=" + Str1
}


    
async function LoadStringData(URL) {
    var Response = await fetch(URL)
    Response = await Response.text()
    return Response
}
    
function TrimTopStuff(StringData) {
    StringData = StringData.split("\n")
    while (StringData[0][0] === "#") {
        StringData.shift()
    }
    return StringData
}
      
function Expand(DataArray) {
    return DataArray.map(function(value) {
        return value.split("	")
    })
}
    
function TrimExtraData1(Array) {
    return Array.map(function(value) {
        value.splice(0,2)
        return value
    })
}
    
function TrimExtraData2(Array) {
    return Array.map(function(value) {
        for (var count = 3; count<value.length;count=count+1) {
            value.splice(count, 1)
        }
        return value
    })
}
    
function CheckTimeZone(Check) {
    var Checker = Check[2][1]
    Check = Check.splice(2, Array.length-3)
    Check.map(function(value) {
        if (value[1] !== Checker) {
            throw ("Time zones " + Checker + " and " + value[1] + " do not match!")
        }
    })
    return Checker
}
    
function RemoveTimeZone(Array) {
    return Array.map(function(value) {
        value.splice(1,1)
        return value
    })
}
    
function Objectify(Array, GageName, Timezone) {
    var data = {}
    data.Source = GageName
    data.Timezone = Timezone
    
    data.timeframe = Array.map(function(value){
        return value[0]
    })
    data.timeframe.splice(0,2)
    data.timeframe.pop()
    
    Array.pop()
    var cfsnum;
    for (var i = 0;i<Array[0].length;i++) {
        if (Array[0][i].indexOf("00060") !== -1) {
            cfsnum = i
            break;
        }    
    }
    
    var heightnum;
    for (var i = 0;i<Array[0].length;i++) {
        if (Array[0][i].indexOf("00065") !== -1) {
            heightnum = i
            break;
        }    
    }
    
    var precipnum;
    for (var i = 0;i<Array[0].length;i++) {        
        if (Array[0][i].indexOf("00045") !== -1) {
            precipnum = i
            break;
        }    
    }
    
    var tempnum;
    for (var i = 0;i<Array[0].length;i++) {
        if (Array[0][i].indexOf("00010") !== -1) {
            tempnum = i
            break;
        }    
    }    
    
    
    if (cfsnum !== undefined) {
    data.cfs = Array.map(function(value) {
        return value[cfsnum]
    })
    data.cfs.splice(0,2)
    }
    
    
    
    if (heightnum !== undefined) {
    data.height =  Array.map(function(value) {
        return value[heightnum]
    })
    data.height.splice(0,2)
    }
  
    
    
    if (precipnum !== undefined) {
    data.precip =  Array.map(function(value) {
        return value[precipnum]
    })
    data.precip.splice(0,2)
    }
    
    
    if (tempnum !== undefined) {
    data.temp =  Array.map(function(value) {
    if (String(Number(value[tempnum])) !== "NaN" && value[tempnum] !== "") {
    return value[tempnum]
    }
    else{
    return NaN
    }
    })
    data.temp.splice(0,2)
    }
    
    
    //data.all = Array
    

    return data
}
async function FetchData(SiteNumber) {
    var FetchedFromUSGS = await LoadStringData(CreateURL(SiteNumber))
    var GageName = FetchedFromUSGS.split("\n")[16].slice(1).trim()
    var Data = TrimExtraData2(TrimExtraData1(Expand(TrimTopStuff(FetchedFromUSGS))))
    var Timezone = (CheckTimeZone(Data))
    return Objectify(RemoveTimeZone(Data), GageName, Timezone)

}  
//AddLine(canvas, horizontal, vertical, color, graphtype, numplace)
    
//canvas - HTML canvas element
//horizontal - array of horizontal values. Pass 0 and it will evenly space.
//vertical - array of vertical values
    
//color - Optional. Color of line. Default black
//graphtype - Optional. Specify 2 to put 2 lines and 2 scales on one graph. See numplace below
    //numplace - Use only if you are using graphtype = 2. 
        //If you specify 0 or do not pass a value, the line's scale will be on the left side of the graph.
        //If you specify 1, the line's scale will be on the right side of the graph.
    
function AddLine(Timezone, timeframe, Source, canvas, horizontal, vertical, color, graphtype, numplace) {
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

if (color === undefined) {
    color = "#000000"
}
ctx.strokeStyle = color
ctx.lineWidth = Math.ceil(Math.min(width, height)/120)
ctx.beginPath();

if (graphtype === 2) {
width = width*0.86
}
else {
width = width*0.93
}

var calcvertical = []
for (var i = 0;i<vertical.length;i++) {
if (String(Number(vertical[i])) !== "NaN" && (vertical[i]) !== "") {
    calcvertical.push(vertical[i])
}
else {
    console.warn("Element " + i + " in list is an invalid number. It had a value of: " + vertical[i])
}
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
if (graphtype === 3) {
var grd = ctx.createLinearGradient(0, 0, 0, height);
grd.addColorStop(0, color);   
grd.addColorStop(1, endcolor);
ctx.strokeStyle = grd;
ctx.fillStyle = grd;
}    

if (numplace === 0 || numplace === undefined) {
    start = 1
}
else {
    start = canvas.width-(canvas.width*0.07)
}
for(var i = 1;i<11;i++) {
    var Text = ((Math.max(...calcvertical) - Math.min(...calcvertical))*((i-1)/10))+Math.min(...calcvertical)
    
    if (Text >= 1000) {
        Text = Math.round(Text)
    }
    else {
    Text = Text.toFixed(3-String(Math.round(Text)).length)
    if (Number(Text) === Math.round(Text)) {
    Text = Math.round(Text)
    }
    }
    
    ctx.fillText(Text, start, (height*(11-i))/10-5);
}
    
var px = Math.floor(((canvas.width)*0.07)/2.8)
ctx.font = (px + 'px serif')
if (color.length === 9) {
    color = color.slice(0,7)
}
ctx.fillStyle = "black"
    
    
    
    
var time1 = new Date(timeframe[0])
var time2 = new Date(timeframe[timeframe.length - 1])
var time3 = new Date(((time2-time1)/2)+time1.getTime())
var starttime = time1.getHours()
var endtime = time2.getHours()
var midtime = time3.getHours()
if (String(time1.getHours()).length < 2) {
    starttime = starttime + "0"
}
starttime += ":" + time1.getMinutes()
if (String(time1.getMinutes()).length < 2) {
    starttime = starttime + "0"
}
starttime += " " + (time1.getMonth()+1) + "/" + time1.getDate() + "/" +time1.getFullYear()

    
if (String(time2.getHours()).length < 2) {
    endtime = endtime + "0"
}
endtime += ":" + time2.getMinutes()
if (String(time2.getMinutes()).length < 2) {
    endtime = endtime + "0"
}
endtime += " " + (time2.getMonth()+1) + "/" + time2.getDate() + "/" +time2.getFullYear()

    
if (String(time3.getHours()).length < 2) {
    midtime = midtime + "0"
}
midtime += ":" + time3.getMinutes()
if (String(time3.getMinutes()).length < 2) {
    midtime = midtime + "0"
}
midtime += " " + (time3.getMonth()+1) + "/" + time3.getDate() + "/" +time3.getFullYear()
    
ctx.fillText(starttime + " (" + Timezone + ")", 10, (canvas.height*(11/12))-(canvas.height*0.06)-12)
ctx.fillText(endtime + " (" + Timezone + ")", canvas.width-275, (canvas.height*(11/12))-(canvas.height*0.06)-12)
  
ctx.textAlign = "center"; 
ctx.fillText(midtime + " (" + Timezone + ")", canvas.width/2, (canvas.height*(11/12))-(canvas.height*0.06)-12)
ctx.textAlign = "start";     
    
    
    
var px = Math.floor(((canvas.width)*0.07)/2.4)
ctx.font = (px + 'px serif')
ctx.fillStyle = color
//because a bit of text is smaller than the whole graph
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
ctx.fillText("Gage Height (Feet)", start-195, (canvas.height*(11/12)));    
} 
}
else if (graphtype === 3) {
ctx.fillText("Tempreture (°F)", start+5, (canvas.height*(11/12)));    
}
else {
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
    
ctx.fillText("Last 24 Hours: " + fulldayprecip + " in", canvas.width-700, (canvas.height*(11/12))); 
ctx.fillText("Last 12 Hours: " + halfdayprecip + " in", canvas.width-330, (canvas.height*(11/12))); 

}

//set it back    
if (graphtype === 3) {
var grd = ctx.createLinearGradient(0, 0, 0, canvas.height);
grd.addColorStop(0, color);   
grd.addColorStop(1, endcolor);
ctx.strokeStyle = grd;
ctx.fillStyle = grd;
}
 
ctx.fillStyle = "black"
ctx.textAlign = "center"; 
ctx.fillText("Gage: " + Source, canvas.width/2 , canvas.height-10);  
ctx.textAlign = "start"; 
    

    
    
function H(Value) {
    return Math.round((Value-hoffset)*hscale)
}

function V(Value) {
    return Math.round(height-((Value-voffset)*vscale))
}


for (var p = 0;p<Math.min(vertical.length, horizontal.length);p++) {
if (String(Number(vertical[p])) !== "NaN" && vertical[p] !== "") {
ctx.moveTo(H(horizontal[p]), V(vertical[p]))
break;
}    
}
    

var valid = 1
 
for (var i = p;i<Math.min(vertical.length, horizontal.length);i++) {
    if (String(Number(vertical[i])) !== "NaN" && vertical[i] !== "") {
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
ctx.strokeStyle = "#000000AA"
for (var i = 1;i<11;i++) {
    ctx.moveTo(0, height*(11-i)/10)
    ctx.lineTo(canvas.width, height*(11-i)/10)
}
ctx.stroke()
}    
    
    
    
async function LoadAndRender(number, TextReport,watercanvas, tempcanvas, precipcanvas, color1, color2, color3) {
    var Result = await FetchData(number)
    TextReport.innerHTML = Result.cfs[Result.cfs.length - 1] + " cfs, " + Result.height[Result.height.length - 1] + " feet"
    AddLine(Result.Timezone, Result.timeframe, Result.Source, watercanvas, 0, Result.cfs, color1, 2)
    AddLine(Result.Timezone, Result.timeframe, Result.Source, watercanvas, 0, Result.height, color2, 2, 1)
    var Check = 1
    try {
    for (var i = 0;i<Result.temp.length;i++) {
        if (Result.temp[i] !== undefined) {
            Check = 0
            break;
        }
    }
    }
    catch (e) {}
    if (Check === 0) {
    //Convert to fahrenheit
    Result.temp = Result.temp.map(function(value) {
        return (value*1.8)+32
    })
    AddLine(Result.Timezone, Result.timeframe, Result.Source, tempcanvas, 0, Result.temp, "#FF0000", 3, "#0000FF")
    }
    else {
    var ctx = tempcanvas.getContext('2d')
    ctx.textAlign = "center"; 
    ctx.font= tempcanvas.width/35 + "px Arial"; 
    ctx.fillText("No Temperature Data Avalible for this Site (" +  number + ")",tempcanvas.width/2, tempcanvas.height/2);  
    }
    
    Check = 1
    try {
    for (var i = 0;i<Result.precip.length;i++) {
        if (Result.precip[i] !== undefined) {
            Check = 0
            break;
        }
    }
    }
    catch (e) {}
    if (Check === 0) {
    AddLine(Result.Timezone, Result.timeframe, Result.Source, precipcanvas, 0, Result.precip, color3)
    }
    else {
    var ctx = precipcanvas.getContext('2d')
    ctx.font= precipcanvas.width/35 + "px Arial"; 
    ctx.textAlign = "center";     
    ctx.fillText("No Precipitation Data Avalible for this Site (" +  number + ")",precipcanvas.width/2, precipcanvas.height/2);  
    }
    
}
    
    
    
function ToFlow(idMake) {
    var id = idMake.slice(0,-7)
    var canvas1 = GetId(id + "canvas1")
    var canvas2 = GetId(id + "canvas2")
    var canvas3 = GetId(id + "canvas3")
    var button1 = GetId(id + "button1")
    var button2 = GetId(id + "button2")
    var button3 = GetId(id + "button3")
    canvas1.style.display="block"
    canvas2.style.display="none"
    canvas3.style.display="none"
    button1.className = "FlowButton"
    button2.className = "Unselected"
    button3.className = "Unselected"
}
    
function ToTemp(idMake) {
    var id = idMake.slice(0,-7)
    var canvas1 = GetId(id + "canvas1")
    var canvas2 = GetId(id + "canvas2")
    var canvas3 = GetId(id + "canvas3")
    var button1 = GetId(id + "button1")
    var button2 = GetId(id + "button2")
    var button3 = GetId(id + "button3")
    canvas2.style.display="block"
    canvas1.style.display="none"
    canvas3.style.display="none"
    button1.className = "Unselected"
    button2.className = "TempButton"
    button3.className = "Unselected"
}
    
function ToPrecip(idMake) {
    var id = idMake.slice(0,-7)
    var canvas1 = GetId(id + "canvas1")
    var canvas2 = GetId(id + "canvas2")
    var canvas3 = GetId(id + "canvas3")
    var button1 = GetId(id + "button1")
    var button2 = GetId(id + "button2")
    var button3 = GetId(id + "button3")
    canvas3.style.display="block"
    canvas2.style.display="none"
    canvas1.style.display="none"
    button1.className = "Unselected"
    button2.className = "Unselected"
    button3.className = "PrecipButton"
}
   
    
    
    
function CreateGraphs(DivToAppend, USGSNum, TextReport) {
var idMake = ""
for (var i = 0;i<10;i++) {
idMake += String(Math.random()*(2**53))
}

    
var canvas1 = document.createElement("canvas")
var canvas2 = document.createElement("canvas")
var canvas3 = document.createElement("canvas")
canvas1.width = 1200
canvas2.width = 1200
canvas3.width = 1200
canvas1.height = 800
canvas2.height = 800
canvas3.height = 800
    


LoadAndRender(USGSNum, TextReport, canvas1, canvas2, canvas3, "#00AAFF80", "#0000FF80", "#0066FF80")
DivToAppend.appendChild(canvas1)
    

canvas2.style.display = "none"
canvas3.style.display = "none"

    
DivToAppend.appendChild(canvas2)
DivToAppend.appendChild(canvas3)
canvas1.id = idMake + "canvas1"    
canvas2.id = idMake + "canvas2"    
canvas3.id = idMake + "canvas3"    
    
    

var button1 = document.createElement("button")
button1.innerHTML = "Flow Info"
button1.addEventListener("click", function() {ToFlow(this.id)})
button1.className = "FlowButton"
button1.id = idMake + "button1"   

var button2 = document.createElement("button")
button2.innerHTML = "Tempreture"
button2.addEventListener("click", function() {ToTemp(this.id)})
button2.className = "Unselected"
button2.id = idMake + "button2"   
    
    
var button3 = document.createElement("button")
button3.innerHTML = "Precipitation"
button3.addEventListener("click", function() {ToPrecip(this.id)})  
button3.className = "Unselected"
button3.id = idMake + "button3"   
    
    
var Div = document.createElement("div")
 
Div.appendChild(button1)
Div.appendChild(button3)
Div.appendChild(button2)

Div.className = "canvasbuttons"
return Div
}
//End of Graph Code
