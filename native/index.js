require("../src/allPages/addTags.js")

//Load the entire site into an iframe based on a local server.

const WebServer = require("@ionic-native/web-server").WebServer
let sourceServer = "http://127.0.0.1:6789" //"https://rivers.run"

//If the server is already running, stop it.
WebServer.stop().then(() => {
	const port = 15376

	WebServer.onRequest().subscribe(data => {

	  console.log(data);

	  console.log(data.path)

	  if (data.path.endsWith("/")) {
		  data.path += "index.html"
	  }

	  console.log(data.path)

	  let headers = {
		  'Access-Control-Allow-Origin': "*"
	  }

	  const res = {
		  headers,
		  body: ""
	  };
let log = false
	  //Incomplete list.
	  if (data.path.endsWith(".html")) {
		  headers['Content-Type'] = "text/html"
	  }
	  else if (data.path.endsWith(".css")) {
		  headers['Content-Type'] = "text/css"
	  }
	  else if (data.path.endsWith(".js")) {
		  headers['Content-Type'] = "text/javascript"
	  }
	  else if (data.path.endsWith(".json")) {
		  headers['Content-Type'] = "application/json"
	  }
	  else if (data.path.endsWith(".jpg")){
		  headers['Content-Type'] = "image/jpeg"
		  console.warn("BINARY!")
		  log = true
	  }
	  else {
		  console.warn("UNKNOWN")
	  }

	  //TODO: We need a way to handle images, but the server plugin only does text.
	  //Looks like we should server the path to the file.
	  //When we need to load from network, we may need to write a file then provide the path. A bit weird, but OK.

	  ;((async function() {
		  try {
			  res.status = 200

			  try {
				  //TODO: No cache requests.
				  //Try Network First.
				  await new Promise((resolve, reject) => {
					  fetch(sourceServer + data.path).then((response) => {
						  response.text().then((text) => {
								  Capacitor.Plugins.Filesystem.writeFile({
									  path: data.path,
									  directory: "DATA",
									  data: text,
									  recursive: true,
									  encoding: "utf8"
								  })
								  console.log(text.length)
								  if (log) {
									  console.error("Below")
									  console.log(text)
								  }
							  res.body = text
							  resolve()
						  })
					  })

						  setTimeout(function() {
							  reject("Request Timeout Exceeded. ")
						  }, 1200) //1.2 second fallback.
				  })
			  }
			  catch (e) {
				  //Try filesystem next.
					  console.error(e)
					  try {
						  res.body = (await Capacitor.Plugins.Filesystem.readFile({
							  path: data.path,
							  directory: "DATA",
							  encoding: "utf8"
						  })).data
					  }
					  catch (e) {
						  //Installed with App Last.
						  console.error(e)
						  let req = await fetch(data.path)
						  res.body = await req.text()
					  }
			  }
		  }
		  catch (e) {
			  console.error(e)
			  res.status = 500
		  }
		  finally {
			  if (log) {
				  console.error("Below")
			  }
			 console.log(res)
			// console.log(res.body)
			 WebServer.sendResponse(data.requestId, res)
			 	.catch((error) => console.error(error));
		  }
	  })())
	});

	WebServer.start(port)
	  .catch((error) => console.error(error));

	  let iframe = document.createElement("iframe")
	  iframe.style.border = "none"
	  iframe.style.width = "100%"
	  iframe.style.height = "100%"
	  document.body.appendChild(iframe)

	iframe.src = "http://127.0.0.1:" + port + "/clubs.html"
})
