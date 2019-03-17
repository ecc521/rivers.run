'use strict';

require("./createNavbar.js")

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



self.addLine = require("./graph.js").addLine

//Defines self.TopBar and self.triangle
Object.assign(self, require("./TopBar.js"))

self.River = require("./River.js").River

//Defines self.alphabeticalsort and self.ratingsort
Object.assign(self, require("./sort.js"))






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
require("./loadUSGS.js").loadUSGS()









//Check if there is a search query
if (window.location.hash.length > 0) {
    let search = window.location.hash.slice(1)
    GetId("searchbox").value = search
    NewList(search, "normal")
}


