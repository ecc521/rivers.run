
let data = {
  userAgent: navigator.userAgent
}

let formURL = "https://docs.google.com/forms/d/e/1FAIpQLSfyTHeq0fp6-iofQacxfXcsSGjYymLJbLOPmlBBKBtttWvtcA/formResponse?ifq&entry.1198287313=" + JSON.stringify(data) + "&submit=Submit"


fetch(formURL, {mode: "no-cors"})
