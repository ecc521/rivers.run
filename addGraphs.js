
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


function addFlowGraph(div, cfs, height) {
    //Make sure we actually have some data, and don't create an empty graph
    if (cfs || height) {
        let canvas = createcanvas()
        if (cfs && height) {
            let parts = toparts(cfs.values)
            addLine("cfs", parts.timestamps, data.name, canvas, 0, parts.values, "#00AAFFa0", 2)
            parts = toparts(height.values)
            addLine("height", parts.timestamps, data.name, canvas, 0, parts.values, "#2222FFa0", 2, 1)                
        }
        else if (cfs) {
            let parts = toparts(cfs.values)
            addLine("cfs", parts.timestamps, data.name, canvas, 0, parts.values, "#00AAFF")
        }
        else {
            let parts = toparts(height.values)
            addLine("height", parts.timestamps, data.name, canvas, 0, parts.values, "#2222FF")    
        }

        //For some reason, only the last canvas was showing. Use images
        //Images also allow "Save Image As"
        let img = document.createElement("img")
        img.className = "graph"
        //Blobs may be faster - but I don't know of a synchronus method
        img.src = canvas.toDataURL("image/png")

        div.appendChild(img)
    }
}


function addTempGraph(div, temp) {
    if (temp) {
        let canvas = createcanvas()

        let parts = toparts(temp.values)
        addLine("", parts.timestamps, data.name, canvas, 0, parts.values, "#FF0000", 3, "#0000FF")

        //For some reason, only the last canvas was showing. Use images
        //Images also allow "Save Image As"
        let img = document.createElement("img")
        img.className = "graph"
        img.src = canvas.toDataURL("image/png")
        div.appendChild(img)
    }
}



function addPrecipGraph(div, precip) {
    if (precip) {
        let canvas = createcanvas() 

        let parts = toparts(precip.values)
        addLine("Precipitation", parts.timestamps, data.name, canvas, 0, parts.values, "#0066FF")

        //For some reason, only the last canvas was showing. Use images
        //Images also allow "Save Image As"
        let img = document.createElement("img")
        img.className = "graph"
        img.src = canvas.toDataURL("image/png")
        div.appendChild(img)
    }
}


module.exports.addGraphs = function(div, data) {

    //The graphing is wrapped in a try-catch statement because USGS often supplies invalid data
    //for a specific river due to gauge problems.
    //Each canvas is wrapped individually because sometimes only some graphs have invalid data
    div.innerHTML += "<br><br>" //Space the first canvas

    let temp = data["00010"]
    let precip = data["00045"]
    let cfs = data["00060"]
    let height = data["00065"]


    try {
        addFlowGraph(div, cfs, height)
    }
    catch(e){console.warn("Error creating flow graph: " + e)}

    try {
        addTempGraph(div, temp)
    }
    catch(e){console.warn("Error creating temperature graph: " + e)}

    try {
        addPrecipGraph(div, precip)
    }
    catch(e){console.warn("Error creating precipitation graph: " + e)}
}
