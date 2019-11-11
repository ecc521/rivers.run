const fs = require("fs")
const path = require("path")

const utils = require(path.join(__dirname, "utils.js"))

const siteDataParser = require(path.join(__dirname, "siteDataParser.js"))

const normalSearch = require(path.join(utils.getSiteRoot(), "src", "search.js")).normalSearch
const calculateRelativeFlow = require(path.join(utils.getSiteRoot(), "src", "flowInfoCalculations.js")).calculateRelativeFlow

function createGetLatest(filePath, options = {}) {
	let oldLastModified;
	let fileData;
	return async function getLatest() {
		//If the file has not changed, don't read from disk again.
		let currentLastModified = (await fs.promises.stat(filePath)).mtime.getTime()
		if (currentLastModified !== oldLastModified) {
			if (options.isJSON) {
				//We are passing by reference... There could be an issue if the reference is modified. (we'll assume this won't happen if option selected)
				fileData = JSON.parse(await fs.promises.readFile(filePath, {encoding:"utf8"}))
			}
			else {fileData = await fs.promises.readFile(filePath)}
			oldLastModified = currentLastModified
		}
		return fileData
	}
}

let getLatestRiverArray = createGetLatest(path.join(utils.getSiteRoot(), "riverdata.json"),{isJSON:true})

async function getAssistantReply(query, options) {
	let riverarray = await getLatestRiverArray()

	let sentence = query.sentence

	if (typeof query.sentence === "string") {
		let regexMatched = regexMatching(sentence)

		//If the provided units is invalid, use regex matching.
		if (!["flow level", "relative flow", "temperature"].includes(query.units)) {
			query.units = regexMatched.units
		}

		query = Object.assign(regexMatched, query)
	}

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
	//Convert state names to state codes for search - pass onlyAtEnd and notStart to handle things like "Mississippi River At Example Mississippi"
	let topRanked = normalSearch(riverarray, siteDataParser.replaceStateNamesWithCodes(name, {onlyAtEnd: true, notStart: true}), {
		strongMatchesOnly: true,
		regexpSplit:true //We are using nothing that should cause RegExp not to use the fast path, so this should significantly improve performance.
	})
	//TODO: How to handle gauges?
	//TODO: Bump out gauges if user wants relative flow.
	//TODO: When a search returns a gauge, but there were multiple options, the gauge is repeated twice.
	//TODO: Reformat gauge name (use siteDataParser.js).

	let alwaysStart = "<speak>"
	let ender = "</speak>"

	//TODO: Ask the user to break ties if multiple rivers in topRanked.

	//Don't use the word "The " for creeks, lakes, or when section was labeled.
	//Consider using the original name here - so before the word "River" was removed.
	let useThe = true
	if (responseName.toLowerCase().includes(" creek") || responseName.toLowerCase().includes(" lake") || responseName.toLowerCase().includes("section ")) {
		useThe = false
	}

	if (topRanked[0] && !topRanked[0].id) {topRanked[0].id = "usgs:" + topRanked[0].usgs} //This is a gauge. Fill in id using usgs.

	let queryResult = {
		responseName,
		search: name,
		riverid: (topRanked[0] && topRanked[0].id)
	}

	let starter = alwaysStart + (useThe?"The ":"") + responseName

	//No rivers matched the search.
	if (topRanked.length === 0) {
		queryResult.ssml = starter + " does not exist on rivers.run. Open rivers.run<say-as interpret-as=\"characters\">/FAQ</say-as> in your browser to learn how to add it. " + ender
		return queryResult
	}

	//Multiple rivers matched the search. Tell the use what we are choosing. TODO: Let user pick.
	if (topRanked.topMatches.length > 1) {
		//TODO: This checks everything, not just the top matches.
		let start;
		for (let i=0;i<topRanked.topMatches.length;i++) {
			start = start || topRanked.topMatches[i].usgs
			if (topRanked.topMatches[i].usgs !== start) {
				//If section is 1 word long, put section before name. Otherwise, put name before section.
				let sectionFirst = ["bottom", "bottom bottom", "lower", "middle", "upper", "top", "tip top", "upper upper", "top"].includes(topRanked.topMatches[0].section.trim().toLowerCase())
				let selectedRiverName = sectionFirst?(topRanked.topMatches[0].section + " " + topRanked.topMatches[0].name):(topRanked.topMatches[0].name + " " + topRanked.topMatches[0].section)
				starter = alwaysStart + topRanked.topMatches.length + " results showed up for the search " + responseName + ". Picking " + siteDataParser.fixSiteName(selectedRiverName, {convertStateCodeToName: true}) + ". <break time=\"0.5s\"/>" + starter
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
		gauge = JSON.parse(await fs.promises.readFile(path.join(utils.getSiteRoot(),"gaugeReadings",topRanked[0].usgs)))
		try {
			if (gauge.feet) {
				feet = gauge.feet[gauge.feet.length-1].value
				timeStamp = gauge.feet[gauge.feet.length-1].dateTime
			}
		}
		catch(e) {console.error(e)}
		try {
			if (gauge.cfs) {
				cfs = gauge.cfs[gauge.cfs.length-1].value
				timeStamp = gauge.cfs[gauge.cfs.length-1].dateTime
			}
		}
		catch(e) {console.error(e)}
		try {
			if (gauge.temp) {
				temp = gauge.temp[gauge.temp.length-1].value
				if (!timeStamp) {timeStamp = gauge.temp[gauge.temp.length-1].dateTime} //Temperature sometimes updates less often.
			}
		}
		catch(e) {console.error(e)}
	}
	catch(e) {console.error(e)}

	//River has no gauge, so we can't tell the user info on it.
	if (!topRanked[0].usgs) {
		queryResult.ssml = starter + " has no gauge on rivers.run. You can open rivers.run<say-as interpret-as=\"characters\">/FAQ</say-as> in your browser to learn how to add a gauge. <break time=\"0.3s\"/>Happy Paddling!" + ender
		return queryResult
	}

	//Gauge is broken. Tell user.
	else if (!cfs && !feet) {
		if (gauge) {
			//The gauge did not return the needed info.
			queryResult.ssml = starter + " does not have a working gauge. If " + siteDataParser.fixSiteName(gauge.name, {convertStateCodeToName: true}) + " is not the correct gauge, you can open rivers.run<say-as interpret-as=\"characters\">/FAQ</say-as> in your browser to learn how to update the gauge. <break time=\"0.3s\"/>Happy Paddling!" + ender
		}
		else {
			//The gauge doesn't appear to exist.
			//TODO: Tell user the gauge that we tried to use (river.usgs)
			queryResult.ssml = starter + " does not have a working gauge. You can open rivers.run<say-as interpret-as=\"characters\">/FAQ</say-as> in your browser to learn how to update the gauge. <break time=\"0.3s\"/>Happy Paddling!" + ender
		}
		return queryResult
	}


	//TODO: Inform the user of the trend.
	let str = starter + " had a level of "
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

	if (minutesAgo === 60) {minutesAgo = 0;hoursAgo++} //Use 1 hour instead of 60 minutes when time is 59 minutes something seconds.

	let timeString = (hoursAgo > 0?`${hoursAgo} hours and `:"") + minutesAgo + " minutes ago"

	str += " as of " + timeString + ", "

	if (units === "relative flow") {
		//TODO: Consider moving temperature to before flow, and changing removing which is from "which is well within reccomended levels..."

		let river = topRanked[0]

		river.cfs = cfs
		river.feet = feet
		let relativeFlow = calculateRelativeFlow(river)

		function round(level) {
			if (river.relativeFlowType === "cfs") {
				return Math.round(level) + river.relativeFlowType
			}
			else {
				return Math.round(level*100)/100 + river.relativeFlowType
			}
		}

		if (river.running === null) {
			str += "according to the gauge " + siteDataParser.fixSiteName(gauge.name, {convertStateCodeToName: true}) + ". "
			str += "<break time=\"0.4s\"/>Relative flows are currently unknown. To learn how to add them, go to rivers.run<say-as interpret-as=\"characters\">/FAQ</say-as> in your browser. <break time=\"0.3s\"/>Happy Paddling!"
		}
		else if (river.running === 0) {
			str += "which is below the minimum of " + round(river.minrun) + " for the gauge " + siteDataParser.fixSiteName(gauge.name, {convertStateCodeToName: true}) + ". <break time=\"0.3s\"/>Keep rain dancing!"
		}
		else if (river.running === 4) {
			str += "which is above the reccomended maximum of " + round(river.maxrun) + " for the gauge " + siteDataParser.fixSiteName(gauge.name, {convertStateCodeToName: true}) + ". <break time=\"0.3s\"/>Stop rain dancing!"
		}
		else if (river.running > 3.5) {
			str += "which is a very high level, bordering on too high. The maximum is " + round(river.maxrun) + ", but levels above " + round(river.highflow) + " are considered high for the gauge " + siteDataParser.fixSiteName(gauge.name, {convertStateCodeToName: true}) + ". <break time=\"0.3s\"/>Time to stop rain dancing!"
		}
		else if (river.running < 0.5) {
			str += "which a very low level, bordering on too low. The minimum level is " + round(river.minrun) + ", however levels above " + round(river.lowflow) + " are preferred for the gauge " + siteDataParser.fixSiteName(gauge.name, {convertStateCodeToName: true}) + ". <break time=\"0.3s\"/>Time to start rain dancing!"
		}
		else if (river.running < 1) {
			str += "which is above the minimum of " + round(river.minrun) + ", although levels above " + round(river.lowflow) + " are reccomended for the gauge " + siteDataParser.fixSiteName(gauge.name, {convertStateCodeToName: true}) + ". <break time=\"0.3s\"/>Happy Paddling!"
		}
		else if (river.running > 3) {
			str += "which is a little high. The maximum levels is " + round(river.maximum) + ", however levels above " + round(river.highflow) + " are considered high for the gauge " + siteDataParser.fixSiteName(gauge.name, {convertStateCodeToName: true}) + ". <break time=\"0.3s\"/>Happy Paddling!"
		}
		else if (river.running > 2.5) {
			str += "which is on the higher end of reccomended levels. Levels above " + round(river.highflow) + " are considered high, while " + round(river.midflow) + " is considered the middle level for the gauge " + siteDataParser.fixSiteName(gauge.name, {convertStateCodeToName: true}) + ". <break time=\"0.3s\"/>Happy Paddling!"
		}
		else if (river.running < 1.5) {
			str += "which is on the lower end of reccomended levels. Levels below " + round(river.lowflow) + " are considered low, while " + round(river.midflow) + " is considered the middle level for the gauge " + siteDataParser.fixSiteName(gauge.name, {convertStateCodeToName: true}) + ". <break time=\"0.3s\"/>Happy Paddling!"
		}
		else {
			str += "which is well within the reccomended levels of " + round(river.lowflow) + " through " + round(river.highflow) + ", and near the middle level of " + round(river.midflow) + " for the gauge " + siteDataParser.fixSiteName(gauge.name, {convertStateCodeToName: true}) + ". <break time=\"0.3s\"/>Happy Paddling!"
		}
	}
	else {
		str += "according to the gauge " + siteDataParser.fixSiteName(gauge.name, {convertStateCodeToName: true}) + ". <break time=\"0.3s\"/>Happy Paddling!"
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
