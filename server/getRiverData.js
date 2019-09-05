const fs = require("fs")
const path = require("path")

const utils = require(path.join(__dirname, "utils.js"))

let normalSearch = require(path.join(utils.getSiteRoot(), "src", "search.js")).normalSearch

function getAssistantReply(name, sentence) {
	let riverarray = JSON.parse(fs.readFileSync(path.join(utils.getSiteRoot(), "riverdata.json"), {encoding:"utf8"}))

	if (sentence) {
		
		//Sometimes Google Assistant adds a space between rivers and .Run
		sentence = sentence.split(/Ask rivers\s?.run for /i).join("")
		sentence = sentence.split(/Ask rivers\s?.run /i).join("")

		let matchers = [
			/(?:flow\s|water\s|level\s)+(?:of\s)?([^.]+)/i,
			/(.+?)\s(?:flow|water|level)+/i
		]
		
		let results = []
		matchers.forEach((regex) => {
			let match = regex.exec(sentence)
			if (match) {
				let str = match[1]
				//Sometimes the first regexp will match Water in Water Level
				if (!str.match(/water|level|flow|of/i)) {
					results.push(str)
				}
				else {console.log("Rejected " + str)}
			}
		})
		
		if (results[0]) {
			name = results[0]
		}
		
		if (results.length > 1) {
			console.log(results)
		}
	}
	
	//Delete the words river and section (plus the leading space), if it exists in any casing.
	name = name.split(/ river/i).join("")
	name = name.split(/the /i).join("")
	let responseName = name
	name = name.split(/ section/i).join("")
	
	let topRanked = []

	let buckets = normalSearch(riverarray, name, true)
	
	//Use the highest ranked river in bucket 2 (index 1).
	topRanked = buckets[0]
	if (topRanked.length === 0) {
		topRanked = buckets[1][0]
	}
	if (!topRanked) {
		topRanked = buckets[2]
	}

	let flowData = JSON.parse(fs.readFileSync(path.join(utils.getSiteRoot(), "flowdata2.json"), {encoding:"utf8"}))

	let alwaysStart = "<speak>"
	let ender = "<break time=\"1s\"/>If you have more questions, feel free to ask! Otherwise, you can say \"exit\" to close rivers.run. </speak>"
	
	//TODO: Ask the user to break ties if multiple rivers in topRanked.

	//Don't use the word "The " for creeks, or when section was labeled.
	//Consider using the original name here - so before the word "River" was removed.
	let useThe = true
	if (responseName.toLowerCase().includes(" creek") || responseName.toLowerCase().includes("section ")) {
		useThe = false
	}
	
	let queryResult = {
		responseName,
		search: name
	}
	if (topRanked && topRanked.length > 0) {queryResult.riverid = topRanked[0].id}
	
	let starter = alwaysStart + (useThe?"The ":"") + responseName
	if (topRanked === undefined || topRanked.length === 0) {
		queryResult.ssml = starter + " does not exist on rivers.run. Open rivers.run<say-as interpret-as=\"characters\">/FAQ</say-as> in your browser to learn how to add it. " + ender
		return queryResult
	}
	
	
	
	if (topRanked.length > 1) {
		let start;
		for (let i=0;i<topRanked.length;i++) {
			start = start || topRanked[i].usgs
			if (topRanked[i].usgs !== start) {
				//If section is 1 word long, put section before name. Otherwise, put name before section.
				let sectionFirst = ["bottom", "bottom bottom", "lower", "middle", "upper", "top", "tip top", "upper upper", "top"].includes(topRanked[0].section.trim().toLowerCase())
				let selectedRiverName = sectionFirst?(topRanked[0].section + " " + topRanked[0].name):(topRanked[0].name + " " + topRanked[0].section)
				starter = alwaysStart + topRanked.length + " sections of river matched the search " + responseName + ". Picking " + selectedRiverName + ". <break time=\"0.5s\"/>" + starter
				break;
			}
		}
	}
	
	let gauge;
	let cfs;
	let feet;
	try {
		gauge = flowData[topRanked[0].usgs]
		try {
			feet = gauge.feet[gauge.feet.length-1].value
		}
		catch(e) {console.error(e)}
		try {
			cfs = gauge.cfs[gauge.cfs.length-1].value
		}
		catch(e) {console.error(e)}
	}
	catch(e) {console.error(e)}

	if (!topRanked[0].usgs) {
		queryResult.ssml = starter + " has no gauge on rivers.run. You can open rivers.run<say-as interpret-as=\"characters\">/FAQ</say-as> in your browser to learn how to add a gauge. " + ender
		return queryResult
	}
	else if (!cfs && !feet) {
		if (gauge) {
			queryResult.ssml = starter + " does not have a working gauge. If " + gauge.name + " is not the correct gauge, you can open rivers.run<say-as interpret-as=\"characters\">/FAQ</say-as> in your browser to learn how to update the gauge. " + ender
		}
		else {
			//TODO: Tell user the gauge that we tried to use (river.usgs)
			queryResult.ssml = starter + " does not have a working gauge. You can open rivers.run<say-as interpret-as=\"characters\">/FAQ</say-as> in your browser to learn how to update the gauge. " + ender
		}
		return queryResult
	}
	
	
	let str = starter + " had a flow level of "
	if (cfs && feet) {
		str += cfs + " cfs or " + feet + " feet"
	}
	else if (cfs) {
		str += cfs + " cfs"
	}
	else if (feet) {
		str += feet + " feet"
	}
	let timeAgo = Date.now() - (gauge.feet[gauge.feet.length-1].dateTime)	
	let hoursAgo = Math.floor(timeAgo/1000/3600)
	let minutesAgo = Math.ceil(timeAgo/1000%3600/60)
	
	let timeString = (hoursAgo > 0?`${hoursAgo} hours and `:"") + minutesAgo + " minutes ago"
	
	str += " as of " + timeString
	str += ", according to the gauge " + gauge.name + ". "
	
	//TODO: Inform the user of the too low, lowflow, midflow, highflow, too high, values.
	
	//Consider seeing if the response matches some pre-defined formats, to reduce issues with google mis-processing.
	//Consider telling user what we got sent as river-name.
	//TODO: Consider telling the user what river we took the gauge from. This will help prevent issues if google misinterprets things,
	//and sends back a basic query. Ex. Hopeville Canyon > Canyon > Cheat Canyon
	//Checking that part of the river name is in the search should work just fine. 
		
	queryResult.ssml = str + ender
	
	return queryResult
}

module.exports = {getAssistantReply}
