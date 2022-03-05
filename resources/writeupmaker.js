const skillLevels = [
	["?", "Skill Unknown"],
	["FW", "Flat Water"],
	["B", "Beginner"],
	["N", "Novice"],
	["N+", "Novice Plus"],
	["LI-", "Low-Intermediate Minus"],
	["LI", "Low-Intermediate"],
	["LI+", "Low-Intermediate Plus"],
	["I-", "Intermediate Minus"],
	["I", "Intermediate"],
	["I+", "Intermediate Plus"],
	["HI-", "High-Intermediate Minus"],
	["HI", "High-Intermediate"],
	["HI+", "High-Intermediate Plus"],
	["A-", "Advanced Minus"],
	["A", "Advanced"],
	["A+", "Advanced Plus"],
	["E-", "Expert Minus"],
	["E", "Expert"],
	["E+", "Expert Plus"],
]

//TODO: Add validation.
let json = {
	showCompletedPage: false,
	showQuestionNumbers: "off",
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
			name: "section",
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
			type: "dropdown",
			name: "gaugeProvider",
			title: "Primary Gauge Provider: ",
			choices: ["USGS", "NWS", "canada", "streambeam", "ireland"],
		},
		{
			type: "text",
			name: "gaugeID",
			title: "Primary Gauge ID: ",
			placeHolder: "Enter Gauge ID... ",
			isRequired: true,
			visibleIf: "{gaugeProvider} != {default}"
		},


		{
			type: "text",
			name: "minrun",
			title: "Minimum Level: ",
			placeHolder: "Enter Number... ",
			inputType: "number",
			visibleIf: "{gaugeID} != {default}"
		},
		{
			type: "text",
			name: "lowflow",
			title: "Low-Flow Level: ",
			placeHolder: "Enter Number... ",
			inputType: "number",
			startWithNewLine: false,
			visibleIf: "{gaugeID} != {default}"
		},
		{
			type: "text",
			name: "midflow",
			title: "Mid-Flow Level: ",
			placeHolder: "Enter Number... ",
			inputType: "number",
			startWithNewLine: false,
			visibleIf: "{gaugeID} != {default}"
		},
		{
			type: "text",
			name: "highflow",
			title: "High-Flow Level: ",
			placeHolder: "Enter Number... ",
			inputType: "number",
			startWithNewLine: false,
			visibleIf: "{gaugeID} != {default}"
		},
		{
			type: "text",
			name: "maxrun",
			title: "Maximum Level: ",
			placeHolder: "Enter Number... ",
			inputType: "number",
			startWithNewLine: false,
			visibleIf: "{gaugeID} != {default}"
		},
		{
			type: "dropdown",
			name: "relativeFlowUnits",
			title: "Relative Flow Units: ",
			choices: ["cfs", "feet", "cms", "meters"],
			isRequired: true,
			startWithNewLine: false,
			visibleIf: "{gaugeID} != {default}",
			enableIf: "{minrun} != {default} or {lowflow} != {default} or {midflow} != {default} or {highflow} != {default} or {maxrun} != {default}"
		},

		{
			type: "paneldynamic",
			name: "relatedGauges",
			visibleIf: "{gaugeID} != {default}",
			title: "Related Gauges: ",
			keyName: "name", //TODO: What is this???
			showQuestionNumbers: "off",
			templateElements: [
				{
					type: "dropdown",
					name: "gaugeProvider",
					title: "Gauge Provider: ",
					isRequired: true,
					choices: ["USGS", "NWS", "canada", "streambeam", "ireland"],
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
	]
};

Survey.StylesManager.applyTheme("modern");

window.survey = new Survey.Model(json);

// if (survey.hasErrors()) {
// 	//Focus the first question with errors.
// 	let questionsWithErrors = survey.getAllQuestions().filter((question) => question.hasErrors())
// 	if (questionsWithErrors.length > 0) {
// 		questionsWithErrors[0].focus()
// 		// return
// 	}
// }


survey
.onComplete
.add(function (sender) {
	document
	.querySelector('#surveyResult')
	.textContent = "Result JSON:\n" + JSON.stringify(sender.data, null, 3);

	setTimeout(function() {
		survey.isCompleted = false
	}, 0)
});

// survey.data = {
//     name: 'John Doe',
//     email: 'johndoe@nobody.com',
//     car: ['Ford']
// };

ReactDOM.render(
	React.createElement(SurveyReact.Survey, {model: survey})
	, document.getElementById("surveyElement"));
