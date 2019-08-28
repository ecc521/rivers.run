const fs = require("fs")
const path = require("path")

let normalSearch = require("./src/search.js").normalSearch

function getAssistantReply(name) {
	let riverarray = JSON.parse(fs.readFileSync("riverdata.json", {encoding:"utf8"}))

	//Delete the word river (plus the leading space), if it exists in any casing.
	name = name.split(/ river/i).join("")

	let topRanked = []

	let buckets = normalSearch(riverarray, name, true)

	for (let i=0;i<buckets.length;i++) {
		let bucket = buckets[i]
		if (bucket.length > 0) {
			if (i !== 1) {
				topRanked = bucket
			}
			else {
				//Bucket #2 is somewhat special - it is a bucket of buckets (likely with some undefined holes).
				topRanked = bucket[0]
			}
			break;
		}
	}

	let flowData = JSON.parse(fs.readFileSync(path.join(__dirname, "flowdata2.json"), {encoding:"utf8"}))

	//TODO: Ask the user to break ties if multiple rivers in topRanked.

	//Don't use the word "The " for creeks.
	//Consider using the original name here - so before the word "River" was removed.
	let starter = (name.toLowerCase().includes("creek")?"":"The ") + name

	
	if (topRanked[0] === undefined) {
		return starter + " does not exist on rivers.run. Click Add a River to learn how to add it. "
	}
	
	let gauge = flowData[topRanked[0].usgs]

	let cfs;
	let feet;
	try {
		cfs = gauge.cfs[gauge.cfs.length-1].value
		feet = gauge.feet[gauge.feet.length-1].value
	}
	catch(e) {console.error(e)}


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
	str += ", according to the gauge " + gauge.name + "."
	
	//TODO: Inform the user of the too low, lowflow, midflow, highflow, too high, values.

	if (!topRanked[0].usgs) {
		str = starter + " has no gauge on rivers.run. Click Edit this River to learn how to add a gauge. "
	}
	else if (!cfs && !feet) {
		str = starter + " does not have a working gauge. If " + gauge.name + " is not the correct gauge to use, click Edit this River to learn how to fix this issue. "
	}
	
	return {
		str,
		riverid: topRanked[0].id,
		name
	}
}

module.exports = {getAssistantReply}
