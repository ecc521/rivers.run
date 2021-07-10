const {createGraph} = require("./graph.js")

function getFlowGraph(data) {
    if (data.units === "m") {
        //User wants Meters, not Feet.
        data.readings = data.readings.map((reading) => {
                if (reading.cfs) {
                    reading.cms = reading.cfs / cubicMeterInFeet
                    reading.cms = Math.round(reading.cms * 100) / 100 //Reduce precision to sane levels.
                }
                if (reading.feet) {
                    reading.meters = reading.feet / meterInFeet
                    reading.meters = Math.round(reading.meters * 100) / 100 //Reduce precision to sane levels.
                }
                return reading
        })
    }

    let volumeColor = "#00CCFF" //Turquoise
    let stageColor = window.darkMode?"#7175ff":"blue"

    if (window.colorBlindMode) {
        stageColor = "#ff8800" //Orange
        volumeColor = window.darkMode?"#00CCFF":"#7175ff"
    }



    let volumeConfig = {
        name: (data.units === "m")?"Flow (Cubic Meters/Second)":"Flow (Cubic Feet/Second)",
        textColor: volumeColor,
        legendTextColor: volumeColor,
        lines: [
            {
                color: volumeColor,
                xAlias: "dateTime",
                yAlias: (data.units === "m")?"cms":"cfs",
                scrubUnits: (data.units === "m")?"cms":"cfs",
                points: data.readings,
            }
        ]
    }

    let stageConfig = {
        name: (data.units === "m")?"Gauge Height (Meters)":"Gauge Height (Feet)",
        //In dark mode, blue doesn't show up well enough, so different colors are used.
        textColor: stageColor,
        legendTextColor: stageColor,
        lines: [
            {
                color: stageColor,
                xAlias: "dateTime",
                yAlias:(data.units === "m")?"meters":"feet",
                scrubUnits:(data.units === "m")?"meters":"feet",
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
        y1: volumeConfig,
        y2: stageConfig
    })
    graph.canvas.className = "graph"
    graph.container.className = "graphContainer"
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
    				points: data.readings,
                    scrubUnits:   "°F",
    			}
    		]
        }
    })
    graph.canvas.className = "graph"
    graph.container.className = "graphContainer"
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
        sum = Math.round(sum*10000)/10000 //Handle floating point precision loss.
        if (halfDay === undefined && startTime - currentTime >= 1000*60*60*12) {halfDay = sum}
        if (fullDay === undefined && startTime - currentTime >= 1000*60*60*24) {fullDay = sum}

    }
    let summaryText;
    if (fullDay !== undefined) {
        summaryText = "Last 24 hours: " + fullDay + "\"" + " " + "Last 12 hours: " + halfDay + "\""
    }
    else if (halfDay !== undefined) {
        summaryText = "Last 12 hours: " + halfDay + "\""
        summaryText += " Last " + Math.round((data.readings[data.readings.length - 1].dateTime - data.readings[0].dateTime)/1000/60/60) + " hours: " + sum + "\""
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
                    scrubUnits: "inches",
    				points: data.readings
    			}
    		]
        },
        additionalText: {
            text: summaryText,
            color: "#0099FF"
        }
    })
    graph.canvas.className = "graph"
    graph.container.className = "graphContainer"
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
        let flowGraph = getFlowGraph(data)
        if (flowGraph) {
            graphs.push({
                text: "Flow Info",
                className: "flowButton",
                elem: flowGraph
            })
        }
    }
    catch(e){console.warn("Error creating flow graph: " + e)}

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
    catch(e){console.warn("Error creating temperature graph: " + e)}

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
    catch(e){console.warn("Error creating precipitation graph: " + e)}

	try {
        if (graphs.length === 0) {
            console.warn("No graphs")
            return container
        }

		let buttonContainer = document.createElement("div")
		if (graphs.length > 1) {
			//We don't need to show selection buttons if we only have one graph.
			container.appendChild(buttonContainer)
		}
		//Add the starting graph - usually the flow graph, unless it doesn't exist.
		container.appendChild(graphs[0].elem.container)

		graphs.forEach((data) => {
			let button = getButton(data.text, data.className)
			button.addEventListener("click", function() {
				let oldGraph = container.querySelector(".graphContainer")
				oldGraph.replaceWith(data.elem.container)
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
