'use strict';

function GetId(Name) {
  return document.getElementById(Name)
}

//Fetch data from USGS

(async function() {
    
    var sites = []
    for (let i=0;i<riverarray.length;i++) {
        let val = riverarray.usgs
        //Check for accuracy
        if (val && val.length > 7 && val.length < 16) {
            sites.push(val)
        }
    }
    let url = "https://waterservices.usgs.gov/nwis/iv/?format=json&sites=" + sites.join(",") +  "&startDT=" + new Date(Date.now()-1000*86400).toISOString()  + "&parameterCd=00060,00065,00010,00045&siteStatus=all"


    let response = await fetch(url)
    let usgsdata = await response.json()    

    self.usgsarray = {}
    //Iterate through all known conditions
    usgsdata.value.timeSeries.forEach(function(event){
        let obj2 = {}
        obj2.values = event.values[0].value //The values - ex. Gauge Height Array

        obj2.units = event.variable.variableDescription //Units of values
        
        //See if the site is already in the array.
        //If the site code is not in the array, add it. 
        if (!usgsarray[event.sourceInfo.siteCode[0].value]) {
            let obj3 = {}
            obj3.name = event.sourceInfo.siteName
            usgsarray[event.sourceInfo.siteCode[0].value] = obj3
        }
        //Add the values onto the site code object
        usgsarray[event.sourceInfo.siteCode[0].value][event.variable.variableCode[0].value] = obj2
    })
    
    console.log(usgsarray)
}())


function TopBar() {
    this.create = function() {
        let button = document.createElement("button")
        button.id = "topbar"
        button.className = "riverbutton"
        function NewSpan(Text) {
        let span = document.createElement("span")
        span.className = "riverspan"
        span.innerHTML = Text
        return span
        }
        
        let span = NewSpan("River ")
        span.onclick = function() {
            if (this.value) {
                if (this.value === 1) {
                    NewList("alphabetical", "sort", true)
                    this.innerHTML = "River " + "<div class='triangle-down'></div>"
                    this.value = 0
                }
                else {
                    NewList("alphabetical", "sort")
                    this.innerHTML = "River " + "<div class='triangle-up'></div>"
                    this.value = 1
                }
            }
            else {
            NewList("alphabetical", "sort")
            this.innerHTML = "River " + "<div class='triangle-up'></div>"
            this.value = 1
            }
        }
        span.value = 1//Starts sorted alphabetically, a-z. The first sort needs to flip that.
        span.innerHTML += "<div class='triangle-up'></div>"
        button.appendChild(span)
        
        
        button.appendChild(NewSpan("Section"))

        
        span = NewSpan("Skill ")
        span.onclick = function() {
            if (this.value) {
                if (this.value === 1) {
                    NewList("skill", "sort", true)
                    this.innerHTML = "Skill " + "<div class='triangle-down'></div>"
                    this.value = 0
                }
                else {
                    NewList("skill", "sort")
                    this.innerHTML = "Skill " + "<div class='triangle-up'></div>"
                    this.value = 1
                }
            }
            else {
            NewList("skill", "sort")
            this.innerHTML = "Skill " + "<div class='triangle-up'></div>"
            this.value = 1
            }
        }
        span.innerHTML += "<div class='triangle-up'></div>"
        button.appendChild(span) 
        
        span = NewSpan("Rating ")
        span.onclick = function() {
            if (this.value) {
                if (this.value === 1) {
                    NewList("rating", "sort", true)
                    this.innerHTML = "Rating " + "<div class='triangle-up'></div>"
                    this.value = 0
                }
                else {
                    NewList("rating", "sort")
                    this.innerHTML = "Rating " + "<div class='triangle-down'></div>"
                    this.value = 1
                }
            }
            else {
            NewList("rating", "sort")
            this.innerHTML = "Rating " + "<div class='triangle-down'></div>"
            this.value = 1
            }
        }
        span.innerHTML += "<div class='triangle-down'></div>"
        button.appendChild(span) 
        
        button.appendChild(NewSpan("Miles"))

        return button
    }
    
    this.delete = function() {
        let Node = GetId("topbar")
        if (Node) {
            Node.parentNode.removeChild(Node)
        }
    }
}
    
  
    
    
function River(locate, event) {
  this.name = event.name
  this.section = event.section
  this.skill = event.skill
    
  switch (Number(event.rating)) {
    case 1:
        this.rating = "1Star";
        break;
    case 2:
    case 3:
    case 4:
    case 5:
        this.rating = event.rating + "Stars";
        break;
    default:
        this.rating = "Error"
  }
  if (!this.rating) {
      this.rating = "Error"
  }

  this.length = event.length
  this.writeup = event.writeup
  this.tags = event.tags || ""
  this.usgs = event.usgs
  this.plat = event.plat
  this.plon = event.plon
  this.tlat = event.tlat
  this.tlon = event.tlon
  this.aw = event.aw
  this.base = "b" + locate
  this.expanded = 0
  this.index = locate
    
    
  this.create = function () {
    //Only create the button once - It's about 3 times faster.
    if (!this.finished) {
    var button = document.createElement("button")
    button.id = this.base + 1
      
    function AddSpan(text) {
    let span = document.createElement("span")
    span.innerHTML = text
    span.className = "riverspan"
    button.appendChild(span)
    }
            
    AddSpan(this.name)
    AddSpan(this.section)
    AddSpan(this.skill)
    
    //Star images for rating
    if (this.rating === "Error") {
        AddSpan("???") 
    }
    else {
    let img = document.createElement("img")
    img.src = "https://rivers.run/resources/" + this.rating + ".png"
    img.alt = this.rating[0] + " Stars"
    img.className = "starimg"
    let span = document.createElement("span")
    span.appendChild(img)
    span.className = "riverspan"
    button.appendChild(span)
    }
      
      
    AddSpan(this.length)
    button.className = "riverbutton"
      
    
    button.onclick = function () {
        let river = ItemHolder[locate]
        if (river.expanded === 0) {
        river.expanded = 1
        var div = document.createElement("div")
        div.innerHTML = river.writeup
            
        if (river.plat && river.plon) {
            div.innerHTML += "Put-In GPS Coordinates: "
        }
        
        if (river.tlat && river.tlon) {
            div.innerHTML += ""
        }
            
            
        if (river.aw) {
            div.innerHTML += "<br><br><a href='https://www.americanwhitewater.org/content/River/detail/id/" + river.aw + "'>Click here to visit this site on American Whitewater</a>"
        }

        //Graph
        let data = usgsarray[river.usgs]        
        if (data) {
            let temp = data["00010"]
            let precip = data["00045"]
            let cfs = data["00060"]
            let height = data["00065"]

            console.log(data)

            //Auxillary Function
            function toparts(arr) {
                let values = []
                let timestamps = []

                for (let i=0;i<arr.length;i++) {
                    let obj = arr[i]
                    values.push(obj.value)
                    timestamps.push(obj.dateTime)
                }

                return {values:values,timestamps:timestamps}
            }


            if (cfs||height) {
                let canvas = document.createElement("canvas")
                canvas.width = 1200
                canvas.height = 800

                if (cfs) {
                    let parts = toparts(cfs.values)
                    AddLine("cfs", parts.timestamps, data.name, canvas, 0, parts.values, "#00AAFF80", 2)
                }
                if (height) {
                    let parts = toparts(height.values)
                    AddLine("height", parts.timestamps, data.name, canvas, 0, parts.values, "#0000FF80", 2, 1)
                }
                div.appendChild(canvas)
            }

            if (temp) {
                let canvas = document.createElement("canvas")
                canvas.width = 1200
                canvas.height = 800    

                let parts = toparts(temp.values)
                AddLine("", parts.timestamps, data.name, canvas, 0, parts.values, "#FF0000", 3, "#0000FF")
                div.appendChild(canvas)
            }

            if (precip) {
                let canvas = document.createElement("canvas")
                canvas.width = 1200
                canvas.height = 800    

                let parts = toparts(precip.values)
                AddLine("Precipitation", parts.timestamps, data.name, canvas, 0, parts.values, "#0066FF80")
                div.appendChild(canvas)
            } 
        }
        //End of Graph
            
        div.style.padding = "6px"
        div.id = river.base + 2
        button.style.backgroundColor = "#e3e3e3"
        button.parentNode.insertBefore(div, button.nextSibling)
        }
        else {
        river.expanded = 0
        button.style.backgroundColor = ""
        var elem = GetId(river.base + 2)
        if (elem) {
        elem.parentNode.removeChild(elem)
        }
            
        }        
    }
        
    //Store button for reuse later   
    this.finished = button
    
    //Make content available to Googlebot for indexing
    if (navigator.userAgent.indexOf("Google") !== -1) {
        try {
            setTimeout(function(){button.dispatchEvent(new Event("click"))}, 100)
        }
        catch(e) {}
    }
    //The code directly above this is used to allow Googlebot to index content. 
    //Shall it result in an SEO hit, or shall Googlebot be improved to handle content inside of JavaScript,
    //It can safely be removed.
      
        
    }
      
    //Return finished button
    return this.finished
      
  }
  this.delete = function () {
    let river = ItemHolder[locate]
    function Remove(Code) {
        let ToDelete = GetId(river.base + Code)
        if (ToDelete) {
            ToDelete.parentNode.removeChild(ToDelete)
        }
    }
      
    //Reset background color
    let reset = GetId(river.base + 1)
    if (reset) {
        reset.style.backgroundColor = ""
    }
      
    Remove(2)
    Remove(1)   
      
  } 
}
    

    
    
    
//ItemHolder is a list of all the DOM elements objects. New objects should be pushed into the list. 
var ItemHolder = []
riverarray.map(function(event, index) {
    ItemHolder[index] = new River(index, event)
})
    

function alphabeticalsort(orderedlist, reverse) {
  
    function compare(a,b) {
    if (a.name < b.name)
        return -1;
    if (a.name > b.name)
        return 1;
    return 0;
    }
  
    orderedlist.sort(compare);
    if (reverse) {
        orderedlist.reverse()
    }
  
    return orderedlist
}

function ratingsort(orderedlist, reverse) {
    function compare(a,b) {
    if (a.rating > b.rating)
        return -1;
    if (a.rating < b.rating)
        return 1;
    return 0;
    }
    orderedlist.sort(compare);
    if (reverse) {
         orderedlist.reverse()
    }
    //Move error values to end
    while (orderedlist[0].rating === "Error") {
        orderedlist.push(orderedlist.shift())
    }  
    return orderedlist
  
}
    
var oldresult;    
function NewList(query, type, reverse) {
    if (typeof(query) === "string") {
    query = query.toLowerCase()
    }
    //Location searching uses numbers.
    
    let orderedlist = ItemHolder;
    if (!(String(query).length === 0 || !query || !type)) {
    if (type === "sort") {
    //Obey other filters
    if (oldresult) {
        orderedlist = oldresult
    }   
    if (query === "alphabetical") {
      orderedlist = alphabeticalsort(orderedlist, reverse)
    }
    else if (query === "rating") {
      orderedlist = ratingsort(orderedlist, reverse)
    }
    else if (query === "skill") {
    orderedlist.sort(function(a,b) {
    
    function ToNum(value) {

    switch (value.skill) {
    case "FW":
        value = 1;
        break;
    case "B":
        value = 2;
        break;
    case "N":
        value = 3;
        break;
    case "LI":
        value = 4;
        break;
    case "I":
        value = 5;
        break;
    case "HI":
        value = 6;
        break;
    case "A":
        value = 7;
        break;
    case "E":
        value = 8;
        break;
    default:
        value = 9;
    }
    return value
    }       
        return ToNum(a)-ToNum(b)
    })
        
    if (reverse) {
    orderedlist.reverse()
    while (orderedlist[0].skill === "?") {
        orderedlist.push(orderedlist.shift())
    }
    }      
    }      
    }
        
        
    if (type === "normal") {
        let l = [[],[],[],[],[]]
        orderedlist.forEach(function(event){
            if(event.tags.toLowerCase().indexOf(query) !== -1) {
                if (event.name.toLowerCase().indexOf(query) !== -1) {
                    l[0].push(event)
                }
                else {
                    l[1].push(event)
                }
            }
            else if (event.name.toLowerCase().indexOf(query) !== -1) {
                l[2].push(event)
            }
            else if (event.section.toLowerCase().indexOf(query) !== -1) {
                l[3].push(event)
            }
            else if (event.writeup.toLowerCase().indexOf(query) !== -1) {
                l[4].push(event)
            }
        })
        
        orderedlist = l[0].concat(l[1],l[2],l[3])
        
        //Add the less relevant results below
        orderedlist = orderedlist.concat(l[4])
        
        
        
    }
        
        
        
        
    if (type === "advanced") {  
    }    
        
    if (type === "location") {
    if (oldresult) {
        orderedlist = oldresult
    }
    
    var nlist = []
    orderedlist.forEach(function(value){
        if (value.plat && value.plon) {
             if (distanceto(value.plat, value.plon) < query) {
                 nlist.push(value)
             }
        }
    })
    orderedlist = nlist

    
    }
        
        
    }//Closing for if a query is present
    
    console.time("Redraw Table")
    //Clear Current
    ItemHolder.forEach(function(event) {
        event.delete()
    }) 
    //Append New
    var div = GetId("Rivers")
    //Everything else    
    orderedlist.forEach(function(event){
        div.appendChild(event.create())
    })
     
    if (type !== "sort") {
        oldresult = orderedlist
    }
    console.timeEnd("Redraw Table")    
}
    

GetId("Rivers").appendChild(new TopBar().create())
NewList("alphabetical", "sort")
/*NewList("alphabetical", "sort")
NewList("alphabetical", "sort", true)
NewList("rating", "sort")
NewList("rating", "sort", true)
NewList("skill", "sort")
NewList("skill", "sort", true)*/
   
GetId("searchbox").addEventListener("keydown", function() {setTimeout(function(){NewList(GetId("searchbox").value, "normal")}, 20)})

var latitude, longitude, latmiles, longmiles;

//Check for Auto Location
(async function () {
let status = await navigator.permissions.query({name:'geolocation'})
let element = GetId("geolocate")
if (status.state === "granted") {
element.innerHTML = "Click here to configure GPS Sorting"
}
else if (status.state === "prompt") {
element.innerHTML = "Click here to set up GPS sorting"
}
else {
element.innerHTML = "Allow location permission to set up GPS sorting"
}
element.addEventListener("click", locationmanager)
element.hidden = ""
    
}());

async function locationmanager(){
let response = await getlocation()
console.log(response)
latitude = response.latitude
longitude = response.longitude
console.log(latitude)
console.log(longitude)

NewList(100, "location")
}
    

function haversine(lat1, lon1, lat2, lon2) { 
  //Haversine Fourmula
  let R = 3959 //Earth's radius in miles
  let dLat = (lat2 - lat1) * Math.PI / 180;
  let dLon = (lon2 - lon1) * Math.PI / 180;
  let a =
    0.5 - Math.cos(dLat) / 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    (1 - Math.cos(dLon)) / 2;

  return R * 2 * Math.asin(Math.sqrt(a));
}
    
function distanceto(lat2, lon2, lat1, lon1) {
    if (isNaN(Number(lat1))) {
      var lat1 = latitude
    }
    if (isNaN(Number(lon1))) {
      var lon1 = longitude
    }
    
    return haversine(lat1, lon1, lat2, lon2)
}

console.log(distanceto(35,-77,-89,-78))
console.log(haversine(35,-77,-89,-78))
    
console.log(distanceto(0,-90,0,90))
console.log(haversine(0,-90,0,90))

    
function locationpromise() {
   return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject)
   });
}
    
async function getlocation() { 
    return locationpromise()
}
    

//Graph Code
//It's Ugly... It should be fixed
//BUT IT WORKS
//AddLine(canvas, horizontal, vertical, color, graphtype, numplace)
    
//canvas - HTML canvas element
//horizontal - array of horizontal values. Pass 0 and it will evenly space.
//vertical - array of vertical values
    
//color - Optional. Color of line. Default black
//graphtype - Optional. Specify 2 to put 2 lines and 2 scales on one graph. See numplace below
    //numplace - Use only if you are using graphtype = 2. 
        //If you specify 0 or do not pass a value, the line's scale will be on the left side of the graph.
        //If you specify 1, the line's scale will be on the right side of the graph.
    
function AddLine(GraphName, timeframe, Source, canvas, horizontal, vertical, color, graphtype, numplace) {
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
  
//Top one
Text = ((Math.max(...calcvertical) - Math.min(...calcvertical))*((i-1)/10))+Math.min(...calcvertical)
if (Text >= 1000) {
Text = Math.round(Text)
}
else {
Text = Text.toFixed(3-String(Math.round(Text)).length)
if (Number(Text) === Math.round(Text)) {
Text = Math.round(Text)
}
}
ctx.fillText(Text, start, 27);
   

    
    
    
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
    
ctx.fillText(starttime, 10, (canvas.height*(11/12))-(canvas.height*0.06)-12)

ctx.textAlign = "end"; 
ctx.fillText(endtime, canvas.width-10, (canvas.height*(11/12))-(canvas.height*0.06)-12)
  
ctx.textAlign = "center"; 
ctx.fillText(midtime, canvas.width/2, (canvas.height*(11/12))-(canvas.height*0.06)-12)

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
    
ctx.fillText("Last 24 Hours: " + fulldayprecip + " in", canvas.width-700, (canvas.height*(11/12))); 
ctx.fillText("Last 12 Hours: " + halfdayprecip + " in", canvas.width-330, (canvas.height*(11/12))); 
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
var grd = ctx.createLinearGradient(0, 0, 0, canvas.height);
grd.addColorStop(0, color);   
grd.addColorStop(1, endcolor);
ctx.strokeStyle = grd;
ctx.fillStyle = grd;
}
 
ctx.fillStyle = "black"
ctx.textAlign = "center"; 
ctx.fillText(Source, canvas.width/2 , canvas.height-10);  
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
ctx.strokeStyle = "#000000AA"
for (var i = 1;i<11;i++) {
    ctx.moveTo(0, height*(11-i)/10)
    ctx.lineTo(canvas.width, height*(11-i)/10)
}
ctx.stroke()
}    
   
