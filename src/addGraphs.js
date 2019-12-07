const {createGraph} = require("./graph.js")

function getFlowGraph(data, doNotInclude) {
    //doNotInclude - pass either "cfs" or "feet" to not include specified graph.
    let cfsConfig = {
        name: "Flow (Cubic Feet/Second)",
        textColor: "#00CCFF",
        legendTextColor: "#00CCFF",
        lines: [
            {
                color: "#00CCFF",
                xAlias: "dateTime",
                yAlias:"cfs",
                points: data.readings
            }
        ]
    }

    let feetConfig = {
        name: "Gauge Height (Feet)",
        //In dark mode, blue doesn't show up well enough, so different colors are used.
        textColor: window.darkMode?"#7175ff":"blue",
        legendTextColor: window.darkMode?"#7175ff":"blue",
        lines: [
            {
                color: window.darkMode?"#7175ff":"blue",
                xAlias: "dateTime",
                yAlias:"feet",
                points: data.readings
            }
        ]
    }

    let graph = createGraph({
        name: data.name,
        backgroundColor: window.darkMode?"black":"white",
        graphNameColor: window.darkMode?"white":"black",
        legendLineColor: window.darkMode?"white":"black",
        width: 1200,
        height: 800,
        x1: {
            textColor: window.darkMode?"white":"black",
        },
        y1: (doNotInclude !== "cfs")?cfsConfig:undefined,
        y2: (doNotInclude !== "feet")?feetConfig:undefined
    })
    graph.className = "graph"
    return graph
}


function getTempGraph(data) {
    let graph = createGraph({
        name: data.name,
        backgroundColor: window.darkMode?"black":"white",
        graphNameColor: window.darkMode?"white":"black",
        legendLineColor: window.darkMode?"white":"black",
        width: 1200,
        height: 800,
        x1: {
            textColor: window.darkMode?"white":"black",
        },
        y1: {
            name: "Water Temperature (°F)",
            textColor: [[0, window.darkMode?"#00AAFF":"blue"], [1, "red"]],
            legendTextColor: [[0, window.darkMode?"#00AAFF":"blue"], [1, "red"]],
            lines: [
    			{
                    color: [[0, window.darkMode?"#00AAFF":"blue"], [1, "red"]],
    				xAlias: "dateTime",
    				yAlias:"temp",
    				points: data.readings
    			}
    		]
        }
    })
    graph.className = "graph"
    return graph
}


function getPrecipGraph(data) {
    //Generate some additional info summing up total rainfall.
    let startTime = data.readings[data.readings.length - 1].dateTime;
    let halfDay;
    let fullDay;
    let sum;
    for (let i = data.readings.length - 1; i>=0;i--) {
        let currentTime = data.readings[i].dateTime
        if (!sum) {
            sum = data.readings[i].precip
        }
        else {
            sum += data.readings[i].precip
        }
        if (halfDay === undefined && startTime - currentTime >= 1000*60*60*12) {halfDay = sum}
        if (fullDay === undefined && startTime - currentTime >= 1000*60*60*24) {fullDay = sum}
        sum = Math.round(sum*10000)/10000 //Handle floating point precision loss.

    }
    let summaryText;
    if (fullDay !== undefined) {
        summaryText = "Last 24 hours: " + fullDay + "\"" + " " + "Last 12 hours: " + halfDay + "\""
    }
    else if (halfDay !== undefined) {
        summaryText = "Last 12 hours: " + halfDay + "\""
    }
    else if (!isNaN(sum)) {
        summaryText = "Last " + Math.round((data.readings[data.readings.length - 1].dateTime - data.readings[0].dateTime)/1000/60/60) + " hours: " + sum + "\""
    }
    else {return}

    let graph = createGraph({
        name: data.name,
        backgroundColor: window.darkMode?"black":"white",
        graphNameColor: window.darkMode?"white":"black",
        legendLineColor: window.darkMode?"white":"black",
        width: 1200,
        height: 800,
        x1: {
            textColor: window.darkMode?"white":"black",
        },
        y1: {
            name: "Precipitation (Inches)",
            textColor: "#0099FF",
            legendTextColor: "#0099FF",
            lines: [
    			{
                    color: "#0099FF",
    				xAlias: "dateTime",
    				yAlias:"precip",
    				points: data.readings
    			}
    		]
        },
        additionalText: {
            text: summaryText,
            color: "#0099FF"
        }
    })
    graph.className = "graph"
    return graph
}


function getButton(text, className) {
	let button = document.createElement("button")
	button.innerHTML = text
	button.className = className

	return button
}

function addGraphs(data) {

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
            let flowGraph = getFlowGraph(data)
			if (flowGraph) {
				graphs.push({
					text: "Flow Info",
					className: "flowButton",
					elem: flowGraph
				})
			}
        }
        else {
			try {
				//Use one graph for cfs and one for feet if the user is in color blind mode.
				let cfsGraph = getFlowGraph(data, "feet") //Pass "feet" as doNotInclude
				if (cfsGraph) {
					graphs.push({
						text: "Flow In CFS",
						className: "flowButton",
						elem: cfsGraph
					})
				}
			}
			catch (e) {
				console.error(e)
			}
			try {
				let feetGraph = getFlowGraph(data, "cfs") //Pass "cfs" as doNotInclude
				if (feetGraph) {
					graphs.push({
						text: "Flow In Feet",
						className: "flowButton",
						elem: feetGraph
					})
				}
			}
			catch (e) {
				console.error(e)
			}
        }
    }
    catch(e){console.error("Error creating flow graph: " + e)}

    try {
        let tempGraph = getTempGraph(data)
		if (tempGraph) {
			graphs.push({
				text: "Temperature",
				className: "tempButton",
				elem: tempGraph
			})
		}
    }
    catch(e){console.error("Error creating temperature graph: " + e)}

    try {
        let precipGraph = getPrecipGraph(data)
		if (precipGraph) {
			graphs.push({
				text: "Precipitation",
				className: "precipButton",
				elem: precipGraph
			})
		}
    }
    catch(e){console.error("Error creating precipitation graph: " + e)}

	try {
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
				oldGraph.replaceWith(data.elem)
			})
			buttonContainer.appendChild(button)
		})

		return container
	}
	catch(e) {
		console.error(e)
	}
}


module.exports = {
    addGraphs
}
