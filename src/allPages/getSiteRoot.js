//Get the site root of rivers.run
//This should allow rivers.run to the run from a directory or subdirectory.

try {
	let scripts = document.querySelectorAll("script")
	for (let i=0;i<scripts.length;i++) {
		//Find the script tag that is for allPages.js
		if (scripts[i].src.includes("allPages.js")) {
			//Since allPages.js is 2 directories in from the root, go back two directories to find the root.
			let components = scripts[i].src.split("/")
			components.pop()
			components.pop()
			window.root = components.join("/") + "/"
			break;
		}
	}
}
catch(e) {
	console.error(e)
}