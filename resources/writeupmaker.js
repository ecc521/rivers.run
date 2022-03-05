const states = {"AL":"Alabama","AK":"Alaska","AZ":"Arizona","AR":"Arkansas","CA":"California","CO":"Colorado","CT":"Connecticut","DE":"Delaware","DC":"District of Columbia","FL":"Florida","GA":"Georgia","HI":"Hawaii","ID":"Idaho","IL":"Illinois","IN":"Indiana","IA":"Iowa","KS":"Kansas","KY":"Kentucky","LA":"Louisiana","ME":"Maine","MD":"Maryland","MA":"Massachusetts","MI":"Michigan","MN":"Minnesota","MS":"Mississippi","MO":"Missouri","MT":"Montana","NE":"Nebraska","NV":"Nevada","NH":"New Hampshire","NJ":"New Jersey","NM":"New Mexico","NY":"New York","NC":"North Carolina","ND":"North Dakota","OH":"Ohio","OK":"Oklahoma","OR":"Oregon","PA":"Pennsylvania","RI":"Rhode Island","SC":"South Carolina","SD":"South Dakota","TN":"Tennessee","TX":"Texas","UT":"Utah","VT":"Vermont","VA":"Virginia","WA":"Washington","WV":"West Virginia","WI":"Wisconsin","WY":"Wyoming","AS":"American Samoa","GU":"Guam","MP":"Northern Mariana Islands","PR":"Puerto Rico","UM":"U.S. Minor Outlying Islands","VI":"U.S. Virgin Islands"}

const {skillLevels, reverseSkillTranslations} = require("../src/skillTranslations.js")

const gaugeProviders = ["USGS", "NWS", "canada", "streambeam", "ireland", "virtual"]

//TODO: Add validation.
let json = {
	checkErrorsMode: "onComplete",
	progressBarType: "buttons",
	showProgressBar: "top",
	completeText: "Submit River Suggestion",
	showCompletedPage: false,
	showQuestionNumbers: "off",
	pages: [
		{
			navigationTitle: "Basic Info",
			navigationDescription: "Name, Skill, GPS",
			elements: [
				{
					type: "text",
					name: "river",
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
					choices: skillLevels.map((item) => {return item[1]}),
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
					name: "quality",
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
		},
		{
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
					name: "relativeFlowUnits",
					title: "Relative Flow Units: ",
					choices: ["cfs", "feet", "cms", "meters"],
					isRequired: true,
					startWithNewLine: false,
					enableIf: "{minrun} != {default} or {lowflow} != {default} or {midflow} != {default} or {highflow} != {default} or {maxrun} != {default}"
				},

				{
					type: "paneldynamic",
					name: "relatedGauges",
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
		},
		{
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
					type: "text",
					name: "suggestionName",
					title: "File Name for this Suggestion: ",
					placeHolder: "Enter File Name... ",
				},
				{
					type: "text",
					name: "suggestionEmail",
					inputType: "email",
					title: "Contact Email for this Suggestion: ",
					placeHolder: "Enter Contact Email... ",
				},
			],
		},
	]
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


//TODO: Links from home page.

//TODO: Import from river.

//TODO: Preview final river.



function getSurveyInOldFormat() {
	let obj = Object.assign({}, survey.data)

	delete obj.suggestionName
	delete obj.suggestionEmail

	obj.skill = reverseSkillTranslations[obj.skill]

	if (obj.gaugeProvider && obj.gaugeID) {
		obj.gauge = obj.gaugeProvider + ":" + obj.gaugeID
	}
	delete obj.gaugeProvider
	delete obj.gaugeID

	if (obj.relatedGauges) {
		obj.relatedGauges = JSON.stringify(obj.relatedGauges.map((gauge) => {return gauge.gaugeProvider + ":" + gauge.gaugeID}))
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
