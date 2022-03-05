const states = {"AL":"Alabama","AK":"Alaska","AZ":"Arizona","AR":"Arkansas","CA":"California","CO":"Colorado","CT":"Connecticut","DE":"Delaware","DC":"District of Columbia","FL":"Florida","GA":"Georgia","HI":"Hawaii","ID":"Idaho","IL":"Illinois","IN":"Indiana","IA":"Iowa","KS":"Kansas","KY":"Kentucky","LA":"Louisiana","ME":"Maine","MD":"Maryland","MA":"Massachusetts","MI":"Michigan","MN":"Minnesota","MS":"Mississippi","MO":"Missouri","MT":"Montana","NE":"Nebraska","NV":"Nevada","NH":"New Hampshire","NJ":"New Jersey","NM":"New Mexico","NY":"New York","NC":"North Carolina","ND":"North Dakota","OH":"Ohio","OK":"Oklahoma","OR":"Oregon","PA":"Pennsylvania","RI":"Rhode Island","SC":"South Carolina","SD":"South Dakota","TN":"Tennessee","TX":"Texas","UT":"Utah","VT":"Vermont","VA":"Virginia","WA":"Washington","WV":"West Virginia","WI":"Wisconsin","WY":"Wyoming","AS":"American Samoa","GU":"Guam","MP":"Northern Mariana Islands","PR":"Puerto Rico","UM":"U.S. Minor Outlying Islands","VI":"U.S. Virgin Islands"}

const {skillLevels} = require("../src/skillTranslations.js")

const gaugeProviders = ["USGS", "NWS", "canada", "streambeam", "ireland", "virtual"]

//TODO: Add validation for gaugeIDs, etc.


const basicInfoPage = {
	navigationTitle: "Basic Info",
	navigationDescription: "Name, Skill, GPS",
	elements: [
		{
			type: "html",
			name: "info",
			html: `Welcome to the Rivers.run River Creator! If you aren't sure where to begin, check the <a target="_blank" href="${window.root + "FAQ.html"}">FAQ</a>!`
		},
		{
			type: "text",
			name: "name",
			title: "River Name: ",
			placeHolder: "Enter River Name...",
			isRequired: true,
		},
		{
			type: "text",
			name: "section",
			title: "Section Name: ",
			placeHolder: "Enter Section Name...",
			isRequired: true,
		},
		{
			type: "dropdown",
			name: "skill",
			title: "Skill Level: ",
			isRequired: true,
			choices: skillLevels.map((item) => {
				return {value: item[0], text: item[1]}
			}),
		},
		{
			type: "text",
			name: "class",
			title: "Class (Ex: II+, IV-V, I-II, etc): ",
			placeHolder: "Enter Class...",
		},
		{
			//TODO: Add a bit more granularity - like a slider.
			//We can allow values like 0.25 or 0.4 if users want to use them.
			type: "rating",
			name: "rating",
			title: "River Quality: ",
			minRateDescription: "Poor",
			maxRateDescription: "Exceptional",
			rateValues: new Array(9).fill(0).map((value, index) => 1 + index*0.5),
		},
		{
			type: "boolean",
			name: "dam",
			title: "Is This River Dam Controlled? ",
			isRequired: true
		},
		{
			type: "text",
			name: "state",
			title: "State/Province Abbriviation (NC, VA, TX, etc): ",
			placeHolder: "Enter State/Province..."
		},
		{
			type: "text",
			name: "plat",
			title: "Put-In GPS Latitude: ",
			placeHolder: "Enter Coordinate... ",
		},
		{
			type: "text",
			name: "plon",
			title: "Put-In GPS Longitude: ",
			placeHolder: "Enter Coordinate... ",
			startWithNewLine: false,
			enableIf: "{plat} != {default}",
			isRequired: true,
		},
		{
			type: "text",
			name: "tlat",
			title: "Take-Out GPS Latitude: ",
			placeHolder: "Enter Coordinate... ",
		},
		{
			type: "text",
			name: "tlon",
			title: "Take-Out GPS Longitude: ",
			placeHolder: "Enter Coordinate... ",
			startWithNewLine: false,
			enableIf: "{tlat} != {default}",
			isRequired: true,
		},
	],
}


const flowInfoPage = {
	navigationTitle: "Flow Info",
	navigationDescription: "Gauges & Ranges",
	elements: [
		{
			type: "dropdown",
			name: "gaugeProvider",
			title: "Primary Gauge Provider: ",
			choices: gaugeProviders,
		},
		{
			type: "text",
			name: "gaugeID",
			title: "Primary Gauge ID: ",
			placeHolder: "Enter Gauge ID... ",
			isRequired: true,
			enableIf: "{gaugeProvider} != {default}"
		},


		{
			type: "text",
			name: "minrun",
			title: "Minimum Level: ",
			placeHolder: "Enter Number... ",
			inputType: "number",
			enableIf: "{gaugeID} != {default}"
		},
		{
			type: "text",
			name: "lowflow",
			title: "Low-Flow Level: ",
			placeHolder: "Enter Number... ",
			inputType: "number",
			startWithNewLine: false,
			enableIf: "{gaugeID} != {default}"
		},
		{
			type: "text",
			name: "midflow",
			title: "Mid-Flow Level: ",
			placeHolder: "Enter Number... ",
			inputType: "number",
			startWithNewLine: false,
			enableIf: "{gaugeID} != {default}"
		},
		{
			type: "text",
			name: "highflow",
			title: "High-Flow Level: ",
			placeHolder: "Enter Number... ",
			inputType: "number",
			startWithNewLine: false,
			enableIf: "{gaugeID} != {default}"
		},
		{
			type: "text",
			name: "maxrun",
			title: "Maximum Level: ",
			placeHolder: "Enter Number... ",
			inputType: "number",
			startWithNewLine: false,
			enableIf: "{gaugeID} != {default}"
		},
		{
			type: "dropdown",
			name: "relativeflowtype",
			title: "Relative Flow Units: ",
			choices: ["cfs", "feet", "cms", "meters"],
			isRequired: true,
			startWithNewLine: false,
			enableIf: "{minrun} != {default} or {lowflow} != {default} or {midflow} != {default} or {highflow} != {default} or {maxrun} != {default}"
		},

		{
			type: "paneldynamic",
			name: "relatedgauges",
			enableIf: "{gaugeID} != {default}",
			title: "Related Gauges: ",
			keyName: "name", //TODO: What is this???
			showQuestionNumbers: "off",
			templateElements: [
				{
					type: "dropdown",
					name: "gaugeProvider",
					title: "Gauge Provider: ",
					isRequired: true,
					choices: gaugeProviders,
				},
				{
					type: "text",
					name: "gaugeID",
					title: "Gauge ID: ",
					isRequired: true,
					placeHolder: "Enter Gauge ID... ",
				},
			],
			minPanelCount: 0,
			panelAddText: "Add Another Gauge",
			panelRemoveText: "Remove Gauge"
		},
	],
}

const extraPage = {
	navigationTitle: "Extra",
	navigationDescription: "Writeup & More",
	elements: [
		{
			type: "text",
			name: "aw",
			title: "AW River Number: ",
			placeHolder: "Enter AW River Number... ",
		},

		{
			type: "paneldynamic",
			name: "tags",
			title: "Tags: ",
			keyName: "name", //TODO: What is this???
			showQuestionNumbers: "off",
			templateElements: [
				{
					type: "text",
					name: "tag",
					title: "Tag: ",
					placeHolder: "Enter Tag... ",
					isRequired: true,
				},
			],
			minPanelCount: 0,
			panelAddText: "Add Another Tag",
			panelRemoveText: "Remove Tag"
		},
		{
			type: "editor",
			name: "writeup",
			title: "River Writeup: "
		},


		{
			type: "radiogroup",
			name: "submissionType",
			title: "This is a: ",
			choices: [
				{value: "new", text: "New River Suggestion"},
				{value: "edit", text: "Edit to Existing River"},
			],
			isRequired: true,
		},
		//TODO: Do nothing if Edit to Existing River is selected and Submit New River Suggestion clicked.
		{
			type: "html",
			name: "info",
			html: `You are finished! Click the "Copy Output" button, and paste your output into the river's data file. `,
			visibleIf: "{submissionType}='edit'"
		},

		{
			type: "html",
			name: "info",
			html: `Filling out the below fields is <strong><i>strongly</i></strong> recommended. Once finished, click "Submit River Suggestion" below. If receipt of your submission cannot be confirmed, please check the <a href="https://drive.google.com/drive/u/0/folders/1yq4C_4aG_7E18nAxYofLbKHmnZFI-0R_" target="_blank"> Review Queue</a> to confirm your river is pending review, and if not, submit again. `,
			visibleIf: "{submissionType}='new'"
		},

		{
			type: "text",
			name: "suggestionName",
			title: "File Name for this Suggestion: ",
			placeHolder: "Enter File Name... ",
			visibleIf: "{submissionType}='new'"
		},
		{
			type: "text",
			name: "suggestionEmail",
			inputType: "email",
			title: "Contact Email for this Suggestion: ",
			placeHolder: "Enter Contact Email... ",
			visibleIf: "{submissionType}='new'"
		},
	],
}

const pages = [basicInfoPage, flowInfoPage, extraPage]

let json = {
	checkErrorsMode: "onComplete",
	progressBarType: "buttons",
	showProgressBar: "top",
	completeText: "Submit River Suggestion",
	showCompletedPage: false,
	showQuestionNumbers: "off",
	pages: pages
};

Survey.StylesManager.applyTheme("modern");

window.survey = new Survey.Model(json);

survey.onComplete.add(function (sender) {
	//Restore the survey - don't hide it.
	setTimeout(function() {
		survey.isCompleted = false
		survey.currentPageNo = 0
		setButtons()
		survey.currentPageNo = survey.pageCount - 1
	}, 0)
});


ReactDOM.render(
	React.createElement(SurveyReact.Survey, {model: survey})
	, document.getElementById("surveyElement"));





function setButtons() {
	//Next button available on all but last page.

	let buttonToClone = document.getElementsByClassName(survey.cssValue.navigation.next)[0]

	let clearFormButton = buttonToClone.cloneNode()
	clearFormButton.value = "Clear Form"
	clearFormButton.addEventListener("click", function() {
		if (confirm("Clear this form?")) {
			survey.clear()
			surveyChanged()
		}
	})
	buttonToClone.parentElement.insertBefore(clearFormButton, buttonToClone)


	let copyButton = buttonToClone.cloneNode()
	copyButton.value = "Copy Output"
	copyButton.addEventListener("click", function() {
		copyStringToClipboard(getSurveyInOldFormat())
	})
	buttonToClone.parentElement.insertBefore(copyButton, buttonToClone)
}
setButtons()


survey.onComplete.add(function (sender) {
	submitAsNewRiver()
});


let lastDispatched = -Infinity;

function saveSurveyToDisk() {
	localStorage.setItem(surveySaveKey, JSON.stringify(survey.data))
}

//This is the biggie - auto-save before unload.
//We adopt a tick-mechanism as backup.
window.addEventListener("beforeunload", saveSurveyToDisk)

function surveyChanged() {
	const dispatchInterval = 3000
	if (Date.now() - lastDispatched > dispatchInterval) {
		//If we last dispatched more than dispatchInterval ago, dispatch again.
		lastDispatched = Date.now()
		setTimeout(function() {
			saveSurveyToDisk()
		}, dispatchInterval * 1.05) //Add a bit to dispatchInterval to ensure changes can't sneak in-between saves.
	}
}


const surveySaveKey = "surveyData"
survey.onValueChanged = {
	fire: surveyChanged
}


try {
	//Not sure when this would error, but wrap just in case.
	let data = localStorage.getItem(surveySaveKey)
	if (data) {
		survey.data = JSON.parse(data)
	}
}
catch (e) {console.error(e)}



function getSurveyInOldFormat() {
	let obj = Object.assign({}, survey.data)

	delete obj.suggestionName
	delete obj.suggestionEmail

	if (obj.gaugeProvider && obj.gaugeID) {
		obj.gauge = obj.gaugeProvider + ":" + obj.gaugeID
	}
	delete obj.gaugeProvider
	delete obj.gaugeID

	if (obj.relatedgauges) {
		obj.relatedgauges = JSON.stringify(obj.relatedgauges.map((gauge) => {return gauge.gaugeProvider + ":" + gauge.gaugeID}))
	}

	if (obj.tags) {
		obj.tags = obj.tags.map((tag) => {return tag.tag}).join(",")
	}

	let result = ""
	for (let prop in obj) {
		let val = obj[prop]
		if (val) {
			result += `${prop}: ${obj[prop]}` + "\n"
		}
	}
	return result.trim()
}


function submitAsNewRiver() {
	let url = "https://script.google.com/macros/s/AKfycbxhxpImVHh-UBAlVOGppV4wYRVtO4ldLHn_q128vckXshCl6B8/exec"
	let API_KEY = "AIzaSyD-MaLfNzz1BiUvdKKfowXbmW_v8E-9xSc"

	let type = "river"

	let name = survey.data.suggestionName
	let editors = survey.data.suggestionEmail

	let nonce = String(Math.round(Math.random() * (2**30)))

	let requestURL = url + "?type=" + type + "&name=" + name + "&nonce=" + nonce + (editors?("&editors=" + editors):"")
	console.log(requestURL)

	let request = fetch(requestURL, {
		method: "POST",
		body: getSurveyInOldFormat(),
		mode: "no-cors"
	})

	alert("We are attempting to submit your river. You should receive an alert in about 10 seconds if it succeeds. ")

	;(async function() {
		let response = await request
		let result = await response.text()
		console.log(result)
		let checkReq = await fetch("https://www.googleapis.com/drive/v3/files/16sAPFOmyzg5Ds-oHdt9Ra5LKmhjXNC6Q0_2WMBXaCtU/export?mimeType=text/plain&key=" + API_KEY, {cache: "no-store"})
		let checkResp = (await checkReq.text()).split("\n")[0]
		console.log(checkResp)
		console.log(name + nonce)
		if (checkResp.trim() === (name + nonce).trim()) {
			alert("Your river has been successfully submitted. ")
		}
		else {
			alert("Submission appears to have failed. Please try again. (you can confirm that it failed or succeeded by clicking on 'Open Review Queue')")
		}
	}())
}


function copyStringToClipboard(str) {
	// Create new element
	var el = document.createElement('textarea');
	// Set value (string to be copied)
	el.value = str;
	// Set non-editable to avoid focus and move outside of view
	el.setAttribute('readonly', '');
	el.style = {position: 'absolute', left: '-9999px'};
	document.body.appendChild(el);
	// Select text inside element
	el.select();
	// Copy text to clipboard
	document.execCommand('copy');
	// Remove temporary element
	document.body.removeChild(el);
}





//TODO: Links from home page.

//TODO: Import from river.


if (window.location.hash !== "") {
	if (confirm(`You were working on a previous writeup for the ${localStorage.getItem("name")}. Would you like to clear that writeup?`)) {
		List.forEach((value) => {
			localStorage.removeItem(value)
		})
	}
	else {
		window.location.hash = "#"
	}
}

let urlParams = new URLSearchParams(window.location.hash.slice(1))

//TODO: Preview final river.
//Not sure it's anywhere near as necessary, given how hard it is to mess up now.
//Still, add it back.





const River = require("../src/River.js").River
const Gauge = require("../src/Gauge.js")


function setSurveyFromRiverFormat(riverItem) {
	survey.clear()

	window.ItemHolder = []

	let data = riverItem
	let river = new River(0, riverItem)

	if (!river.dam) {river.dam = false}
	if (river.gauge) {
		let gauge = new Gauge(river.gauge)
		river.gaugeProvider = gauge.prefix
		river.gaugeID = gauge.gaugeID
	}

	river.tags = river.tags.split(",").map((tag) => {return {tag}})

	if (river.relatedgauges) {
		river.relatedgauges = river.relatedgauges.map((gaugeID) => {
			let gauge = new Gauge(gaugeID)
			return {gaugeProvider: gauge.prefix, gaugeID: gauge.gaugeID}
		})
	}

	survey.data = river
}


//
// let riverItem = {"tags":"wv, wvcabin, tucker, wvwor","aw":"2427","name":"Potomac - North Fork of South Branch","section":"Seneca Rocks to Hopeville","skill":"LI","rating":"4","writeup":"North Fork, South Branch- From Circleville to Mouth of Seneca is a beautiful 16 mile Cl 2 run that is not suitable for novices because the water is fast. Judge water level from numerous access points along US 33. Above Cherry Grove requires at least 1200 CFS @ Cabins.","maxrun":"7.5ft","minrun":"5.2ft","plat":"38.833889007568","plon":"-79.371940612793","tlat":"38.9272007","tlon":"-79.3099905","class":"I-III","state":"WV","gauge":"USGS:01606000","id":"1Xxy2ZROkxVEPfcubRbyxm4C8B68NsSWTDCAayLfL3b4"}
//
// setSurveyFromRiverFormat(riverItem)
