//This script should be transpiled, then put into the script tag in virtualGaugeCalculator.html
//This is done so that the sandbox can be entirely isolated from the internet.

//The scope that the messages are broadcast to will need to be checked. Multiple open rivers.run tabs may cause excessive workloads otherwise.

//code is the function (or stringified function) to be run.
//options can contain the following properties:
	//parameters - Used to pass parameters to the function that is being run.

function runBackground(code, options) {

	let text;
	let obj = {}


	let parameters = options.parameters || [];

	//Allow the user to pass just a single parameter
	if (parameters.length === undefined || typeof parameters === "string") {
		parameters = [parameters]
	}

	console.log(parameters)

	//TODO: Replace async/await with promises.
	text = `
self.onmessage = function(parameters) {
	parameters = parameters.data
	let result = (${code})(...parameters);
	postMessage({
		type:"message",
		finished:true,
		content:result
	})
}`
	console.log(text)



	let blob = new Blob([text])
	let url = URL.createObjectURL(blob)


	//obj.onmessage and obj.onerror should be used instead of obj.worker.onmessage

	obj.worker = new Worker(url)

	//The worker doesn't actually activate until obj.init() is called.
	obj.result = new Promise(function(resolve,reject){

		//Handle messages from worker
		obj.worker.onmessage = function(message) {

			message = message.data

			if (message.finished) {
				//Return the final value
				resolve(message.content)
			}
			else if (obj.onmessage) {
			 obj.onmessage(message)
			}

		}

		//Force people to use obj.onmessage instead of obj.worker.onmessage
		//We don't want them overwriting our listeners

		Object.defineProperty(obj.worker, "onmessage", {
			configurable:false,
			writable: false,
			value: obj.worker.onmessage //If I inlined the function here, it wasnt working
		})

	})

	obj.init = function() {
		obj.worker.postMessage(parameters)
		delete obj.init;
		return obj; //Allow chaining
	}


	return obj;
}


window.addEventListener('message', function (event) {
  if (event.origin !== window.location.origin) {
	console.log(event.origin + " is not permitted to use this iframe.")
	return "Your origin is not permitted to use this iframe";
  }

  var mainWindow = event.source;
  var data = event.data

  console.log(event)

  if (event.data.type === "usgsarray") {
	  //TODO: Lock out old calculations when this changes.
	  window.usgsarray = event.data.data
	  mainWindow.postMessage({type: "confirmation", result:"usgsarray"}, event.origin);
	  console.log(window.usgsarray)
  }
  else if (event.data.type === "calculation") {
	  let usgsSites = event.data.usgsSites
	  let requestedSites = {}
	  for (let i=0;i<usgsSites.length;i++) {
		  requestedSites[usgsSites[i]] = usgsarray[usgsSites[i]]
	  }
	  console.log(requestedSites)
	  runBackground(event.data.function, {parameters: [requestedSites]}).init().result.then((result) => {
		  //Unnesssasary sanitatiion
		  if (typeof result !== "object" || !result) {
			  result = undefined
			  console.warn(event.data.gaugeID + " failed to return an object, and instead returned " + result)
		  }
		  else {
			  let keys = Object.keys(result)
			  for (let i=0;i<keys.length;i++) {
				  if (!["00060", "00065"].includes(keys[i])) {
					  console.warn(event.data.gaugeID + " returned a property named " + keys[i] + ", which is not allowed.")
					  delete result[keys[i]]
				  }
			  }
			  result.name = event.data.gaugeID
			  usgsarray[event.data.gaugeID] = result
		  }
		  mainWindow.postMessage({type:"calculation", gaugeID: event.data.gaugeID, result}, event.origin);
	  })
  }
});
