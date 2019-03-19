'use strict';

require("./allPages.js")


self.addLine = require("./graph.js").addLine

//Defines self.TopBar and self.triangle
Object.assign(self, require("./TopBar.js"))

self.River = require("./River.js").River

self.sort = require("./sort.js").sort

//Defines self.normalSearch and self.advanedSearch
Object.assign(self, require("./search.js"))




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
            
            orderedlist = sort(query, orderedlist, reverse)
        }
        if (type === "normal") {
            orderedlist = normalSearch(orderedlist, query)
        }
        if (type === "advanced") { 
            orderedlist = advancedSearch(orderedlist, query)
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
    var div = document.getElementById("Rivers")
    //Everything else    
    orderedlist.forEach(function(event){
        div.appendChild(event.create())
    })

    if (type !== "sort") {
        oldresult = orderedlist
    }
}


document.getElementById("Rivers").appendChild(new TopBar().create())
NewList("alphabetical", "sort")


document.getElementById("searchbox").addEventListener("keydown", function() {setTimeout(function(){NewList(document.getElementById("searchbox").value, "normal")}, 20)})





//Fetch data from USGS
//Put this at the bottom to make sure ItemHolder is filled
require("./loadUSGS.js").loadUSGS()









//Check if there is a search query
if (window.location.hash.length > 0) {
    let search = window.location.hash.slice(1)
    document.getElementById("searchbox").value = search
    NewList(search, "normal")
}


