const fs = require("fs")
const path = require("path")

const utils = require(path.join(__dirname, "utils.js"))

const normalSearch = require(path.join(utils.getSiteRoot(), "src", "search.js")).normalSearch
const calculateRelativeFlow = require(path.join(utils.getSiteRoot(), "src", "flowInfoCalculations.js")).calculateRelativeFlow

function getAssistantReply(name, sentence) {
	let riverarray = JSON.parse(fs.readFileSync(path.join(utils.getSiteRoot(), "riverdata.json"), {encoding:"utf8"}))

	let units;
	if (sentence) {

		//TODO: Use some more specific regex to easily catch things like units.
		//TODO: If no results obtained by this search, but googles query does, log the sentence.

		//Sometimes Google Assistant adds a space between rivers. and Run. Handle some seperation.
		sentence = sentence.split(/Ask rivers\s?.\s?run(?: for) (?: the)?/i).join("")

		let preciseMatchers = [
			/(?:water |gauge )(?:level|height) (?:of )?(?:the )?(?<name>.+) in (?<units>cfs|feet)/i,
			/(?<units>flow) information for the (?<name>.+)/,
			/i(?:s|f)(?: the)? (?<name>.+?) (?:is )?(?<units>running|paddleable|runnable)/i, //TODO: Check if paddleable ever actually shows up based on spelling, etc.
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

		if (results[0]) {
			name = results[0].name
			units = results[0].units
		}

		if (results.length > 1) {
			console.log(results)
		}
	}

	console.log(name)

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
	let ender = "<break time=\"0.3s\"/>Happy Paddling! Bye! </speak>"

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
				starter = alwaysStart + topRanked.length + " sections of river showed up for the search " + responseName + ". Picking " + selectedRiverName + ". <break time=\"0.5s\"/>" + starter
				break;
			}
		}
	}

	let gauge;
	let cfs;
	let feet;
	let temp;
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
		try {
			temp = gauge.temp[gauge.temp.length-1].value
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

	let timeAgo = Date.now() - (gauge.feet[gauge.feet.length-1].dateTime)
	let hoursAgo = Math.floor(timeAgo/1000/3600)
	let minutesAgo = Math.ceil(timeAgo/1000%3600/60)

	let timeString = (hoursAgo > 0?`${hoursAgo} hours and `:"") + minutesAgo + " minutes ago"

	str += " as of " + timeString
	str += ", according to the gauge " + gauge.name + ". "

	if (["running", "paddleable"].includes(units)) {
		//TODO: Inform the user of the too low, lowflow, midflow, highflow, too high, values.
		topRanked[0].cfs = cfs
		topRanked[0].feet = feet
		let relativeFlow = calculateRelativeFlow(topRanked[0])

		if (relativeFlow === null) {
			str += "Relative flows are currently unknown. To learn how to add them, go to <say-as interpret-as=\"characters\">/FAQ</say-as> in your browser. "
		}
		else if (relativeFlow === 0) {
			str += "This river is currently too low, with a minimum of " + topRanked[0].minrun + "."
		}
		else if (relativeFlow === 4) {
			str += "This river is currently too high for typical paddlers, with a maximum of " + topRanked[0].maxrun + "."
		}
		else if (relativeFlow > 3.5) {
			str += "This river is currently at a very high level, bordering on too high, and may be significantly more difficult than rated. The maximum is " + topRanked[0].maxrun + "."
		}
		else if (relativeFlow < 0.5) {
			str += "This river is currently at a very low level, bordering on too low. The minimum level is " + topRanked[0].minrun + "."
		}
		else if (relativeFlow < 1) {
			str += "This river is currently a little lower than preferred. The minimum level is " + topRanked[0].minrun + ", however levels above " + topRanked[0].lowflow + " are preferred."
		}
		else if (relativeFlow > 3) {
			str += "This river is currently a little high, and may be more difficult than rated. The maximum levels is " + topRanked[0].maximum + ", however levels above " + topRanked[0].highflow + " are considered high."
		}
		else if (relativeFlow > 2.5) {
			str += "This river is within reccomended levels, although close to being a little high. Levels above " + topRanked[0].highflow + " are considered high, while " + topRanked[0].midflow + " is considered the middle level."
		}
		else if (relativeFlow < 1.5) {
			str += "This river is within reccomended levels, although close to being a little low. Levels below " + topRanked[0].lowflow + " are considered low, while " + topRanked[0].midflow + " is considered the middle level."
		}
		else {
			str += "This river is within reccomended levels. Levels below " + topRanked[0].lowflow + " are considered low, levels above " + topRanked[0].highflow + " are considered high, and " + topRanked[0].midflow + " is considered the middle level."
		}
	}


	//Consider seeing if the response matches some pre-defined formats, to reduce issues with google mis-processing.
	//Consider telling user what we got sent as river-name.
	//TODO: Consider telling the user what river we took the gauge from. This will help prevent issues if google misinterprets things,
	//and sends back a basic query. Ex. Hopeville Canyon > Canyon > Cheat Canyon
	//Checking that part of the river name is in the search should work just fine.

	queryResult.ssml = str + ender

	return queryResult
}

module.exports = {getAssistantReply}
