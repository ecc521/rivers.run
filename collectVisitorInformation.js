let previousVisits = (Number(localStorage.getItem("previousVisits")) || 0)
localStorage.setItem("previousVisits", previousVisits + 1)


//Data that we are collecting
//the useragent is last, because iOS is sonmetimes terminating the data sent after or part way through the useragent. Not sure why.
let data = {
	selectedColorScheme: localStorage.getItem("prefersDarkMode"), //Determining if you explicitly selected a color scheme
	usingDarkMode: window.darkMode, //Determining if you are using dark mode
	supportsDarkMode: window.matchMedia('(prefers-color-scheme: dark)').media !== "not all", //Determine if your browser supports automatic dark mode
	online: navigator.onLine, //Detect if the offline version of the site is being used
	hasServiceWorkers: 'serviceWorker' in navigator,//Detect if the browser supports serviceworkers
	timeStamp: Date.now(), //What time the page was visited at.
	referrer: document.referrer, //Used to detect how navigation is used
	previousVisits, //Used to detect if a visitor is unique
	url: window.location.href, //Used to eliminate data sent due to development work
    userAgent: navigator.userAgent, //Information about the browser
}

//URL to submit the data to
let formURL = "https://docs.google.com/forms/d/e/1FAIpQLSfyTHeq0fp6-iofQacxfXcsSGjYymLJbLOPmlBBKBtttWvtcA/formResponse?ifq&entry.1198287313=" + JSON.stringify(data) + "&submit=Submit"
formURL = encodeURI(formURL)


require("./sendOffData.js").loadURL(formURL)

module.exports = {data}
