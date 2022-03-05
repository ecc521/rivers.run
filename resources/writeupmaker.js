//TODO: Add validation for gaugeIDs, etc.
const allowed = require("../server/allowedFields.js")

const states = {"AL":"Alabama","AK":"Alaska","AZ":"Arizona","AR":"Arkansas","CA":"California","CO":"Colorado","CT":"Connecticut","DE":"Delaware","DC":"District of Columbia","FL":"Florida","GA":"Georgia","HI":"Hawaii","ID":"Idaho","IL":"Illinois","IN":"Indiana","IA":"Iowa","KS":"Kansas","KY":"Kentucky","LA":"Louisiana","ME":"Maine","MD":"Maryland","MA":"Massachusetts","MI":"Michigan","MN":"Minnesota","MS":"Mississippi","MO":"Missouri","MT":"Montana","NE":"Nebraska","NV":"Nevada","NH":"New Hampshire","NJ":"New Jersey","NM":"New Mexico","NY":"New York","NC":"North Carolina","ND":"North Dakota","OH":"Ohio","OK":"Oklahoma","OR":"Oregon","PA":"Pennsylvania","RI":"Rhode Island","SC":"South Carolina","SD":"South Dakota","TN":"Tennessee","TX":"Texas","UT":"Utah","VT":"Vermont","VA":"Virginia","WA":"Washington","WV":"West Virginia","WI":"Wisconsin","WY":"Wyoming","AS":"American Samoa","GU":"Guam","MP":"Northern Mariana Islands","PR":"Puerto Rico","UM":"U.S. Minor Outlying Islands","VI":"U.S. Virgin Islands"}

const {skillLevels} = require("../src/skillTranslations.js")

const gaugeProviders = ["USGS", "NWS", "canada", "streambeam", "ireland", "virtual"]

function getDataFileLink(id) {
	return `https://docs.google.com/document/d/${id}`
}

function calculateWelcomeHTML(id) {
	let str = `Welcome to the Rivers.run River Creator! If you aren't sure where to begin, check the <a target="_blank" href="${window.root + "FAQ.html"}">FAQ</a>!`
	if (id) {
		str += `<br>If you only wish to make minor edits to the river you imported, the data file is <a href="${getDataFileLink(id)}" target="_blank">here</a>. `
	}
	return str
}

function calculateEditRiverHTML(id, recent = false) {
	let str = `You are finished! Click the "Copy Output" button, and paste your output into the ${recent ? `<a href="${getDataFileLink(id)}">river data file</a>` : "river data file"}.`
	if (id && !recent) {
		str += `<br>The data file for the river you last imported is <a href="${getDataFileLink(id)}" target="_blank">here</a> - this may or may not be the file you are looking for. `
	}
	return str
}

const {validateCode} = require("../server/gauges/codeValidators.js")


//Validate gauge IDs.
function surveyValidateQuestion(s, options) {
    if (options.name == "gaugeID") {
		let agency;
		let code;
		if (options.question.parentQuestion) {
			//This is a relatedGauge.
			//Find the parent - ie, the pair of questions for a single relatedgauge, not the entire relatedgauges question.
			let parent = options.question.parent
			let questions = parent.questions
			agency = questions[0].value
			code = questions[1].value
		}
		else {
			agency = survey.data.gaugeProvider;
			code = survey.data.gaugeID
		}

		let res = validateCode(agency, code)
		if (res !== true) {
			options.error = res;
		}
    }
}


//TODO"
//Changing gaugeProvider might make a previously invalid code valid.
//Re-run validators.
//
// survey.getAllQuestions().filter((question) => {
// 	if (question.name === "gaugeID") {
// 		question.hasErrors()
// 	}
// 	else if (question.name === "relatedgauges") {
// 		question.hasErrors()
// 	}
// })


const basicInfoPage = {
	navigationTitle: "Basic Info",
	navigationDescription: "Name, Skill, GPS",
	elements: [
		{
			type: "html",
			name: "welcomeText",
			html: calculateWelcomeHTML(),
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
			// startWithNewLine: false,
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
					// startWithNewLine: false,
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
	],
}

const previewPage = {
	navigationTitle: "Preview",
	navigationDescription: "Review & Export",
	elements: [
		{
			type: "html",
			name: "previewLabel",
			html: "Preview Should Appear Below: ",
		},
		{
			type: "html",
			name: "riverPreview",
			html: "River Preview Should Appear Here",
		},
		{
			type: "radiogroup",
			name: "submissionType",
			title: "This is a: ",
			choices: [
				{value: "new", text: "New River Suggestion"},
				{value: "edit", text: "Edit to an Existing River"},
			],
			isRequired: true,
		},
		{
			type: "html",
			name: "editRiverInfo",
			html: calculateEditRiverHTML(),
			visibleIf: "{submissionType}='edit'"
		},
		{
			type: "html",
			name: "newRiverInfo",
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

const pages = [basicInfoPage, flowInfoPage, extraPage, previewPage]


//Default the filename to name + section
function setDefaultFilename() {
	if (survey.data.name && survey.data.section) {
		survey.getQuestionByName("suggestionName").value = `${survey.data.name} ${survey.data.section}`		
	}
}

Survey
    .FunctionFactory
    .Instance
    .register("setDefaultFilename", setDefaultFilename);


let json = {
	triggers: [
		{
			type: "runexpression",
			expression: "{name} notempty and {section} notempty",
			runExpression: "setDefaultFilename()"
		}
	],
	checkErrorsMode: "onComplete",
	progressBarType: "buttons",
	showProgressBar: "top",
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
	React.createElement(SurveyReact.Survey, {
		model: survey,
		onValidateQuestion: surveyValidateQuestion
	})
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
			window.location.reload()
		}
	})
	buttonToClone.parentElement.insertBefore(clearFormButton, buttonToClone)
}
setButtons()

function setCompleteButtonText() {
	if (survey.data.submissionType === "new") {
		survey.completeText = "Submit River Suggestion"
	}
	else if (survey.data.submissionType === "edit") {
		survey.completeText = "Copy Output"
	}
	survey.render()
}

survey.getQuestionByName("submissionType").onValueChanged = function() {
	setCompleteButtonText()
}

survey.onComplete.add(function(sender) {
	if (survey.data.submissionType === "new") {
		submitAsNewRiver()
	}
	else if (survey.data.submissionType === "edit") {
		copyStringToClipboard(getSurveyInOldFormat())
		alert("Output Copied!")
	}
});


let lastDispatched = -Infinity;

function saveSurveyToDisk() {
	localStorage.setItem(surveySaveKey, JSON.stringify(survey.data))
}

//This is the biggie - auto-save before unload.
//We adopt a tick-mechanism as backup.
window.addEventListener("beforeunload", saveSurveyToDisk)

function surveyChanged() {
	const dispatchInterval = 5000
	if (Date.now() - lastDispatched > dispatchInterval) {
		lastDispatched = Date.now()
		setTimeout(function() {
			saveSurveyToDisk()
		}, dispatchInterval)
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

setCompleteButtonText() //May change based on the data that is loaded.
survey.getQuestionByName("editRiverInfo").html = calculateEditRiverHTML(survey.data.id) //If there is an old id, display it.
setDefaultFilename()

function getSurveyInRiverFormat() {
	let obj = Object.assign({}, survey.data)

	if (obj.gaugeProvider && obj.gaugeID) {
		obj.gauge = obj.gaugeProvider + ":" + obj.gaugeID
	}

	if (obj.relatedgauges) {
		obj.relatedgauges = obj.relatedgauges.map((gauge) => {return gauge.gaugeProvider + ":" + gauge.gaugeID})
	}

	if (obj.tags) {
		obj.tags = obj.tags.map((tag) => {return tag.tag}).join(",")
	}

	for (let prop in obj) {
		//This deletes id, isGauge, and other properties that we don't want in the previews and final output.
		//This also deletes suggestionEmail, gaugeProvider, and properties specific to the river creator.
		if (!allowed.includes(prop)) {delete obj[prop]}
	}

	return obj
}


function getSurveyInOldFormat() {
	let obj = getSurveyInRiverFormat()
	obj.relatedgauges = JSON.stringify(obj.relatedgauges)

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


const River = require("../src/River.js").River
const Gauge = require("../src/Gauge.js")

window.Gauge = Gauge
window.River = River

function setSurveyFromRiverFormat(riverItem) {
	//Note: This function also copies over fields like "base", "id", and "isGauge".
	//While id is used here, it and other properties like isGauge should not be included in the actual output.
	//They are filtered out when output is generated.
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


if (window.location.hash !== "") {
	;(async function() {
		let fileName = window.root + "riverdata.json"
		let response = await fetch(fileName)
		window.riverarray = await response.json()

		let urlParams = new URLSearchParams(window.location.hash.slice(1))
		let id = urlParams.get("id")

		if (id) {
			let riverItem = riverarray.find((item) => {
				return new River(99999, item).id === id
			})

			console.log(riverItem)

			if (riverItem) {
				if (Object.keys(survey.data).length > 0) {
					if (!confirm(`Are you sure you want to import ${riverItem.name}? This may overwrite saved data for the ${survey.data.name}`)) {
						return
					}
				}
				setSurveyFromRiverFormat(riverItem)
				survey.getQuestionByName("editRiverInfo").html = calculateEditRiverHTML(id, true)
				survey.getQuestionByName("welcomeText").html = calculateWelcomeHTML(id)
			}
			else {
				alert("Link import failed. Please contact support@rivers.run")
			}

			window.location.hash = "#"
		}
	})()
}


function renderPreview() {
	survey.getQuestionByName("riverPreview").html = `<div id="previewContainer"></div>`

	let container = document.getElementById("previewContainer")

	let info = getSurveyInRiverFormat()
	info.id = "123" //Anything random.
	window.ItemHolder = []

	//We need to cache the data, to avoid double rendering.
	window.gauges =  window.gauges || {}
	if (info.gauge) {
		window.gauges[info.gauge] = window.gauges[info.gauge] || new Gauge(info.gauge, {
			readings: [],
			name: "Real graph should load..."
		})
	}

	while (container.firstChild) {container.firstChild.remove()}
	window.ItemHolder[0] = new River(0, info)
	container.appendChild(window.ItemHolder[0].create())
	window.ItemHolder[0].finished.click()
}

survey.onCurrentPageChanged.add(function() {
	if (survey.currentPageNo === 3) {
		setTimeout(renderPreview, 0)
	}
})
