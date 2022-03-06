const toDecimalDegrees = require("./toDecimalDegrees.js")
let sortUtils = require("./sort.js")


function normalSearch(list, query, options = {}) {
    query = query.toLowerCase().trim()

	if (query === "") {return sortUtils.sort("alphabetical", list)} //Don't search for an empty query.

	//The first buckets are better matches than later ones.
    let buckets = [[],[],[],[],[],[],[]]
	let bucket2 = [] //Bucket 2 - index 1 in buckets - is special.

    let splitPhrase;
	//Core-js polyfills used to cause some deoptimizations.
	//If such deoptimizations happen again, change the default from using regexpSplit to not using regexpSplit.
    if (options.regexpSplit !== false) {
        //This is faster when using the native regexp engine.
        splitPhrase = function splitPhrase(phrase) {
            return phrase.split(/[ ,]+/)
        }
    }
    else {
        //corejs regexp polyfill is making it take 40 times longer to split with the regex /[ ,]+/ than using .split(",").join(" ").split(" ")
		//It appears like core-js is causing V8 to drop off the regexp fast path.
        splitPhrase = function splitPhrase(phrase) {
            return phrase.split(",").join(" ").split(" ")
        }
    }

	list.forEach(function(event) {

		let lowerCaseName = event.name.toLowerCase()
		let lowerCaseSection = event.section.toLowerCase()


		//First bucket
		let nameExactMatch = (lowerCaseName === query)
		let sectionExactMatch = (lowerCaseSection === query)

		if (nameExactMatch || sectionExactMatch) {
			buckets[0].push(event)
			return
		}


		//Second Bucket
		//This bucket is build to handle searches across name and section - such as "Lower Haw"
		//As long as name and section contain all space seperated parts of the query, this bucket can be used.

		//Split on spaces and commas. This handles things like "Lower, Lower Yough"
		let words = splitPhrase(query)

		if (words.length > 1) {
			let passes = words.every((word) => {
				return (lowerCaseName.indexOf(word) !== -1) || (lowerCaseSection.indexOf(word) !== -1)
			})

			let nameWords = splitPhrase(lowerCaseName)
			let sectionWords = splitPhrase(lowerCaseSection)
			//For the search "Lower Haw", the Lower Haw should show up higher than Lower Hawksbill Creek.
			//This works by assigning higher relevance to exact matches, then startsWith, than contains.
			let bonus = words.reduce((bonus, word) => {
				//TODO: Consider making .includes() and startsWith worth 7.
				if (nameWords.includes(word)) {
					delete nameWords[nameWords.indexOf(word)] //Remove the word so that is can't be matched twice (ex. text lower, search lower lower)
					return bonus + 10
				}
				else if (sectionWords.includes(word)) {
					delete sectionWords[sectionWords.indexOf(word)]
					return bonus + 10
				}
				else if (lowerCaseName.startsWith(word) || lowerCaseSection.startsWith(word)) {
					return bonus + 6
				}
				//If name or section contains word.
				else if ((lowerCaseName.indexOf(word) !== -1) || (lowerCaseSection.indexOf(word) !== -1)) {
					return bonus + 2
				}
				return bonus
			}, 0)

			//If the total number of words in the query are equal to the number of words in name and section (so all words matched), add one point.
			//This makes things like the Lower Yough show up above the Lower Lower Yough for the search Lower Yough
			if (bonus && nameWords.length + sectionWords.length === words.length) {bonus += 1}

			if (passes) {
				bucket2[bonus] = bucket2[bonus] || []
				bucket2[bonus].push(event)
				return;
			}
		}

		//Thrid bucket
		let nameMatches = lowerCaseName.startsWith(query)
		let sectionMatches = lowerCaseSection.startsWith(query)

		if (nameMatches || sectionMatches) {
			buckets[2].push(event)
			return;
		}

		if (options.strongMatchesOnly) {
			//If only strong matches were requested, return.
			//This should have an option to also include tags.
			return
		}

		//Fourth bucket
		let tagsContains = (event.tags.toLowerCase().indexOf(query) !== -1)

		if (tagsContains) {
			buckets[3].push(event)
			return;
		}


		//Fifth bucket
		let nameContains = (lowerCaseName.indexOf(query) !== -1)

		if (nameContains) {
			buckets[4].push(event)
			return;
		}

		//Sixth Bucket
		let sectionContains = (lowerCaseSection.indexOf(query) !== -1)

		if (sectionContains) {
			buckets[5].push(event)
			return;
		}

		//Final Bucket
		let writeupContains = (event.writeup.toLowerCase().indexOf(query) !== -1)

		if (writeupContains) {buckets[6].push(event)}
    })

	//Sort each match level alphabetically by river name
	buckets = buckets.map((bucket) => {
		return sortUtils.sort("alphabetical", bucket)
	})

	bucket2.reverse() //Highest relevance ones come first in the second bucket.

	let topMatches = (buckets[0] && buckets[0].length > 0 && buckets[0]) ||
		bucket2[bucket2.findIndex((value,index) => {if (value.length > 0) {return true}})] ||
		buckets[buckets.findIndex((value,index) => {if (index > 1 && value.length > 0) {return true}})]


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

    let result = [].concat(...buckets)

	result.buckets = buckets
	result.topMatches = topMatches

	return result
}


function stringQuery(parameters) {

    let content = parameters.content
    let query = parameters.query

    //Ignore case by default
    if (!parameters.matchCase) {
        content = content?.toLowerCase() || ""
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

        let firstAccess = river.access?.[0]

		let lat2 = firstAccess?.lat
		let lon2 = firstAccess?.lon

        //calculateDistance returns NaN if calculations can't be performed. 
		let distance = calculateDistance(lat1, lon1, lat2, lon2)

        if (
            (distance > maxDistance)
            || (isNaN(distance) && !parameters.includeUnknown)
        ) {
            //Remove the item - too far.
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
	let components = parameters.query.toLowerCase().split(" ").join("").split(",")

	for (let item in list) {
		let river = list[item]

		for (let i=0;i<components.length;i++) {
			if (!river.tags.toLowerCase().includes(components[i])) {
				delete list[item]
			}
		}
	}
	return list
}


function stateFilter(list, parameters) {
	if (parameters.query.length === 0) {return list}
	let components = parameters.query.toLowerCase().split(/[ ,]+/)

	for (let item in list) {
		let river = list[item]

		let passes = false

		for (let i=0;i<components.length;i++) {
			if (river.state && components[i] && river.state.toLowerCase().includes(components[i])) {
				passes = true
				break;
			}
		}

		if (!passes) {delete list[item]}
	}
	return list
}


function ratingFilter(list, parameters) {

	let query = parameters.query
	let min = query[0]
	let max = query[1]

	for (let item in list) {
		let river = list[item]

        if (river.rating === "Error" && !parameters.includeUnknown) {
			delete list[item]
		}
		else if (Number(river.rating) < min || Number(river.rating) > max) {
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
		else if (property === "state") {
			list = stateFilter(list, parameters)
		}
		else if (property === "id") {
			list = IDSearch(list, parameters)
		}
        else {
            alert("Unable to search based on " + property)
        }
    }

	list = list.filter(item => item !== undefined)
	console.time("normalSearch")
    if (query["normalSearch"] !== undefined) {list = normalSearch(list, query["normalSearch"])}
	console.timeEnd("normalSearch")
    if (query["sort"]) {list = sortUtils.sort(query["sort"].query, list, query["sort"].reverse)}

	let gaugesList = []
	if (list.buckets) {
		gaugesList = gaugesList.concat(...list.buckets.slice(0,3)) //Buckets 0, 1 and 2
	}
	else {
		gaugesList = list
	}

	let riverAmount = gaugesList.reduce((total, river) => {return total + (!river.isGauge ? 1:0)}, 0) //Number of good river matches.

	if (list.buckets) {
		let additionalRivers = ([].concat(...list.buckets.slice(3))).reduce((total, river) => {return total + (!river.isGauge ? 1:0)}, 0)
		list.gaugeAmount = list.length - riverAmount - additionalRivers
		list.riverAmount = riverAmount + additionalRivers

	}
	else {
		list.gaugeAmount = list.length - riverAmount
		list.riverAmount = riverAmount
	}

	if (riverAmount === 0) {list.useGauges = true}
	else {list.useGauges = false}

    return list
}






module.exports = {
    normalSearch,
    advancedSearch
}
