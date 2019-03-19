module.exports.addGraphs = function(div, data) {


    //The graphing is wrapped in a try-catch statement because USGS often supplies invalid data
    //for a specific river due to gauge problems.
    //Each canvas is wrapped individually because sometimes only some graphs have invalid data
    div.innerHTML += "<br><br>" //Space the first canvas

    let temp = data["00010"]
    let precip = data["00045"]
    let cfs = data["00060"]
    let height = data["00065"]


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

    //Auxillary Function
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

    try {
        if (cfs||height) {
            let canvas1 = createcanvas()

            if (cfs && height) {
                let parts = toparts(cfs.values)
                addLine("cfs", parts.timestamps, data.name, canvas1, 0, parts.values, "#00AAFFa0", 2)
                parts = toparts(height.values)
                addLine("height", parts.timestamps, data.name, canvas1, 0, parts.values, "#2222FFa0", 2, 1)                
            }
            else if (cfs) {
                let parts = toparts(cfs.values)
                addLine("cfs", parts.timestamps, data.name, canvas1, 0, parts.values, "#00AAFF")
            }
            else {
                let parts = toparts(height.values)
                addLine("height", parts.timestamps, data.name, canvas1, 0, parts.values, "#2222FF")    
            }

            //For some reason, only the last canvas was showing. Use images
            //Images also allow "Save Image As"
            let img = document.createElement("img")
            img.className = "graph"
            //Blobs may be faster - but I don't know of a synchronus method
            img.src = canvas1.toDataURL("image/png")

            div.appendChild(img)
        }
    }
    catch(e){console.warn("Graphing Error: " + e)}

    try {
        if (temp) {
            let canvas2 = createcanvas()

            let parts = toparts(temp.values)
            addLine("", parts.timestamps, data.name, canvas2, 0, parts.values, "#FF0000", 3, "#0000FF")

            //For some reason, only the last canvas was showing. Use images
            //Images also allow "Save Image As"
            let img = document.createElement("img")
            img.className = "graph"
            img.src = canvas2.toDataURL("image/png")
            div.appendChild(img)
        }
    }
    catch(e){console.warn("Graphing Error: " + e)}

    try {
        if (precip) {
            let canvas3 = createcanvas() 

            let parts = toparts(precip.values)
            addLine("Precipitation", parts.timestamps, data.name, canvas3, 0, parts.values, "#0066FF")

            //For some reason, only the last canvas was showing. Use images
            //Images also allow "Save Image As"
            let img = document.createElement("img")
            img.className = "graph"
            img.src = canvas3.toDataURL("image/png")
            div.appendChild(img)
        }
    }
    catch(e){console.warn("Graphing Error: " + e)}
}
