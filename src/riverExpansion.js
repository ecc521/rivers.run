const {skillTranslations} = require("./skillTranslations.js")
const addGraphs = require("./addGraphs.js").addGraphs
const {calculateAge} = require("./flowInfoCalculations.js")
const {createFavoritesWidget} = require("./notificationsWidget.js")
const {addMap} = require("./Mapper.js")

//Code that runs when the button is clicked
function riverbuttonClicked(button, river) {
    if (river.expanded === 0) {
        river.expanded = 1
        createExpansion(button, river)
    }
    else {
        //Delete the expansion.
        river.expanded = 0
        var elem = document.getElementById(river.base + 2)
        if (elem) {
            elem.parentNode.removeChild(elem)
        }

    }
}


function createExpansion(button, river) {
    var div = document.createElement("div")
    div.className = "riverWriteup"

    div.appendChild(createFavoritesWidget(river, river.gauge))

    let textInfo = document.createElement("div")
    textInfo.innerHTML = river.writeup + "<br><br>"

    if (river.class && river.skill) {
        textInfo.innerHTML += "This river is class " + river.class + " and is rated " + skillTranslations[river.skill] + ".<br>"
    }
    else if (river.class) {
        textInfo.innerHTML += "This river is rated class " + river.class + ".<br>"
    }
    else if (river.skill) {
        textInfo.innerHTML += "This river is rated " + skillTranslations[river.skill] + ".<br>"
    }

    if (river.averagegradient) {textInfo.innerHTML += "Average gradient: " + river.averagegradient + " feet per mile.<br>"}
    if (river.maxgradient) {textInfo.innerHTML += "Maximum gradient: " + river.maxgradient + " feet per mile.<br>"}

    if (river.plat && river.plon) {
        textInfo.innerHTML += "Put-In GPS Coordinates: " + river.plat + ", " + river.plon + "<br>"
    }

    if (river.tlat && river.tlon) {
        textInfo.innerHTML += "Take-Out GPS Coordinates: " + river.tlat + ", " + river.tlon + "<br>"
    }

    div.appendChild(textInfo)

    if (river.map) {
        div.appendChild(river.map)
        river.map.updateMarkers() //Update markers for new flow info.
    }
    else if (!river.blockMaps && ((river.plat && river.plon) || (river.tlat && river.tlon))) {
        //Offer a map.
        let mapButton = document.createElement("button")
        mapButton.innerHTML = "Click to Load Map"
        mapButton.classList.add("mapButton")
        mapButton.addEventListener("click", async function() {
            mapButton.innerHTML = "Loading..."
            let map = await addMap({river})
            if (map) {
                river.map = map
                mapButton.replaceWith(river.map)
            }
            else {
                mapButton.innerHTML = "Click to Load Map"
            }
        })
        div.appendChild(mapButton)
    }

    function round(level) {
        if (river.relativeFlowType === "cfs") {
            return Math.round(level)
        }
        else {
            return Math.round(level*100)/100
        }
    }

    //Show the user the values being used for determining relative flow.
    let values = ["minrun", "lowflow", "midflow", "highflow", "maxrun"]
    let flowRange = document.createElement("p")
    flowRange.innerHTML = ""
    for (let i=0;i<values.length;i++) {
        let name = values[i]
        if (river[name] && !isNaN(parseFloat(river[name]))) {
            flowRange.innerHTML += name + ":" + round(river[name]) + river.relativeFlowType + " "
        }
    }
    if (flowRange.innerHTML !== "") {div.appendChild(flowRange)}

    div.appendChild(document.createElement("br"))
    let link = document.createElement("a")
    link.target = "_blank"
    link.rel = "noopener"
    if (!river.isGauge) {
        //Link to edit river data
        link.href = "https://docs.google.com/document/d/" + river.id
        link.innerHTML = "Edit this river"
    }
    else {
        //Link to create a river using this gauge.
        link.innerHTML = "Create River using Gauge"
        //link.href = "resources/writeupmaker.html" + "#" + "name=" + river.name + "&section=" + river.section + "&gauge=" + river.gauge

        //Too many people didn't edit the river or section name when those were prefilled.
        link.href = window.root + "resources/writeupmaker.html" + "#" + "gauge=" + river.gauge
    }
    div.appendChild(link)

    if (river.aw) {
        div.appendChild(document.createElement("br"))
        let link = document.createElement("a")
        link.target = "_blank"
        link.rel = "noopener"
        link.href = "https://www.americanwhitewater.org/content/River/detail/id/" + river.aw
        link.innerHTML = "View this river on American Whitewater"
        div.appendChild(link)
    }

    div.appendChild(document.createElement("br"))
    let disclaimer = document.createElement("a")
    disclaimer.href = "legal/DISCLAIMER.html"
    disclaimer.target = "_blank"
    disclaimer.innerHTML = "Rivers.run Content and Flow Disclaimer"
    div.appendChild(disclaimer)

    let addedUSGSDisclaimer = false
    let addedVirtualGaugeDisclaimer = false

    function addUSGSGraphs(usgsID, relatedGauge) {

        let data = self.usgsarray[usgsID]
        let graphContainer = document.createElement("div");

        if (data) {
            //Alert the user if the data is (at least 2 hours) old
            let dataAge
            try {
                dataAge = calculateAge(usgsID)
            }
            catch(e) {
                console.error(e)
                dataAge = null
            }
            console.log(dataAge)
            let maxAge = 1000*60*60*2
            let oldDataWarning;
            if (dataAge > maxAge) {
                oldDataWarning = document.createElement("p")
                oldDataWarning.innerHTML = "Check the dates! This river data is more than " + Math.floor(dataAge/1000/60/60) + " hours old!"

                oldDataWarning.className = "oldDataWarning"
                graphContainer.appendChild(oldDataWarning)
            }

            if (relatedGauge) {
                //Space out the gauges.
                graphContainer.appendChild(document.createElement("br"))
                graphContainer.appendChild(document.createElement("br"))
                graphContainer.appendChild(document.createElement("br"))
            }

            graphContainer.appendChild(createFavoritesWidget(river, usgsID))

            if (data.source) {
                let sourceInfo = document.createElement("p")
                sourceInfo.style.textAlign = "center"
                if (data.source.link) {
                    sourceInfo.innerHTML = `<a href="${data.source.link}" target="_blank">${data.source.text}</a>`
                }
                else {sourceInfo.innerHTML = data.source.text}
                graphContainer.appendChild(sourceInfo)
            }

            console.time("Add Graphs")
            console.log(usgsarray[usgsID])
            console.log(graphs)
            let graphs = addGraphs(data)
            if (graphs) {
                //Graphs can be undefined if there was not enough data to create any.
                graphContainer.appendChild(graphs)
            }
            else {
                let elem = document.createElement("p")
                elem.innerHTML = "There was an error creating the graph. The gauge has probably temporarily broken. "
                graphContainer.appendChild(elem)
            }
            console.timeEnd("Add Graphs")
            div.appendChild(graphContainer)
        }
        else {
            console.log("No flow data for " + usgsID + ". Trying to load from network (may not exist though). ");
        }

        //Fetch comprehensive flow data, then update the graphs.
        //TODO: Add XMLHttpRequest fallback.
        if (!usgsarray[usgsID] || !usgsarray[usgsID].full) {
            fetch(window.root + "gaugeReadings/" + usgsID).catch((error) => {
                console.log("Failed to load " + usgsID + " from network. Error below. ")
                console.log(error)
            }).then((response) => {
                if (response.status > 399) {
                    console.log("Loading " + usgsID + " from network returned status code " + response.status + ". Response below. ")
                    console.log(response)
                    return;
                }
                response.json().then((newData) => {
                    usgsarray[usgsID] = newData
                    usgsarray[usgsID].full = true
                    river.updateFlowData()
                })
            })
        }
        else {
            river.updateFlowData(true) //Update only flow styling and flow data column.
            //We do this because, otherwise, if two rivers have the gauge, the second and successive ones opened will not have their flow styling or column updated. .
        }
    }

    //USGS data may not have loaded yet
    if (self.usgsarray) {
        river.gauge && addUSGSGraphs(river.gauge)
        if (river.relatedgauges) {
            for (let i=0;i<river.relatedgauges.length;i++) {
                if (river.relatedgauges[i] === "") {continue;}
                addUSGSGraphs(river.relatedgauges[i], true)
            }
        }
    }

    div.style.padding = "6px"
    div.id = river.base + 2
    button.parentNode.insertBefore(div, button.nextSibling)
}



module.exports = {
    riverbuttonClicked
}
