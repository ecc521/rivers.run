
//Auxillary Function
//Creates the canvas used by each of the graphs
function createcanvas() {
    let canvas = document.createElement("canvas")
    canvas.width = 1200
    canvas.height = 800

    //Make sure the background is not transparent
    let ctx = canvas.getContext("2d");
    if (!window.darkMode) {
        ctx.fillStyle = "white";
    }
    else {
        //Dark Mode
        ctx.fillStyle = "black"
    }
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    return canvas
}


//Auxillary Function
function toparts(arr) {
    let values = []
    let timestamps = []

    for (let i=0;i<arr.length;i++) {
        let obj = arr[i]
        values.push(obj.value)
        timestamps.push(obj.dateTime)
    }

    return {values:values,timestamps:timestamps}
}


function getCanvasAsImage(canvas) {
    //For some reason, only the last canvas was showing. Use images.
	//I tried using blob urls instead of dataurls to improve performance, but they didn't help, and actually made things WORSE!!!
    //Images also allow "Save Image As"
    let img = document.createElement("img")
    img.className = "graph"

	img.src = canvas.toDataURL("image/png")

    return img
}

//In dark mode, blue doesn't show up well enough, so different colors are used.


function getFlowGraph(cfs, height, data) {
    //Make sure we actually have some data, and don't create an empty graph
    if (!(cfs || height)) {return}

    let canvas = createcanvas()
    //Time to create a dual lined graph!
    if (cfs && height) {
        let parts = toparts(cfs)
        addLine("cfs", parts.timestamps, data.name, canvas, 0, parts.values, "#00CCFFa0", 2)
        parts = toparts(height)
        addLine("height", parts.timestamps, data.name, canvas, 0, parts.values,  window.darkMode?"#7175f0a0":"#0000FFa0", 2, 1)
    }
    //We won't have both cfs and height. Draw a single line graph for whichever we have.
    else if (cfs) {
        let parts = toparts(cfs)
        addLine("cfs", parts.timestamps, data.name, canvas, 0, parts.values, "#00CCFF")
    }
    else {
        let parts = toparts(height)
        addLine("height", parts.timestamps, data.name, canvas, 0, parts.values,  window.darkMode?"#7175f0":"blue")
    }

	return getCanvasAsImage(canvas)
}


function getTempGraph(temp, data) {
    if (temp) {
        let canvas = createcanvas()

        let parts = toparts(temp)
        addLine("", parts.timestamps, data.name, canvas, 0, parts.values, "red", 3, window.darkMode?"#00AAFF":"blue")

 		return getCanvasAsImage(canvas)
    }
}



function getPrecipGraph(precip, data) {
    if (precip) {
        let canvas = createcanvas()

        let parts = toparts(precip)
        addLine("Precipitation", parts.timestamps, data.name, canvas, 0, parts.values, "#0099FF")

		return getCanvasAsImage(canvas)
    }
}

function getButton(text, className) {
	let button = document.createElement("button")
	button.innerHTML = text
	button.className = className
	button.style.padding = "8px"
	button.style.minWidth = "20vw"
	button.style.fontSize = "16px"
	return button
}

function addGraphs(div, data) {

    //The graphing is wrapped in a try-catch statement because USGS often supplies invalid data
    //for a specific river due to gauge problems.
    //Each canvas is wrapped individually because sometimes only some graphs have invalid data

	let container = document.createElement("div")
	let graphs = []
	container.style.textAlign = "center"
	
	//TODO: We only need to synchronusly render the first graph, as only one will be displayed at once. 
	//This will lead to speed increases when .riverbuttons are clicked.
    try {
        if (!localStorage.getItem("colorBlindMode")) {
            let flowGraph = getFlowGraph(data.cfs, data.feet, data)
			if (flowGraph) {
				graphs.push({
					text: "Flow Info",
					className: "flowButton",
					elem: flowGraph
				})
			}
        }

        else {
            //Use one graph for cfs and one for feet if the user is in color blind mode.
            let cfsGraph = getFlowGraph(data.cfs, undefined, data)
			if (cfsGraph) {
				graphs.push({
					text: "Flow In CFS",
					className: "flowButton",
					elem: cfsGraph
				})
			}
            let feetGraph = getFlowGraph(undefined, data.feet, data)
			if (feetGraph) {
				graphs.push({
					text: "Flow In Feet",
					className: "flowButton",
					elem: feetGraph
				})
			}
        }
    }
    catch(e){console.warn("Error creating flow graph: " + e)}

    try {
        let tempGraph = getTempGraph(data.temp, data)
		if (tempGraph) {
			graphs.push({
				text: "Water Temperature",
				className: "tempButton",
				elem: tempGraph
			})
		}
    }
    catch(e){console.warn("Error creating temperature graph: " + e)}

    try {
        let precipGraph = getPrecipGraph(data.precip, data)
		if (precipGraph) {
			graphs.push({
				text: "Precipitation",
				className: "precipButton",
				elem: precipGraph
			})
		}
    }
    catch(e){console.warn("Error creating precipitation graph: " + e)}
	
	let buttonContainer = document.createElement("div")
	if (graphs.length > 1) {
		//We don't need to show selection buttons if we only have one graph.
		container.appendChild(buttonContainer)
	}	
	//Add the starting graph - the flow graph.
	container.appendChild(graphs[0].elem)
	
	graphs.forEach((data) => {
		let button = getButton(data.text, data.className)	   
		button.addEventListener("click", function() {
			let oldGraph = container.querySelector(".graph")
			container.replaceChild(data.elem, oldGraph)
		})
		buttonContainer.appendChild(button)
	})
	
	div.appendChild(container)
}


module.exports = {
    addGraphs
}
