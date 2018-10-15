'use strict';

function GetId(Name) {
  return document.getElementById(Name)
}

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
    
    
    
    
    
    
    
    

    


    
(async function() {
var sites = ["03069500", "03081500"]
var reply = "https://waterservices.usgs.gov/nwis/iv/?format=json&sites=" + sites.join(",") +  "&startDT=" + new Date(Date.now()-1000*86400).toISOString()  + "&parameterCd=00060,00065,00010,00045&siteStatus=all"
    
reply = await fetch(reply)
//var reply = await fetch("https://rivers.run/resources/USGSTesting.json")
reply = await reply.json()
    
  
 console.log(reply)   
    
    
    
reply.value.timeSeries.forEach(function(event){
    let Source = event.sourceInfo
    let Str = Source.siteName
    let Values = event.values[0].value
    Source = Source.siteCode[0]
    Str += " - " + Source.agencyCode
    let USGS = Source.value
    Str += " " + USGS
    
    console.log(Values)
    console.log(Str)
    console.log(event.variable.variableDescription)
})
    
}())

    
    
    
//ItemHolder is a list of all the DOM elements objects. New objects should be pushed into the list. 
var ItemHolder = []
riverarray.map(function(event, index) {
    ItemHolder[index] = new River(index, event)
})
    

    
    
var oldresult;    
function NewList(query, type, reverse) {
    if (typeof(query) === "string") {
    query = query.toLowerCase()
    }
    //Location searching uses numbers.
    
    let OrderedList = ItemHolder;
    if (!(String(query).length === 0 || !query || !type)) {
    if (type === "sort") {
        
    if (oldresult) {
        OrderedList = oldresult
    }   
    if (query === "alphabetical") {
    function compare(a,b) {
    if (a.name < b.name)
        return -1;
    if (a.name > b.name)
        return 1;
    return 0;
    }
    OrderedList.sort(compare);
    if (reverse) {
        OrderedList.reverse()
    }
    }
    else if (query === "rating") {
    function compare(a,b) {
    if (a.rating > b.rating)
        return -1;
    if (a.rating < b.rating)
        return 1;
    return 0;
    }
    OrderedList.sort(compare);
    if (reverse) {
         OrderedList.reverse()
    }
    while (OrderedList[0].rating === "Error") {
        OrderedList.push(OrderedList.shift())
    }  
    }
    else if (query === "skill") {
    OrderedList.sort(function(a,b) {
    
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
    OrderedList.reverse()
    while (OrderedList[0].skill === "?") {
        OrderedList.push(OrderedList.shift())
    }
    }      
    }      
    }
        
        
    if (type === "normal") {
        let l = [[],[],[],[],[]]
        OrderedList.forEach(function(event){
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
        
        OrderedList = l[0].concat(l[1],l[2],l[3])
        
        //Add the less relevant results below
        OrderedList = OrderedList.concat(l[4])
        
        
        
    }
        
        
        
        
    if (type === "advanced") {  
    }    
        
    if (type === "location") {
    if (oldresult) {
        OrderedList = oldresult
    }
    
    var nlist = []
    OrderedList.forEach(function(value){
        if (value.plat && value.plon) {
             if (distanceto(value.plat, value.plon) < query) {
                 nlist.push(value)
             }
        }
    })
    OrderedList = nlist

    
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
    OrderedList.forEach(function(event){
        div.appendChild(event.create())
    })
     
    if (type !== "sort") {
        oldresult = OrderedList
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
    
    
   
