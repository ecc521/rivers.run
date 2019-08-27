window.toDecimalDegrees = function(coord) {
	if (!isNaN(Number(coord))) {
		return Number(coord) //Coordinate is already in decimal form.
	}
	
	if (typeof coord !== "string") {
		return undefined;
	}

	let parts = coord.split(/[^.\w]+/) //Split on non-alphanumeric characters that aren't decimals.
	console.log(parts)
	let direction;
	for (let i=0;i<parts.length;i++) {
		if (["N","S","E","W"].includes(parts[i])) {
			direction = parts[i];
			parts.splice(i, 1)
			break;
		}
	}
	console.log(parts)
	let degrees = Number(parts[0])
	let minutes = Number(parts[1]) || 0
	let seconds = Number(parts[2]) || 0

	minutes += seconds/60
	degrees += minutes/60

	if (isNaN(Number(degrees))) {throw "Coordinate " + coord + " could not be processed."}

	if (direction === "S" || direction === "W") {degrees = -degrees}
	
	return degrees
}



let sortUtils = require("./sort.js")


function normalSearch(list, query, returnBuckets) {
    query = query.toLowerCase().trim()
	
	if (query === "") {return sortUtils.sort("alphabetical", list)} //Don't search for an empty query.
	
	//The first buckets are better matches than later ones.
    let buckets = [[],[],[],[],[],[]]
	let bucket2 = [] //Bucket 2 - index 1 - is special.

	list.forEach(function(event) {
		
		//First bucket
		let nameExactMatch = (event.name.toLowerCase() === query)
		let sectionExactMatch = (event.section.toLowerCase() === query)
				
		
		
		//Second Bucket
		//This bucket is build to handle searches across name and section - such as "Lower Haw"
		//As long as name and section contain all space seperated parts of the query, this bucket can be used.
		let splitter = /[ ,]+/ //Split on spaces and commas. This handles things like "Lower, Lower Yough"
		let words = query.split(splitter)
		let passes = words.every((word) => {
			return (event.name.toLowerCase().indexOf(word) !== -1) || (event.section.toLowerCase().indexOf(word) !== -1)
		})
		
		let nameWords = event.name.toLowerCase().split(splitter)
		let sectionWords = event.section.toLowerCase().split(splitter)
		//For the search "Lower Haw", the Lower Haw should show up higher than Lower Hawksbill Creek.
		//This works by assigning higher relevance to exact matches, then startsWith, than contains.
		let bonus = words.reduce((bonus, word) => {
			//TODO: Consider making .includes() and startsWith worth 7.
			if (nameWords.includes(word)) {
				delete nameWords[nameWords.indexOf(word)] //Remove the word so that is can't be matched twice (ex. text lower, search lower lower)
				return bonus + 5
			}
			else if (sectionWords.includes(word)) {
				delete sectionWords[sectionWords.indexOf(word)]
				return bonus + 5
			}
			else if (event.name.toLowerCase().startsWith(word) || event.section.toLowerCase().startsWith(word)) {
				return bonus + 3
			}
			//If name or section contains word.
			else if ((event.name.toLowerCase().indexOf(word) !== -1) || (event.section.toLowerCase().indexOf(word) !== -1)) {
				return bonus + 1
			}
			return bonus
		}, 0)
		
		
		
		//Thrid bucket
		let nameMatches = event.name.toLowerCase().startsWith(query)
		let sectionMatches = event.section.toLowerCase().startsWith(query)
		let tagsContains = (event.tags.toLowerCase().indexOf(query) !== -1)
		
		//Fourth bucket
		let nameContains = (event.name.toLowerCase().indexOf(query) !== -1)
		
		//Fifth Bucket
		let sectionContains = (event.section.toLowerCase().indexOf(query) !== -1)
		
		//Final Bucket
		let writeupContains = (event.writeup.toLowerCase().indexOf(query) !== -1)
		
		if (nameExactMatch || sectionExactMatch) {buckets[0].push(event)}
		//TODO: Use bucket 1 for even better matches in multi word.
		else if (words.length > 1 && passes) {
			bucket2[bonus] = bucket2[bonus] || []
			bucket2[bonus].push(event)
		}
		else if (nameMatches || sectionMatches || tagsContains) {buckets[2].push(event)}
		else if (nameContains) {buckets[3].push(event)}
		else if (sectionContains) {buckets[4].push(event)}
		else if (writeupContains) {buckets[5].push(event)}
    })
	
	//Sort each match level alphabetically by river name
	buckets = buckets.map((bucket) => {return sortUtils.sort("alphabetical", bucket)})
	
	bucket2.reverse() //Highest relevance ones come first in the second bucket.
	
	if (returnBuckets) {
		buckets[1] = bucket2  //We won't process bucket2 if returnBuckets is set.
		return buckets
	}
	
	for (let i=0;i<bucket2.length;i++) {
		let subbucket = bucket2[i]
		if (subbucket) {
			//Sort the subbucket alphabetically.
			subbucket = sortUtils.sort("alphabetical", subbucket)
			subbucket.forEach((value) => {
				buckets[1].push(value)
			})
		}
	}
	
    return [].concat(...buckets)
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
    delete parameters.content //Cleanup
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

    let min = Math.min(query[0], query[1])
    let max = Math.max(query[0], query[1])

    for (let item in list) {

        let passes = false;
        let skill = skillToNumber(list[item].skill)

        if (min <= skill && skill <= max) {
            passes = true
        }

        if (!passes && !(parameters.includeUnknown && skill === undefined)) {
            //Remove the item if it fails
            delete list[item]
        }
    }

	return list
}










function ratingFilter(list, parameters) {
	console.error("Rating based filtering is not yet implemented")
	return list
}




let calculateDistance = require("./distance.js").lambert //Lambert formula

function locationFilter(list, parameters) {

    let maxDistance = Number(parameters.distance)
    let lat1 = toDecimalDegrees(parameters.lat)
    let lon1 = toDecimalDegrees(parameters.lon)
		
    if (!(maxDistance && lat1 && lon1)) {
        //Cancel the search.
        //Technically we could be missing part of 1 coordinate, sometimes both, and eliminate some rivers, however this goes against
		//the purpose of location sorting - to find rivers, not eliminate them (we want all rivers to have full coordinates)
        return list
    }

    for (let item in list) {
        let river = list[item]

		let lat2 = toDecimalDegrees(river.plat) || toDecimalDegrees(river.tlat) || toDecimalDegrees(river.hidlat)
    	let lon2 = toDecimalDegrees(river.plon) || toDecimalDegrees(river.tlon) || toDecimalDegrees(river.hidlon)
	
		let distance = calculateDistance(lat1, lon1, lat2, lon2)
        		
        let passes = (distance < maxDistance) || parameters.includeUnknown //Follow parameters.includeUnknown unless the river has been eliminated on distance.

        if (!passes) {
            //Remove the item if it does not pass the test.
            delete list[item]
        }
    }
    return list

}


function flowFilter(list, parameters) {

	let query = parameters.query
	let min = query[0]
	let max = query[1]

    //Alert user when an actually useful flow search can't be performed.
    if (window.usgsDataAge === undefined && (max !== 4 || min !== 0)) {
        alert("Searching based on flow requires flow data, which has not fully loaded. The flow search is not being performed.")
        return list
    }

	for (let item in list) {
		let river = list[item]

        if (river.dam && parameters.includeDams) {
            //Do nothing if the river is a dam and dams are to be included.
        }
        //If we do not know flow status, follow parameters.includeUnknown
        else if (river.running === undefined) {
            if (!parameters.includeUnknown) {
                delete list[item]
            }
        }
        //If we do know flow status, filter based on the flow.
		else if (river.running < min || river.running > max) {
			delete list[item]
		}
	}
	return list
}

function tagsFilter(list, parameters) {
	let query = parameters.query
	let components = parameters.query.split(" ").join("").split(",")

	for (let item in list) {
		let river = list[item]

		for (let i=0;i<components.length;i++) {
			if (typeof river.tags !== "string" || !river.tags.toLowerCase().includes(components[i].toLowerCase())) {
				delete list[item]
			}
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



function IDSearch(list, query) {
	if (query === undefined) {return list}

	let components = query.split(",")

	if (components.length === 0) {return list} //No IDs to search for.

	for (let item in list) {
		let river = list[item]
		if (!components.includes(river.id)) {
			delete list[item]
		}
	}
	return list
}




//This doesn't work for difficulty and rating - no greater than or equal to.
//That needs to be added
function advancedSearch(list, query) {
    //List is the array of river elements that we are searching
    //Query is the search parameters
    console.log(recursiveAssign({},query))

    for (let property in query) {
        //Iterate through each part of the query

        let parameters = query[property]

        if (["name", "section", "writeup"].includes(property)) {
            list = stringFilter(list, property, parameters)
        }
        else if (property === "normalSearch" || property === "sort") {
            //These are delt with later
        }
        else if (property === "skill") {
            list = skillFilter(list, parameters)
        }
        else if (property === "rating") {
            list = ratingFilter(list, parameters)
        }
        else if (property === "location") {
            list = locationFilter(list, parameters)
        }
        else if (property === "flow") {
            list = flowFilter(list, parameters)
        }
		else if (property === "tags") {
			list = tagsFilter(list, parameters)
		}
		else if (property === "id") {
			list = IDSearch(list, parameters)
		}
        else {
            alert("Unable to search based on " + property)
        }
    }

	list = list.filter(item => item !== undefined)
    if (query["normalSearch"] !== undefined) {list = normalSearch(list, query["normalSearch"])}
    if (query["sort"]) {list = sortUtils.sort(query["sort"].query, list, query["sort"].reverse)}

    return list
}






export {
    normalSearch,
    advancedSearch
}