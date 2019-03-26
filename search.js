function normalSearch(list, query) {
    let l = [[],[],[],[],[]]
    list.forEach(function(event){
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

    list = l[0].concat(l[1],l[2],l[3])

    //Add the less relevant results below
    list = list.concat(l[4])
    
    return list
}











function stringQuery(parameters) {
    
    let content = parameters.content
    let query = parameters.query
    
    //Ignore case by default
    if (!parameters.matchCase) {
        content = content.toLowerCase()
        query = query.toLowerCase()
    }
    
    if (parameters.type === "contains") {
        return content.includes(query)
    }
    else if (parameters.type === "matches") {
        return content === query
    }
    else {
        throw "Unknown Search Type " + parameters.type
    }
}


function stringFilter(list, property, parameters) {
		//Filter out the elements that fail the test
        //Since we may be deleting elements in the list, items will be skipped if we use array.length
        for (let item in list) {
			parameters.content = list[item][property]
            let passes = stringQuery(parameters)
            if (!passes) {
                //Remove the item if it fails
                delete list[item]
            }
        }
	return list
}



function skillToNumber(skill) {
	let value
            switch (skill) {
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
            }
	return value
}






function skillFilter(list, parameters) {
	
	let query = parameters.query
	let type = parameters.type
	
        for (let item in list) {

			let passes = false;
			let skill = skillToNumber(list[item].skill)
			
			if (type === "max") {
				if (skill <= query) {
					passes = true
				}
			}
			else if (type === "min") {
				if (skill >= query) {
					passes = true
				}
			}
			else if (type === "exactly") {
				if (skill === query) {
					passes = true
				}
			}
			else if (type === "from") {
				if (skill >= query[0] && skill <= query[1]) {
					passes = true
				}
			}
			else {throw "Unknown search type" + type}
			
			
            if (!passes) {
                //Remove the item if it fails
                delete list[item]
            }
        }	
}










function ratingFilter(list, parameters) {
	
}




let calculateDistance = require("./distance.js").lambert //Lambert formula

function locationFilter(list, parameters) {
	
	let maxDistance = parameters.distance
	let lat1 = parameters.lat
	let lon1 = parameters.lon
	
		//Filter out the elements that fail the test
        //Since we may be deleting elements in the list, items will be skipped if we use array.length
        for (let item in list) {
			let river = list[item]
			
			let lat2 = river.plat || river.tlat || river.hidlat
			let lon2 = river.plon || river.tlon || river.hidlon
			
			
			let passes;
			if (lat2 && lon2) {
				let distance = calculateDistance(lat1, lon1, lat2, lon2)
				
				passes = distance < maxDistance
			}
			else {
				//TODO: If we only have one of two coordinates, we may still be able to eliminate it
				passes = parameters.includeUnknown
			}

            if (!passes) {
                //Remove the item if it fails
                delete list[item]
            }
        }
	return list
	
}

//Query is in form of:
//{
  //  name: {
    //    type: "matches",
    //    query: "potomac"
    //},
    //section: {
    //    type: "contains",
    //    query: "something"
  //  },
// skill: {
//	type:"" //easier harder exactly from
//	value: 3 //An array of 2 if from
//from is inclusive (From medium to hard)
//},
//location:{
//	distance: 100 //Maximum distance in miles
//	lat: 78//Starting latitude
//	lon:-56 //Starting londitude
//	includeUnknown: false //Do not eliminate if location not known 
//}
//}



//This doesn't work for difficulty and rating - no greater than or equal to.
//That needs to be added
function advancedSearch(list, query) {
    //List is the array of river elements that we are searching
	//Query is the search parameters
    console.log(query)

    for (let property in query) {
		//Iterate through each part of the query
		
		let parameters = query[property]
		
		
		if (["name", "section", "writeup"].includes(property)) {
			stringFilter(list, property, parameters)
		}
		else if (property === "skill") {
			skillFilter(list, parameters)
		}
		else if (property === "rating") {
			ratingFilter(list, parameters)
		}
		else if (property === "location") {
			locationFilter(list, parameters)
		}
		else if (property === "sort") {
			
		}
		else {
			alert("Unable to search based on " + property)
		}
		
		

		
		
    }
    
    return list
}






module.exports = {
    normalSearch,
    advancedSearch
}






//Prepare the Advanced Search button
let advanced_search_modal = document.getElementById('advanced-search-modal');

let span = document.getElementById("advanced-search-modal-close").onclick = function() {
	advanced_search_modal.style.display = "none"
}

window.addEventListener("click", function(event) {
    if (event.target === advanced_search_modal) {
        advanced_search_modal.style.display = "none"
    }
})

document.getElementById("advancedsearch").addEventListener("click", function() {
    advanced_search_modal.style.display = "block"
})




