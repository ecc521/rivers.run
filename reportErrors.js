let loadURL = require("./sendOffData.js").loadURL
let userInfo = require("./collectVisitorInformation.js").data

function reportError(...error) {

	for (let i=0;i<error.length;i++) {
		//Make sure some non-enumerable properties are included.
		error[i] = JSON.parse(JSON.stringify(error[i], ["message", "arguments", "type", "name"]))
	}

	let data = {
		userInfo,
		error
	}

	let formURL = "https://docs.google.com/forms/d/e/1FAIpQLSd9h20lDBD4kTaNH8Ko6CAG9RGH1VCWwJKdfID_5RTTywTkFQ/formResponse?ifq&entry.1198287313=" + JSON.stringify(data) + "&submit=Submit"
	formURL = encodeURI(formURL)

	loadURL(formURL)
}


try {
	(function() {
		let _error = console.error;
		console.error = function(...data){
			_error(...data);
			reportError(...data);
		}
	}())
}
catch (e) {
	console.error(e) //PLEASE DON'T EVER RUN!
}

try {
	window.addEventListener("error", reportError, {passive:true, capture:true},  true, true)
}
catch (e) {
	console.error(e) //PLEASE DON'T EVER RUN!
}

try {
	window.addEventListener("unhandledrejection", reportError, {passive:true, capture:true}, true, true)
}
catch (e) {
	console.error(e) //PLEASE DON'T EVER RUN!
}

try {
	document.addEventListener("error", reportError, {passive:true, capture:true},  true, true)
}
catch (e) {
	console.error(e) //PLEASE DON'T EVER RUN!
}
