const toDecimalDegrees = require("../src/toDecimalDegrees.js")

const allowed = require("../server/allowedFields.js")

const {statesProvincesTerritorys} = require("../src/statesProvincesTerritorys.js")

const {skillLevels} = require("../src/skillTranslations.js")

const gaugeProviders = ["USGS", "NWS", "canada", "streambeam", "ireland", "virtual"]

function getDataFileLink(id) {
	return `https://docs.google.com/document/d/${id}`
}

function calculateWelcomeHTML(id) {
	let str = `Welcome to the Rivers.run River Creator! If you aren't sure where to begin, check the <a target="_blank" href="${window.root + "FAQ.html"}">FAQ</a>!`
	if (id) {
		str += `<br>If you only wish to make minor edits to the river you imported, the data file is <a target="_blank" href="${getDataFileLink(id)}">here</a>. `
	}
	return str
}

function calculateEditRiverHTML(id, recent = false) {
	let str = `You are finished! Click the "Copy Output" button, and paste your output into the ${recent ? `<a target="_blank" href="${getDataFileLink(id)}">river data file</a>` : "river data file"}.`
	if (id && !recent) {
		str += `<br>The data file for the river you last imported is <a target="_blank" href="${getDataFileLink(id)}">here</a> - this may or may not be the file you are looking for. `
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
	else if (options.name === "lat" || options.name === "lon") {
		try {
			toDecimalDegrees(options.value)
		}
		catch (e) {
			options.error = "Unable to Parse Coordinate"
		}
	}
	else if (options.name === "access") {
		let names = options.value.map((ap) => {return ap.name})
		let labels = options.value.map((ap) => {return ap.label})

		if (new Set(names).size !== names.length) {
			options.error = "Duplicate Access Point Names Not Permitted"
		}

		if (labels.reduce((amt, label) => (amt + Number(label == "TO")), 0) > 1) {
			options.error = "Only 1 Primary Take-Out Permitted"
		}

		if (labels.reduce((amt, label) => (amt + Number(label == "PI")), 0) > 1) {
			options.error = "Only 1 Primary Put-In Permitted"
		}
	}
	else if (options.name === "accessOrder") {
		let labels = survey.data.access?.map((ap) => {return ap.label})

		if (!labels) {return} //There are no access points.

		if (labels.indexOf("TO") !== -1 && (labels.indexOf("TO") < labels.indexOf("PI"))) {
			//We don't need to check for indexOf("PI") !== -1, as -1 is never less than another indexOf call.
			options.error = "Take-Out must be after Put-In"
		}
	}
}


//TODO
//Changing gaugeProvider might make a previously invalid code valid.
//Re-run validators.
//Complicated by relatedgauges being in a matrix.
//
// survey.getAllQuestions().filter((question) => {
// 	if (question.name === "gaugeID") {
// 		question.hasErrors()
// 	}
// 	else if (question.name === "relatedgauges") {
// 		question.hasErrors()
// 	}
// })

const gpsCoordinateTooltipMessage = "GPS formats will be converted on export. Please check the preview to ensure your coordinates are parsed correctly. "

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
			title: "River Name",
			placeHolder: "Enter River Name...",
			isRequired: true,
		},
		{
			type: "text",
			name: "section",
			title: "Section Name",
			placeHolder: "Enter Section Name...",
			isRequired: true,
		},
		{
			type: "dropdown",
			name: "skill",
			title: "Skill Level",
			isRequired: true,
			choices: skillLevels.map((item) => {
				return {value: item[0], text: item[1]}
			}),
		},
		{
			type: "text",
			name: "class",
			title: "Class (Ex: II+, IV-V, I-II, etc)",
			placeHolder: "Enter Class...",
		},
		{
			//TODO: Add a bit more granularity - like a slider.
			//We can allow values like 0.25 or 0.4 if users want to use them.
			type: "rating",
			name: "rating",
			title: "River Quality",
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
            type: "matrixdynamic",
            name: "state",
            rowCount: 1,
            minRowCount: 1,
			title: "State/Province",
            addRowText: "Add State/Province",
			removeRowText: "Remove State/Province",
			showHeader: false,
			isRequired: true,
            columns: [
				{
                    name: "state",
					isRequired: true,
                    choices: Object.keys(statesProvincesTerritorys).map((prop) => {
						return {text: statesProvincesTerritorys[prop], value: prop}
					})
                }
			]
		},
		{
            type: "matrixdynamic",
			name: "access",
            rowCount: 2,
            minRowCount: 0,
			title: "Access Points",
			tooltip: "When selecting primary Put-Ins and Take-Outs, please select the longer section unless a shorter section is significantly more popular. ",
			defaultValue: [{name: "Put-In", label: "PI"}, {name: "Take-Out", label: "TO"}],
			addRowText: "Add Another Access Point",
			removeRowText: "Remove Access Point",
            columns: [
				{
					name: "label",
					title: "Type",
					choices: [
						{
							text: "Primary Put-In",
							value: "PI"
						},
						{
							text: "Primary Take-Out",
							value: "TO"
						},
						{
							text: "Access Point",
							value: "A"
						},
					],
					defaultValue: "A",
				},
				{
					cellType: "text",
					name: "name",
					title: "Name",
					placeHolder: "Enter Name... ",
					defaultValue: "Access Point",
				},
				{
					cellType: "text",
					name: "lat",
					title: "GPS Latitude",
					placeHolder: "Enter Latitude... ",
					tooltip: gpsCoordinateTooltipMessage
				},
				{
					cellType: "text",
					name: "lon",
					title: "GPS Longitude",
					placeHolder: "Enter Longitude... ",
					tooltip: gpsCoordinateTooltipMessage
				},
			]
		},
		{
			 type: "ranking",
			 name: "accessOrder",
			 title: "Please Order Access Points: ",
			 tooltip: "Order starting upstream and heading downstream. The Primary Put-In (if present) must be above the Primary Take-Out. ",
			 choices: [],
		 }
	],
}


const flowInfoPage = {
	navigationTitle: "Flow Info",
	navigationDescription: "Gauges & Ranges",
	elements: [
		{
			type: "dropdown",
			name: "gaugeProvider",
			title: "Primary Gauge Provider",
			choices: gaugeProviders,
		},
		{
			type: "text",
			name: "gaugeID",
			title: "Primary Gauge ID",
			placeHolder: "Enter Gauge ID... ",
			isRequired: true,
			// startWithNewLine: false,
			enableIf: "{gaugeProvider} != {default}"
		},
		{
			type: "text",
			name: "minrun",
			title: "Minimum Level",
			placeHolder: "Enter Number... ",
			inputType: "number",
			enableIf: "{gaugeID} != {default}"
		},
		{
			type: "text",
			name: "lowflow",
			title: "Low-Flow Level",
			placeHolder: "Enter Number... ",
			inputType: "number",
			startWithNewLine: false,
			enableIf: "{gaugeID} != {default}"
		},
		{
			type: "text",
			name: "midflow",
			title: "Mid-Flow Level",
			placeHolder: "Enter Number... ",
			inputType: "number",
			startWithNewLine: false,
			enableIf: "{gaugeID} != {default}"
		},
		{
			type: "text",
			name: "highflow",
			title: "High-Flow Level",
			placeHolder: "Enter Number... ",
			inputType: "number",
			startWithNewLine: false,
			enableIf: "{gaugeID} != {default}"
		},
		{
			type: "text",
			name: "maxrun",
			title: "Maximum Level",
			placeHolder: "Enter Number... ",
			inputType: "number",
			startWithNewLine: false,
			enableIf: "{gaugeID} != {default}"
		},
		{
			type: "dropdown",
			name: "relativeflowtype",
			title: "Relative Flow Units",
			choices: ["cfs", "feet", "cms", "meters"],
			isRequired: true,
			startWithNewLine: false,
			enableIf: "{minrun} != {default} or {lowflow} != {default} or {midflow} != {default} or {highflow} != {default} or {maxrun} != {default}"
		},
		{
            type: "matrixdynamic",
			name: "relatedgauges",
            rowCount: 0,
            minRowCount: 0,
			enableIf: "{gaugeID} != {default}",
			title: "Related Gauges",
			addRowText: "Add Another Gauge",
			removeRowText: "Remove Gauge",
            columns: [
				{
					name: "gaugeProvider",
					title: "Gauge Provider",
					isRequired: true,
					choices: gaugeProviders,

				},
				{
					cellType: "text",
					name: "gaugeID",
					title: "Gauge ID",
					isRequired: true,
					placeHolder: "Enter Gauge ID... ",
				},
			]
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
			title: "AW River Number",
			placeHolder: "Enter AW River Number... ",
		},
		{
			type: "text",
			name: "tags",
			title: "Tags",
			placeHolder: "Enter Tags... ",
			tooltip: "Comma Seperated, Spaces Optional. "
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
			html: "Preview Should Appear Below:",
		},
		{
			type: "html",
			name: "riverPreview",
			html: "River Preview Should Appear Here",
		},
		{
			type: "radiogroup",
			name: "submissionType",
			title: "Submission Type",
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
			title: "File Name for this Suggestion",
			placeHolder: "Enter File Name... ",
			visibleIf: "{submissionType}='new'"
		},
		{
			type: "text",
			name: "suggestionEmail",
			inputType: "email",
			title: "Contact Email for this Suggestion",
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



Survey
	.Serializer
	.addProperty("question", "tooltip:text");

function showTooltip(element) {
	let dialog = document.createElement("dialog")
	document.body.appendChild(dialog)
	dialog.innerHTML = element.tooltip
	dialog.showModal()
	dialog.addEventListener("click", function() {
		dialog.remove()
	})
}

let json = {
	triggers: [
		{
			type: "runexpression",
			expression: "{name} notempty and {section} notempty",
			runExpression: "setDefaultFilename()"
		}
	],
	focusFirstQuestionAutomatic: false,
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


survey
    .onAfterRenderQuestion
    .add(function (survey, options) {
        if (!options.question.tooltip) {return}
		if (!window.HTMLDialogElement) {return} //We use the HTMLDialogElement for the dialogs - just disable these dialogs if it isn't supported.

        let btn = document.createElement("button");
        btn.type = "button";
		btn.innerHTML = "?";
        btn.style.position = "absolute";
        btn.style.marginLeft = "6px"
		btn.style.padding = "0px 5px"
		btn.style.background = "#00000022"
		btn.style.borderRadius = "100px"
		btn.style.border = "1px dashed"
		btn.style.cursor = "pointer"

        let question = options.question;
        btn.onclick = function () {
            showTooltip(question);
        }

        let header = options
            .htmlElement
            .querySelector("h5");

        if (!header) {
			header = options.htmlElement;
		}

        let span = document.createElement("span");
        span.innerHTML = "  ";
        header.appendChild(span);
        header.appendChild(btn);
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

//Repeated attempts to set accessQuestion's order to the order in accessOrderQuestion just resulted in a multitude of
//infinite loop problems due to assigning values triggering the other event listener, etc.
//While there were some successes, surprise infinite loops were always found.
//Therefore, the two are not synced. If you attempt to sync them, you have been warned: Proceed at the risk of wasting your time.
let accessQuestion = survey.getQuestionByName("access")
let accessOrderQuestion = survey.getQuestionByName("accessOrder")
function syncChoices() {
	if (accessQuestion.hasErrors()) {
		//Ranking elements appears to glitch when there are duplicate elements.
		//We'll just require no duplicate elements.
		return;
	}

	accessOrderQuestion.hasErrors()

	let accessPoints = accessQuestion.value
	let namesInAccess = accessPoints.map((item) => {return item.name})

	accessOrderQuestion.choices = namesInAccess
}

accessOrderQuestion.onValueChanged = function() {
	accessOrderQuestion.hasErrors()
}
accessQuestion.onValueChanged = syncChoices
syncChoices()

function getSurveyInRiverFormat() {
	let obj = Object.assign({}, survey.data)

	obj.writeup = obj.writeup?.split("\n")?.join("") //CKEditor pretty prints HTML. Undo the pretty printing so it is one line.

	if (obj.gaugeProvider && obj.gaugeID) {
		obj.gauge = obj.gaugeProvider + ":" + obj.gaugeID
	}

	if (obj.relatedgauges) {
		obj.relatedgauges = obj.relatedgauges.map((gauge) => {return gauge.gaugeProvider + ":" + gauge.gaugeID})
	}

	if (obj.state) {
		obj.state = obj.state.map((state) => {return state.state}).join(",")
	}

	if (obj.access) {
		obj.access = obj.access.slice(0).map((itemInSurvey) => {
			let item = Object.assign({}, itemInSurvey) //Copy the item to avoid modifying in survey.
			if (item.label === "A") {delete item.label}
			item.lat = toDecimalDegrees(item.lat)
			item.lon = toDecimalDegrees(item.lon)
			return item
		})

		if (obj.accessOrder) {
			//The default order must have been correct - the user never touched the question.
			obj.sort((row1, row2) => {
				let r1Index = obj.accessOrder.indexOf(row1.name)
				let r2Index = obj.accessOrder.indexOf(row2.name)
				return r1Index - r2Index
			})
		}
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
	obj.access = JSON.stringify(obj.access)

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

	river.state = river.state.split(",").map((state) => {return {state}})

	if (river.relatedgauges) {
		river.relatedgauges = river.relatedgauges.map((gaugeID) => {
			let gauge = new Gauge(gaugeID)
			return {gaugeProvider: gauge.prefix, gaugeID: gauge.gaugeID}
		})
	}

	if (river.access) {
		river.access.forEach((ap) => {
			if (!ap.propertyIsEnumerable("label")) {
				ap.label = "A"
			}
		})
		river.access = river.access.filter((item) => {
			if (item.name === "Gauge" && river.isGauge) {
				//Do not import access points named "Gauge" from gauges.
				return false
			}
			return true
		})

		if (river.access.length === 0) {
			river.access = survey.getQuestionByName("access").defaultValue
		}
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
				//We will assume that if no name has been entered, there is not a river being worked on.
				//That assumption is probably reasonable, and means we don't need to worry about things getting set during initialization.
				if (!survey.data.name || confirm(`Are you sure you want to import ${riverItem.name}? This may overwrite saved data for the ${survey.data.name}`)) {
					setSurveyFromRiverFormat(riverItem)
					survey.getQuestionByName("editRiverInfo").html = calculateEditRiverHTML(id, true)
					survey.getQuestionByName("welcomeText").html = calculateWelcomeHTML(id)
				}
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
