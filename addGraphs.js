
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


function addCanvasAsImage(appendTo, canvas) {
    //For some reason, only the last canvas was showing. Use images.
	//I tried using blob urls instead of dataurls to improve performance, but they didn't help, and actually made things WORSE!!!
    //Images also allow "Save Image As"
    let img = document.createElement("img")
    img.className = "graph"

	img.src = canvas.toDataURL("image/png")

    appendTo.appendChild(img)
}

//In dark mode, blue doesn't show up well enough, so different colors are used.


function addFlowGraph(div, cfs, height, data) {
    //Make sure we actually have some data, and don't create an empty graph
    if (!(cfs || height)) {return}

    let canvas = createcanvas()
    //Time to create a dual lined graph!
    if (cfs && height) {
        let parts = toparts(cfs.values)
        addLine("cfs", parts.timestamps, data.name, canvas, 0, parts.values, "#00CCFFa0", 2)
        parts = toparts(height.values)
        addLine("height", parts.timestamps, data.name, canvas, 0, parts.values,  window.darkMode?"#6bedb2a0":"#0000FFa0", 2, 1)
    }
    //We won't have both cfs and height. Draw a single line graph for whichever we have.
    else if (cfs) {
        let parts = toparts(cfs.values)
        addLine("cfs", parts.timestamps, data.name, canvas, 0, parts.values, "#00CCFF")
    }
    else {
        let parts = toparts(height.values)
        addLine("height", parts.timestamps, data.name, canvas, 0, parts.values,  window.darkMode?"#6bedb2":"blue")
    }

	return addCanvasAsImage(div, canvas)
}


function addTempGraph(div, temp, data) {
    if (temp) {
        let canvas = createcanvas()

        let parts = toparts(temp.values)
        addLine("", parts.timestamps, data.name, canvas, 0, parts.values, "red", 3, window.darkMode?"#00AAFF":"blue")

 		return addCanvasAsImage(div, canvas)

    }
}



function addPrecipGraph(div, precip, data) {
    if (precip) {
        let canvas = createcanvas()

        let parts = toparts(precip.values)
        addLine("Precipitation", parts.timestamps, data.name, canvas, 0, parts.values, "#0099FF")

		return addCanvasAsImage(div, canvas)
    }
}


function addGraphs(div, data) {

    //The graphing is wrapped in a try-catch statement because USGS often supplies invalid data
    //for a specific river due to gauge problems.
    //Each canvas is wrapped individually because sometimes only some graphs have invalid data

    let temp = data["00010"]
    let precip = data["00045"]
    let cfs = data["00060"]
    let height = data["00065"]



    try {
        addFlowGraph(div, cfs, height, data)
    }
    catch(e){console.warn("Error creating flow graph: " + e)}

    try {
        addTempGraph(div, temp, data)
    }
    catch(e){console.warn("Error creating temperature graph: " + e)}

    try {
        addPrecipGraph(div, precip, data)
    }
    catch(e){console.warn("Error creating precipitation graph: " + e)}
}


export {
    addGraphs
}
