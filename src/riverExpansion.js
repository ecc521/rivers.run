const {skillTranslations} = require("./skillTranslations.js")
const addGraphs = require("./addGraphs.js").addGraphs
const {createFavoritesWidget} = require("./favoritesWidget.js")
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

    function createGoogleMapsLink(lat, lon) {
        return `<a href="https://www.google.com/maps/dir//${lat},${lon}/@${lat},${lon},14z" target="_blank">${lat}, ${lon}</a>`
    }

    river.access.forEach((accessPoint) => {
        textInfo.innerHTML += `${accessPoint.name} GPS Coordinates: ${createGoogleMapsLink(accessPoint.lat, accessPoint.lon)}<br>`
    })

    div.appendChild(textInfo)

    if (river.map) {
        div.appendChild(river.map)
        river.map.updateMarkers() //Update markers for new flow info.
    }
    else if (!river.blockMaps && river.access.length > 0) {
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
        if (river.relativeflowtype === "cfs") {
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
            flowRange.innerHTML += name + ":" + round(river[name]) + river.relativeflowtype + " "
        }
    }
    if (flowRange.innerHTML !== "") {div.appendChild(flowRange)}


    let containerForEditLinks = document.createElement("p")
    containerForEditLinks.style.margin = "2px 0"
    div.appendChild(containerForEditLinks)

    let riverCreatorLink = document.createElement("a")
    riverCreatorLink.target = "_blank"
    riverCreatorLink.href = window.root + "resources/writeupmaker.html" + "#" + "id=" + river.id
    riverCreatorLink.innerHTML = "Create River using Gauge"
    containerForEditLinks.appendChild(riverCreatorLink)

    if (!river.isGauge) {
        riverCreatorLink.innerHTML = "Open in River Creator"

        containerForEditLinks.innerHTML += " - "

        let editRiverLink = document.createElement("a")
        editRiverLink.target = "_blank"

        //Link to edit river data
        editRiverLink.href = "https://docs.google.com/document/d/" + river.id
        editRiverLink.innerHTML = "Edit this River"
        containerForEditLinks.appendChild(editRiverLink)
    }

    if (river.aw) {
        let link = document.createElement("a")
        link.target = "_blank"
        link.href = "https://www.americanwhitewater.org/content/River/detail/id/" + river.aw
        link.innerHTML = "View on American Whitewater"
        div.appendChild(link)
    }

    let disclaimer = document.createElement("p")
    disclaimer.innerHTML = `<a href="legal/DISCLAIMER.html" target="_blank">Rivers.run Content and Flow Disclaimer</a>`
    disclaimer.style.margin = "2px 0";
    div.appendChild(disclaimer)

    let addedUSGSDisclaimer = false
    let addedVirtualGaugeDisclaimer = false

    function addUSGSGraphs(usgsID, relatedGauge = false, graphContainer = document.createElement("div"), recurse = true) {
        while (graphContainer.lastChild) {graphContainer.lastChild.remove()}

        let data = self.gauges[usgsID]

        if (data) {
            //Alert the user if the data is (at least 2 hours) old
            let dataAge
            try {
                dataAge = data.msSinceLatestReading()
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

            if (data.getSource()) {
                let sourceInfo = document.createElement("p")
                sourceInfo.style.textAlign = "center"
                if (data.getSource().link) {
                    sourceInfo.innerHTML = `<a href="${data.getSource().link}" target="_blank">${data.getSource().text}</a>`
                }
                else {sourceInfo.innerHTML = data.getSource().text}
                graphContainer.appendChild(sourceInfo)
            }

            console.time("Add Graphs")
            console.log(usgsID, gauges[usgsID])
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
        if (usgsID && ((recurse && !gauges[usgsID]) || !gauges[usgsID].full)) {
            let newGauge = new Gauge(usgsID)
            newGauge.updateReadingsFromNetwork().then(() => {
                gauges[usgsID] = newGauge
                river.updateFlowData(true) //Update flow styling and data.
                addUSGSGraphs(usgsID, relatedGauge, graphContainer, false) //Update the graph pertaining to this data.
            })
        }
        else {
            river.updateFlowData(true) //Update only flow styling and flow data column.
            //This river may share this gauge with another river - if that other river loaded full data, it might be newer than
            //the preview we are showing - we should try to update.
        }
    }

        addUSGSGraphs(river.gauge)
        if (river.relatedgauges) {
            for (let i=0;i<river.relatedgauges.length;i++) {
                if (river.relatedgauges[i] === "") {continue;}
                addUSGSGraphs(river.relatedgauges[i], true)
            }
        }

    div.style.padding = "6px"
    div.id = river.base + 2
    button.parentNode.insertBefore(div, button.nextSibling)
}



module.exports = {
    riverbuttonClicked
}
