'use strict';

try {
require("./allPages.js")
}
catch(e) {console.error(e)}

try {
window.addLine = require("./graph.js").addLine
}
catch(e) {console.error(e)}

//Defines window.TopBar and window.triangle
Object.assign(window, require("./TopBar.js"))

window.River = require("./River.js").River

window.sort = require("./sort.js").sort

//Defines window.normalSearch and window.advanedSearch
Object.assign(window, require("./search.js"))

window.usgsarray = {} 


if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js');
    });
}



//ItemHolder is a list of all the DOM elements objects. New objects should be pushed into the list. 
window.ItemHolder = []
riverarray.map(function(event, index) {
    ItemHolder[index] = new River(index, event)
})


//Fetch data from USGS
//ItemHolder has been filled, so this can be run here (and needs to be.... Otherwise window.usgsarray is undefined)
require("./loadUSGS.js").loadUSGS()


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
//Needs a #Rivers > .riverbutton to get font-size using getComputedStyle
require("./createLegend.js")


NewList("alphabetical", "sort")


let searchbox = document.getElementById("searchbox")
searchbox.addEventListener("keydown", function() {setTimeout(function(){NewList(searchbox.value, "normal")}, 20)})


//Generate advanced search parameters from menu
function getAdvancedSearchParameters() {
    let parameters = {}

    parameters.name = {
        type: document.getElementById("nameType").value,
        query: document.getElementById("nameQuery").value
    }

    parameters.section  = {
        type: document.getElementById("sectionType").value,
        query: document.getElementById("sectionQuery").value
    }

    parameters.writeup = {
        type: document.getElementById("writeupType").value,
        query: document.getElementById("writeupQuery").value
    }
	
	
	
	let distance = Number(document.getElementById("distanceQuery").value)
	
			let lat = document.getElementById("latitudeQuery").value
			let lon = document.getElementById("longitudeQuery").value
			
			//TODO: Parse other latitude and longitude formats
			lat = Number(lat)
			lon = Number(lon)
	
	
	
if (!(distance > 0) && lat && lon) {
	alert("Distance must be a number greater than 0 to use location sorting")
}
else if (distance > 0 && !(lat && lon)) {
	alert("You must enter a latitude and longitude (Get the coordinates from GPS by pressing Calculate my Location)")
}
else if (distance > 0 && lat && lon) {
				parameters.location = {
					lat,
					lon,
					distance,
					includeUnknown: document.getElementById("includeUnknown").checked
				}
			}
	
	
    parameters.skill = {
        type: "from",
        query: [
            Number(document.getElementById("skillQuery1").value),
            Number(document.getElementById("skillQuery2").value)
        ]
    }
	
	
    return parameters
}


async function calculateCoordinates() {
	
	let status = document.getElementById("locationProgress")
	let num = 0
	let progress = setInterval(function() {
		num = (num+1)%6
		status.innerHTML = "Calculating your Approximate Location (Expect this to take 15-60 seconds)" + ".".repeat(num)
	}, 500)
	
	let position;
	try {
		position = await new Promise((resolve, reject) => {
			navigator.geolocation.getCurrentPosition(resolve, reject)
	   });
	}
	catch(e) {
		let output = "Error code " + e.code + " occoured when getting your location. The error message is: " + e.message 
		alert(output)
		clearInterval(progress)
		status.innerHTML = output
	}


	let coords = position.coords
	
		clearInterval(progress)
	
	document.getElementById("latitudeQuery").value = coords.latitude
	document.getElementById("longitudeQuery").value = coords.longitude
	status.innerHTML = "You are within " + coords.accuracy + " meters of " + coords.latitude + " degrees latitude and " + coords.longitude + " degrees longitude."
}

document.getElementById("calculateCoordinates").addEventListener("click", calculateCoordinates)




document.getElementById("performadvancedsearch").addEventListener("click", function() {
    let query = getAdvancedSearchParameters()

    //Add link to this search
    //This should run before NewList - otherwise the entire content is added to the object and URL
    //Find where rivers.run is located
    //This should allow rivers.run to the run from a directory   
    let root = window.location.href
    root = root.slice(0,root.lastIndexOf("/") + 1) //Add 1 so we don't clip trailing slash
    let link = encodeURI(root + "#" + JSON.stringify(query))
    document.getElementById("searchlink").innerHTML = "Link to this search: <a href=\"" + link + "\">" + link + "</a>"

    NewList(query, "advanced", false) //Currently no options are offered to sort or order advanced search
})








//Check if there is a search query
if (window.location.hash.length > 0) {
    let search = decodeURI(window.location.hash.slice(1))

    try {
        //Do an advanced search if the query if an advanced search
        let query = JSON.parse(search)
        
        //TODO: Set the advanced search areas to the query. 
        
        NewList(query, "advanced")


    }
    catch (e) {
        //Looks like we have a normal search query
        document.getElementById("searchbox").value = search
        NewList(search, "normal")
	}
}