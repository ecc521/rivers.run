let sandbox = document.createElement("iframe")
sandbox.sandbox = "allow-scripts"
sandbox.src = "virtualGaugeCalculator.html" //Consider inlining this in srcdoc
sandbox.style.display = "none"
document.body.appendChild(sandbox)
window.sandbox = sandbox


//TODO: Try to make sure that errors in the sandbox get reported. To keep the sandbox seperated from the internet, this probably requires an error message to be sent here,
//then send out to the internet.

function updateSandboxData() {
	sandbox.contentWindow.postMessage({type: "usgsarray", data: usgsarray}, '*');
	return new Promise((resolve, reject) => {
		function resolveOnConfirmation(event) {
			if ((event.origin === "null" && event.source === sandbox.contentWindow)) {
				if (event.data.type === "confirmation" && event.data.result === "usgsarray") {
					window.removeEventListener("message", resolveOnConfirmation)
					resolve();
				}
            }
		}
		window.addEventListener("message", resolveOnConfirmation)
	})
}

let oldUSGSDataAge;
let updatePromise;

async function createVirtualGauge(river) {
	if (oldUSGSDataAge !== window.usgsDataAge) {
		if (!updatePromise) {updatePromise = updateSandboxData()}
		await updatePromise
		updatePromise = undefined
	}
	//TODO: Some virtual gauges may depend upon another virtual gauge. Use river.relatedusgs to tell which gauges are depended upon, and wait until those gauges finish.

	//TODO: Detect when two rivers use the same virtual gauge name, but the gauge has different values.
	//When this happens, log a warning and add an extension to later gauges.

	//The virtualGauge parameter is a stringified function.
	//That function will run with access to all the gauges that are specified in river.relatedusgs (to force related gauges to be put into river.relatedusgs).
	//It will return an object containing 00060 (cfs) and/or 00065 (feet)

	//Try to make sure an infinite loop in the virtual gauge code doesn't cause issues.

	sandbox.contentWindow.postMessage({type: "calculation", usgsSites: river.relatedusgs, gaugeID: river.usgs, function:river.virtualgauge}, '*');

	await new Promise((resolve, reject) => {
		function receiveResult(event) {
			if ((event.origin === "null" && event.source === sandbox.contentWindow)) {
				if (event.data.type === "calculation" && event.data.gaugeID === river.usgs) {
					usgsarray[river.usgs] = event.data.result
					window.removeEventListener("message", receiveResult)
					resolve();
				}
            }
		}
		window.addEventListener("message", receiveResult)
	})
}

export {
	createVirtualGauge
}


window.createVirtualGauge = createVirtualGauge
console.log(createVirtualGauge)
