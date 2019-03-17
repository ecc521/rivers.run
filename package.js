/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, { enumerable: true, get: getter });
/******/ 		}
/******/ 	};
/******/
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = function(exports) {
/******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		}
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/
/******/ 	// create a fake namespace object
/******/ 	// mode & 1: value is a module id, require it
/******/ 	// mode & 2: merge all properties of value into the ns
/******/ 	// mode & 4: return value when already ns object
/******/ 	// mode & 8|1: behave like require
/******/ 	__webpack_require__.t = function(value, mode) {
/******/ 		if(mode & 1) value = __webpack_require__(value);
/******/ 		if(mode & 8) return value;
/******/ 		if((mode & 4) && typeof value === 'object' && value && value.__esModule) return value;
/******/ 		var ns = Object.create(null);
/******/ 		__webpack_require__.r(ns);
/******/ 		Object.defineProperty(ns, 'default', { enumerable: true, value: value });
/******/ 		if(mode & 2 && typeof value != 'string') for(var key in value) __webpack_require__.d(ns, key, function(key) { return value[key]; }.bind(null, key));
/******/ 		return ns;
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


//Determine if the user wants dark mode
//If prefers-color-scheme does not exist, the user needs to manually select dark/light mode
//If prefers-color-scheme does exist, we follow it, unless the user wants to override it
window.darkMode = localStorage.getItem("prefersDarkMode")
//Convert string to boolean
if (window.darkMode === "null") {window.darkMode = null}
if (window.darkMode === "false") {window.darkMode = false}
if (window.darkMode === "true") {window.darkMode = true}


if (window.darkMode === null) {
    window.darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches
}

//Override browser to engage or disengage dark mode
//This is extremely sensitive to the design of the CSS
//The @media query must be last rule in first stylesheet for this to work
let styleSheet = document.styleSheets[0]
if (window.darkMode === true && window.matchMedia('(prefers-color-scheme: dark)').matches === false) {
    let darkModeRules = styleSheet.rules[styleSheet.rules.length-1].cssText.slice(16,-1).trim().split("\n")
    for (let i=0;i<darkModeRules.length;i++) {styleSheet.insertRule(darkModeRules[i], styleSheet.rules.length)}    
}

if (window.darkMode === false && window.matchMedia('(prefers-color-scheme: dark)').matches === true) {
    styleSheet.removeRule(styleSheet.rules.length - 1)
}



self.addLine = __webpack_require__(1).addLine

//Defines self.TopBar and self.triangle
Object.assign(self, __webpack_require__(2))

self.River = __webpack_require__(3).River

//Defines self.alphabeticalsort and self.ratingsort
Object.assign(self, __webpack_require__(4))






self.GetId = function(Name) {
  return document.getElementById(Name)
}



if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/sw.js');
  });
}

    
    
//ItemHolder is a list of all the DOM elements objects. New objects should be pushed into the list. 
self.ItemHolder = []
riverarray.map(function(event, index) {
    ItemHolder[index] = new River(index, event)
})
    
    
var oldresult;    
window.NewList = function(query, type, reverse) {
    if (typeof(query) === "string") {
    query = query.toLowerCase()
    }
    //Location searching uses numbers.
    
    let orderedlist = ItemHolder.slice(0); //Clone the array
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
          orderedlist = skillsort(orderedlist, reverse)
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
}
    

GetId("Rivers").appendChild(new TopBar().create())
NewList("alphabetical", "sort")

   
GetId("searchbox").addEventListener("keydown", function() {setTimeout(function(){NewList(GetId("searchbox").value, "normal")}, 20)})

    



//Fetch data from USGS
//Put this at the bottom to make sure ItemHolder is filled
__webpack_require__(5).loadUSGS()









//Check if there is a search query
if (window.location.hash.length > 0) {
    let search = window.location.hash.slice(1)
    GetId("searchbox").value = search
    NewList(search, "normal")
}




/***/ }),
/* 1 */
/***/ (function(module, exports) {

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
//If you specify 1, the line's scale will be on the right side of the graph.

module.exports.addLine = function (GraphName, timeframe, Source, canvas, horizontal, vertical, color, graphtype, numplace) {
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


    if (!window.darkMode) {
        ctx.fillStyle = "black"
    }
    else {
        //Dark Mode
        ctx.fillStyle = "#cccccc"
    }    



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
        ctx.fillStyle = "#cccccc"
    }

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


/***/ }),
/* 2 */
/***/ (function(module, exports) {

//Auxillary Function        
//True means pointing up, false means pointing down
function triangle(facing) {
  //Most values in this function are arbitrary
  let scale = window.innerWidth/750
  scale = scale ** 0.5 //Square Root to make difference smaller
  
  let div = document.createElement("div")
  div.style.width = 0;
  div.style.height = 0;
  div.style.display = "inline-block";
  div.style.borderLeft = 4*scale + "px solid transparent"
  div.style.borderRight = 4*scale + "px solid transparent"
  div.style.marginLeft = 1.5*scale + "px"
  //If triangle is pointing up
  if (facing) {
    div.style.borderBottom = 8*scale + "px solid black"
  }
  else {
    div.style.borderTop = 8*scale + "px solid black"
  }
  return div;
}

function TopBar() {
    this.create = function() {
        let button = document.createElement("button")
        button.id = "topbar"
        button.className = "riverbutton"
      
        //Auxillary Function
        function NewSpan(Text) {
          let span = document.createElement("span")
          span.className = "riverspan"
          span.innerHTML = Text
          return span
        }
        
        //Auxillary Function
        //Elem is the span element. If facing is true, set triangle to up, else down
        function settri(elem, facing) {
          elem.lastChild.remove()
          elem.appendChild(triangle(facing))
        }
      
      
        let span = NewSpan("River")
        span.appendChild(triangle(true))

        span.onclick = function() {
          if (this.value) {
            settri(this, false)
            NewList("alphabetical", "sort", true)
            this.value = 0
          }
          else {
            settri(this, true)
            NewList("alphabetical", "sort")
            this.value = 1
          }
        }
        span.value = 1//Starts sorted alphabetically, a-z. The first sort needs to flip that.
        button.appendChild(span)
        
        
        button.appendChild(NewSpan("Section"))

        
        span = NewSpan("Skill")
        span.appendChild(triangle(true))
        span.onclick = function() {
            if (this.value === 1) {
                NewList("skill", "sort", true)
                settri(this, false)
                this.value = 0
            }
            else {
                NewList("skill", "sort")
                settri(this, true)
                this.value = 1
            }
        }
        span.value = 0
        button.appendChild(span) 
        
        span = NewSpan("Rating")
        span.appendChild(triangle(true))

        span.onclick = function() {
                if (this.value === 1) {
                    NewList("rating", "sort", true)
                    settri(this, true)
                    this.value = 0
                }
                else {
                    NewList("rating", "sort")
                    settri(this, false)
                    this.value = 1
                }
        }
        span.value = 0
        button.appendChild(span) 
        
        button.appendChild(NewSpan("Flow Info"))

        return button
    }
    
    this.delete = function() {
        let Node = GetId("topbar")
        if (Node) {
            Node.parentNode.removeChild(Node)
        }
    }
}


module.exports = {
    triangle,
    TopBar
}

/***/ }),
/* 3 */
/***/ (function(module, exports) {

    
module.exports.River = function(locate, event) {
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
      
      
      
    if (this.flow) {
      AddSpan(this.flow)
    }
    button.className = "riverbutton"
      
    
    button.onclick = function () {
        let river = ItemHolder[locate]
        if (river.expanded === 0) {
        river.expanded = 1
        var div = document.createElement("div")
        div.innerHTML = river.writeup + "<br>"
                  
        if (river.plat && river.plon) {
            div.innerHTML += "<br>Put-In GPS Coordinates: " + river.plat + ", " + river.plon
        }
        
        if (river.tlat && river.tlon) {
            div.innerHTML += "<br>Take-Out GPS Coordinates: " + river.tlat + ", " + river.tlon
        }
            
        if (river.aw) {
            div.innerHTML += "<br><br><a href='https://www.americanwhitewater.org/content/River/detail/id/" + river.aw + "'>Click here to view this river on American Whitewater</a>"
        }

        //Graph
        let data;
        if (self.usgsarray) {
          data = self.usgsarray[river.usgs] 
        }
        
        //The graphing is wrapped in a try-catch statement because USGS often supplies invalid data
        //for a specific river due to gauge problems.
        //Each canvas is wrapped individually because sometimes only some graphs have invalid data
          if (data) {
              div.innerHTML += "<br><br>" //Space the first canvas

              let temp = data["00010"]
              let precip = data["00045"]
              let cfs = data["00060"]
              let height = data["00065"]


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

              //Auxillary Function
              function createcanvas() {
                  let canvas = document.createElement("canvas")
                  canvas.width = 1200
                  canvas.height = 800 
                  
                  //Make sure the background is not transparent
                  let ctx = canvas.getContext("2d");
                  if (!window.darkMode) {
                      ctx.fillStyle = "white";
                  }
                  else {
                      //Dark Mode
                      ctx.fillStyle = "black"
                  }
                  ctx.fillRect(0, 0, canvas.width, canvas.height);

                return canvas
              }

              try {
                  if (cfs||height) {
                      let canvas1 = createcanvas()

                      if (cfs && height) {
                          let parts = toparts(cfs.values)
                          addLine("cfs", parts.timestamps, data.name, canvas1, 0, parts.values, "#00AAFFa0", 2)
                          parts = toparts(height.values)
                          addLine("height", parts.timestamps, data.name, canvas1, 0, parts.values, "#2222FFa0", 2, 1)                
                      }
                      else if (cfs) {
                          let parts = toparts(cfs.values)
                          addLine("cfs", parts.timestamps, data.name, canvas1, 0, parts.values, "#00AAFF")
                      }
                      else {
                          let parts = toparts(height.values)
                          addLine("height", parts.timestamps, data.name, canvas1, 0, parts.values, "#2222FF")    
                      }

                      //For some reason, only the last canvas was showing. Use images
                      //Images also allow "Save Image As"
                      let img = document.createElement("img")
                      img.className = "graph"
                      //Blobs may be faster - but I don't know of a synchronus method
                      img.src = canvas1.toDataURL("image/png")

                      div.appendChild(img)
                  }
              }
              catch(e){console.warn("Graphing Error: " + e)}
              
              try {
                 if (temp) {
                      let canvas2 = createcanvas()

                      let parts = toparts(temp.values)
                      addLine("", parts.timestamps, data.name, canvas2, 0, parts.values, "#FF0000", 3, "#0000FF")

                      //For some reason, only the last canvas was showing. Use images
                      //Images also allow "Save Image As"
                      let img = document.createElement("img")
                      img.className = "graph"
                      img.src = canvas2.toDataURL("image/png")
                      div.appendChild(img)
                  }
              }
              catch(e){console.warn("Graphing Error: " + e)}
              
              try {
                  if (precip) {
                      let canvas3 = createcanvas() 

                      let parts = toparts(precip.values)
                      addLine("Precipitation", parts.timestamps, data.name, canvas3, 0, parts.values, "#0066FF")

                      //For some reason, only the last canvas was showing. Use images
                      //Images also allow "Save Image As"
                      let img = document.createElement("img")
                      img.className = "graph"
                      img.src = canvas3.toDataURL("image/png")
                      div.appendChild(img)
                  }
              }
              catch(e){console.warn("Graphing Error: " + e)}
          }
        //End of Graph
            
        div.style.padding = "6px"
        div.id = river.base + 2
        if (!window.darkMode) {
            button.style.backgroundColor = "#e3e3e3"
        }
        else {
            //Dark Mode
            button.style.backgroundColor = "#333333"
        }
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
        
    
    
    //Make content available to Googlebot for indexing
    if (navigator.userAgent.toLowerCase().indexOf("google") !== -1) {
        try {
            setTimeout(function(){button.dispatchEvent(new Event("click"))}, 100)
        }
        catch(e) {}
    }
    //The code directly above this is used to allow Googlebot to index content. 
    //Shall it result in an SEO hit, or shall Googlebot be improved to handle content inside of JavaScript,
    //It can safely be removed.    
    
    
    //Store button for reuse later   
    this.finished = button
        
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
    


/***/ }),
/* 4 */
/***/ (function(module, exports) {

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


function skillsort(orderedlist, reverse) {
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
    
    return orderedlist
}



module.exports = {
    ratingsort,
    alphabeticalsort,
    skillsort,
}

/***/ }),
/* 5 */
/***/ (function(module, exports) {

module.exports.loadUSGS = async function() {
    
    var sites = []
    for (let i=0;i<riverarray.length;i++) {
        let val = riverarray[i].usgs
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
      
        if (obj2.values.length === 0) {
          console.log("Empty Array. Skipping")
          return;
        }
      
        obj2.units = event.variable.variableDescription //Units of values
        
        let sitecode = event.sourceInfo.siteCode[0].value
        //See if the site is already in the array.
        //If the site code is not in the array, add it. 
        if (!usgsarray[sitecode]) {
            let obj3 = {}
            obj3.name = event.sourceInfo.siteName
            usgsarray[sitecode] = obj3
        }
      
        let variablecode = event.variable.variableCode[0].value

        //Convert celcius to farenheight
        if (variablecode === "00010" && obj2.units === "Temperature, water, degrees Celsius") {
          for (let i=0;i<obj2.values.length;i++) {
            obj2.values[i].value = obj2.values[i].value * 1.8 + 32
          }
          
          obj2.units = "Temperature, water, degrees Fahrenheit"
        }
      
         
        //Add the values onto the site code object
        usgsarray[sitecode][variablecode] = obj2
    })
  
    //Add USGS Data to Graph
    for (let i=0;i<ItemHolder.length;i++) {
      let item = ItemHolder[i]
      let data = usgsarray[item.usgs]
      
      if (data) {
        let cfs = data["00060"]
        let feet = data["00065"]
        
        //Prevent "TypeError: Can't Read Property 'values' of undefined"
        if (cfs) {cfs = cfs.values}
        if (feet) {feet = feet.values}

        if (cfs && feet) {
          item.flow = cfs[cfs.length - 1].value + " cfs, " + feet[feet.length - 1].value + " ft"
        }
        else if (cfs) {
          item.flow = cfs[cfs.length - 1].value + " cfs"
        }
        else if (feet) {
          item.flow = feet[feet.length - 1].value + " ft" 
        }

        //item.create(true) will force regeneration of the button
        //Replace the current button so that the flow info shows 
        let elem = GetId(item.base + "1")
        let expanded = item.expanded
        console.log(expanded)
        let replacement = item.create(true) //Update the version in cache
        try {
            elem.parentNode.replaceChild(replacement, elem)
            //If the river was expanded before, keep it expanded
            if (expanded) {
                replacement.dispatchEvent(new Event("click"))
                //For some reason, the automatically opened buttons and the manually opened buttons behave different.
                if (navigator.userAgent.toLowerCase().indexOf("google") === -1) {
                    replacement.dispatchEvent(new Event("click"))
                }
            }
        }
        catch (e) {} //The list must have been sorted - the node was not currently in list
      }
    }
    
}

/***/ })
/******/ ]);
//# sourceMappingURL=package.js.map