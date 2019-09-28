const fs = require("fs")
const path = require("path")

const utils = require(path.join(__dirname, "utils.js"))

const normalSearch = require(path.join(utils.getSiteRoot(), "src", "search.js")).normalSearch
const calculateRelativeFlow = require(path.join(utils.getSiteRoot(), "src", "flowInfoCalculations.js")).calculateRelativeFlow




function getAssistantReply(query, options) {	
	let riverarray = JSON.parse(fs.readFileSync(path.join(utils.getSiteRoot(), "riverdata.json"), {encoding:"utf8"}))
	
	let sentence = query.sentence
	
	//Use regex matching to fill in missing fields. 
	let regexMatched = regexMatching(sentence)
	
	//If the provided units is invalid, use regex matching.
	if (!["flow level", "relative flow", "temperature"].includes(query.units)) {
		query.units = regexMatched.units
	}
	
	//Use regex matching to fill in any remaining fields.
	query = Object.assign(regexMatched, query)
	
	let name = query.name
	let units = query.units

	
	
	console.log(name)

	//Delete the words river and section (plus the leading space), if it exists in any casing.

	name = name.split(/ river/i).join("")
	name = name.split(/the /i).join("") //This breaks phrasing of something like "Little Falls of the Potomac". Should be fixed.
	let responseName = name

	//Handle something like "Little Falls of the Potomac", "Nantahala from Pattons to NOC", of "Big Laurel Creek at Hot Springs"
	name = name.split(/ of/i).join("")
	name = name.split(/ at/i).join("")
	name = name.split(/ from/i).join("")

	name = name.split(/(?:section )|(?: section)/i).join("")

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
	let ender = " <break time=\"0.3s\"/>Happy Paddling! Bye! </speak>"

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
	
	
	//No rivers matched the search.
	if (topRanked === undefined || topRanked.length === 0) {
		queryResult.ssml = starter + " does not exist on rivers.run. Open rivers.run<say-as interpret-as=\"characters\">/FAQ</say-as> in your browser to learn how to add it. " + ender
		return queryResult
	}


	//Multiple rivers matched the search. Tell the use what we are choosing. TODO: Let user pick.
	if (topRanked.length > 1) {
		let start;
		for (let i=0;i<topRanked.length;i++) {
			start = start || topRanked[i].usgs
			if (topRanked[i].usgs !== start) {
				//If section is 1 word long, put section before name. Otherwise, put name before section.
				let sectionFirst = ["bottom", "bottom bottom", "lower", "middle", "upper", "top", "tip top", "upper upper", "top"].includes(topRanked[0].section.trim().toLowerCase())
				let selectedRiverName = sectionFirst?(topRanked[0].section + " " + topRanked[0].name):(topRanked[0].name + " " + topRanked[0].section)
				starter = alwaysStart + topRanked.length + " sections of river showed up for the search " + responseName + ". Picking " + selectedRiverName + ". <break time=\"0.5s\"/>" + starter
				break;
			}
		}
	}

	let gauge;
	let cfs;
	let feet;
	let temp;
	let timeStamp;
	try {
		gauge = flowData[topRanked[0].usgs]
		try {
			feet = gauge.feet[gauge.feet.length-1].value
			timeStamp = gauge.feet[gauge.feet.length-1].dateTime
		}
		catch(e) {console.error(e)}
		try {
			cfs = gauge.cfs[gauge.cfs.length-1].value
			timeStamp = gauge.cfs[gauge.cfs.length-1].dateTime
		}
		catch(e) {console.error(e)}
		try {
			temp = gauge.temp[gauge.temp.length-1].value
			if (!timeStamp) {timeStamp = gauge.temp[gauge.temp.length-1].dateTime} //I believe that I have seen temperature update less often on some gauges.
		}
		catch(e) {console.error(e)}
		console.log(cfs)
	}
	catch(e) {console.error(e)}

	//River has no gauge, so we can't tell the user info on it.
	if (!topRanked[0].usgs) {
		queryResult.ssml = starter + " has no gauge on rivers.run. You can open rivers.run<say-as interpret-as=\"characters\">/FAQ</say-as> in your browser to learn how to add a gauge. " + ender
		return queryResult
	}
	//Gauge is broken. Tell user.
	else if (!cfs && !feet) {
		if (gauge) {
			//The gauge did not return the needed info.
			queryResult.ssml = starter + " does not have a working gauge. If " + gauge.name + " is not the correct gauge, you can open rivers.run<say-as interpret-as=\"characters\">/FAQ</say-as> in your browser to learn how to update the gauge. " + ender
		}
		else {
			//The gauge doesn't appear to exist.
			//TODO: Tell user the gauge that we tried to use (river.usgs)
			queryResult.ssml = starter + " does not have a working gauge. You can open rivers.run<say-as interpret-as=\"characters\">/FAQ</say-as> in your browser to learn how to update the gauge. " + ender
		}
		return queryResult
	}


	//TODO: Inform the user of the trend.
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
	else if (temp) {
		//If temp is the only value, still tell them it.
		str = starter + " had a temperature of " + temp + " degrees."
	}

	if ((cfs || feet) && temp) {
		str += " and a temperature of " + temp + " degrees"
	}

	let timeAgo = Date.now() - timeStamp
	let hoursAgo = Math.floor(timeAgo/1000/3600)
	let minutesAgo = Math.ceil(timeAgo/1000%3600/60)

	let timeString = (hoursAgo > 0?`${hoursAgo} hours and `:"") + minutesAgo + " minutes ago"

	str += " as of " + timeString + ", "

	if (units === "relative flow") {
		//TODO: Consider moving temperature to before flow, and changing removing which is from "which is well within reccomended levels..."
		
		let river = topRanked[0]
		
		river.cfs = cfs
		river.feet = feet
		let relativeFlow = calculateRelativeFlow(river)
		
		if (relativeFlow === null) {
			str += "according to the gauge " + gauge.name + ". "
			str += "<break time=\"0.4s\"/>Relative flows are currently unknown. To learn how to add them, go to rivers.run<say-as interpret-as=\"characters\">/FAQ</say-as> in your browser."
		}
		else if (relativeFlow === 0) {
			str += "which is below the minimum of " + river.minrun + " for the gauge " + gauge.name + "."
		}
		else if (relativeFlow === 4) {
			str += "which is above the reccomended maximum " + river.maxrun + " for the gauge " + gauge.name + "."
		}
		else if (relativeFlow > 3.5) {
			str += "which is a very high level, bordering on too high. The maximum is " + topRanked[0].maxrun + ", but levels above " + topRanked[0].highflow + " are considered high for the gauge " + gauge.name + "."
		}
		else if (relativeFlow < 0.5) {
			str += "which a very low level, bordering on too low. The minimum level is " + topRanked[0].minrun + ", however levels above " + topRanked[0].lowflow + " are preferred for the gauge " + gauge.name + "."
		}
		else if (relativeFlow < 1) {
			str += "which is above the minimum of " + topRanked[0].minrun + ", although levels above " + topRanked[0].lowflow + " are reccomended for the gauge " + gauge.name + "."
		}
		else if (relativeFlow > 3) {
			str += "which is a little high. The maximum levels is " + topRanked[0].maximum + ", however levels above " + topRanked[0].highflow + " are considered high for the gauge " + gauge.name + "."
		}
		else if (relativeFlow > 2.5) {
			str += "which is on the higher end of reccomended levels. Levels above " + topRanked[0].highflow + " are considered high, while " + topRanked[0].midflow + " is considered the middle level for the gauge " + gauge.name + "."
		}
		else if (relativeFlow < 1.5) {
			str += "which is on the lower end of reccomended levels. Levels below " + topRanked[0].lowflow + " are considered low, while " + topRanked[0].midflow + " is considered the middle level for the gauge " + gauge.name + "."
		}
		else {
			str += "which is well within the reccomended levels of " + river.lowflow + " through " + river.highflow + ", and near the middle level of " + river.midflow + " for the gauge " + gauge.name + "."
		}

		//TOOO: Say "computer estimated value of ___" instead of "___ (computer estimate)" 
		str = str.split("(computer)").join("(computer estimate)")
	}
	else {
		str += "according to the gauge " + gauge.name + ". "
	}

	queryResult.ssml = str + ender

	return queryResult
}






function regexMatching(sentence) {
		//This regex matching is not great, and should only be used as a fallback.
		//TODO: Use some more specific regex to easily catch things like units.
	
		//Sometimes Google Assistant adds a space between rivers. and Run. Handle some seperation.
		sentence = sentence.split(/Ask rivers\s?.\s?run(?: for) (?: the)?/i).join("")

	
		//These still aren't precise enough: Something like what is the flow level of the flat river matches wrong. 
		let preciseMatchers = [
			/(?:water |gauge )(?:level|height) (?:of )?(?:the )?(?<name>.+) in (?<units>cfs|feet)/i,
			/(?<units>flow) information for the (?<name>.+)/,
			/i(?:s|f)(?: the)? (?<name>.+?) (?:is )?(?:at a )?(?<units>running|runnable|paddleable)/i, //TODO: Check if paddleable ever actually shows up based on spelling, etc.
		]


		let matchers = [
			/^(?:flow\s|water\s|level\s|cfs\s|feet\s|height\s|gauge\s)+([^.]+)/i,
			/(.+?)\s(?:flow|water|level|cfs|feet|height|gauge)+/i,
		]

		let results = []

		//Use the more precise ones first.
		preciseMatchers.forEach((regex) => {
			let match = regex.exec(sentence)
			if (match) {
				let groups = match.groups
				results.push({
					name: groups.name,
					units: groups.units
				})
			}
		})

		let trimmedSentence = sentence
		let endingMatch = / in (?:feet|cfs).?$/i.exec(trimmedSentence)
		if (endingMatch) {
			console.log("Trimming " + trimmedSentence)
			trimmedSentence = trimmedSentence.slice(0, -endingMatch[0].length)
			console.log("To " + trimmedSentence)
		}

		trimmedSentence = trimmedSentence.split(/of /i).join("")
		trimmedSentence = trimmedSentence.split(/the /i).join("")

		matchers.forEach((regex) => {
			let match = regex.exec(trimmedSentence)
			if (match) {
				let str = match[1]
				//Sometimes the first regexp will match Water in Water Level
				if (!str.match(/water|level|flow|of/i)) {
					results.push({
						name: str,
						units: "flow"
					})
				}
				else {console.log("Rejected " + str)}
			}
		})

		//Log sentence that match multiple.
		if (results.length > 1) {
			console.log(results)
		}
	
		if (results[0]) {
			let result = {
				name: results[0].name,
				units: results[0].units
			}
	
			if (["running", "runnable", "paddleable"].includes(result.units)) {
				result.units = "relative flow"
			}
	
			return result
		}
		else {
			return {};
		}
}





module.exports = {getAssistantReply}
