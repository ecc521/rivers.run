'use strict';

//This code has 2 dependencies:
//graph.js
//riverarray.js

function GetId(Name) {
  return document.getElementById(Name)
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/sw.js');
  });
}

//Fetch data from USGS
(async function() {
    
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
        elem.parentNode.replaceChild(item.create(true), elem)
      }
    }
    
}())

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
        
        button.appendChild(NewSpan("Miles"))
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
      
      
    AddSpan(this.length)
      
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
        
        //Put the whole canvas code in a try statement
        //If not, USGS gauge errors will prevent river from opening when clicked
        try {
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

                  //Set background to white
                  let ctx = canvas.getContext("2d");
                  ctx.fillStyle = "white";
                  ctx.fillRect(0, 0, canvas.width, canvas.height);

                return canvas
              }

              if (cfs||height) {
                  let canvas1 = createcanvas()

                  if (cfs && height) {
                      let parts = toparts(cfs.values)
                      addline("cfs", parts.timestamps, data.name, canvas1, 0, parts.values, "#00AAFF80", 2)
                      parts = toparts(height.values)
                      addline("height", parts.timestamps, data.name, canvas1, 0, parts.values, "#0000FF80", 2, 1)                
                  }
                  else if (cfs) {
                      let parts = toparts(cfs.values)
                      addline("cfs", parts.timestamps, data.name, canvas1, 0, parts.values, "#00AAFF80")
                  }
                  else {
                      let parts = toparts(height.values)
                      addline("height", parts.timestamps, data.name, canvas1, 0, parts.values, "#0000FF80")    
                  }

                  //For some reason, only the last canvas was showing. Use images
                  //Images also allow "Save Image As"
                  let img = document.createElement("img")
                  img.className = "graph"
                  img.src = canvas1.toDataURL("image/png")

                  div.appendChild(img)
              }

              if (temp) {
                  let canvas2 = createcanvas()

                  let parts = toparts(temp.values)
                  addline("", parts.timestamps, data.name, canvas2, 0, parts.values, "#FF0000", 3, "#0000FF")

                  //For some reason, only the last canvas was showing. Use images
                  //Images also allow "Save Image As"
                  let img = document.createElement("img")
                  img.className = "graph"
                  img.src = canvas2.toDataURL("image/png")
                  div.appendChild(img)
              }

              if (precip) {
                  let canvas3 = createcanvas() 

                  let parts = toparts(precip.values)
                  addline("Precipitation", parts.timestamps, data.name, canvas3, 0, parts.values, "#0066FF80")

                  //For some reason, only the last canvas was showing. Use images
                  //Images also allow "Save Image As"
                  let img = document.createElement("img")
                  img.className = "graph"
                  img.src = canvas3.toDataURL("image/png")
                  div.appendChild(img)
              } 
          }
        }catch(e){console.warn("Graphing Error: " + e)}
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

    
