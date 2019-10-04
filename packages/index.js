/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, { enumerable: true, get: getter });
/******/ 		}
/******/ 	};
/******/
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = function(exports) {
/******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		}
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/
/******/ 	// create a fake namespace object
/******/ 	// mode & 1: value is a module id, require it
/******/ 	// mode & 2: merge all properties of value into the ns
/******/ 	// mode & 4: return value when already ns object
/******/ 	// mode & 8|1: behave like require
/******/ 	__webpack_require__.t = function(value, mode) {
/******/ 		if(mode & 1) value = __webpack_require__(value);
/******/ 		if(mode & 8) return value;
/******/ 		if((mode & 4) && typeof value === 'object' && value && value.__esModule) return value;
/******/ 		var ns = Object.create(null);
/******/ 		__webpack_require__.r(ns);
/******/ 		Object.defineProperty(ns, 'default', { enumerable: true, value: value });
/******/ 		if(mode & 2 && typeof value != 'string') for(var key in value) __webpack_require__.d(ns, key, function(key) { return value[key]; }.bind(null, key));
/******/ 		return ns;
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 6);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, exports, __webpack_require__) {

self.usgsarray = {}
window.updateOldDataWarning = function() {

		let toDelete = document.getElementById("topOldDataWarning")
		if (toDelete) {toDelete.remove()}

		if (!window.usgsDataAge) {return}
		//No reason to make an old data warning when data is new (within 1 hour)
		//Make sure to change the warning text so that if the data becomes old while the page is open, they are not confused.
		if (window.usgsDataAge < 1000*60*60) {
			window.loadNewUSGS = "Flow Data has become old while this page was open. Click try again to update."
			return
		}

		let oldDataWarning = document.createElement("p")
		oldDataWarning.id = "topOldDataWarning"

		oldDataWarning.innerHTML = "All flow data is more than " + Math.floor(window.usgsDataAge/1000/60/60) + " hours old! "
		oldDataWarning.innerHTML += "(" + window.loadNewUSGS + ") "

					let reloadButton = document.createElement("button")

						reloadButton.addEventListener("click", function() {
							window.loadNewUSGS = "Trying to Load Data"
							__webpack_require__(0).loadUSGS()
						})
						reloadButton.innerHTML = "Try Again"


					oldDataWarning.appendChild(reloadButton)


		let legend = document.getElementById("legend")
		legend.parentNode.insertBefore(oldDataWarning, legend)
}


function updateUSGSDataInfo() {
	window.usgsDataAge = Date.now() - window.requestTime
	window.updateOldDataWarning()
}
setInterval(updateUSGSDataInfo, 1000*60*1) //Every minute, make sure that the data has not become old. If it has, display a warning.

//When the data updates, rerun the current search.
window.addEventListener("usgsDataUpdated", function() {
	let query = getAdvancedSearchParameters()
	if (
		(//Make sure flow searching or sorting is being performed, so that re-running the search may make a difference.
			!objectsEqual(query.flow, defaultAdvancedSearchParameters.flow) //Flow search
			|| (query.sort.query === "running") //Flow sort
		)
		&& timesLoadUSGSRan >= 1 //And this is actually an update to the data, not the first load
		&& ItemHolder.length !== 0 //And that there are actually rivers to update - the flow data could have loaded first.
		&& (//Make sure we don't close writeups that the user is looking at without their permission.
			ItemHolder.every(river => !river.expanded) //If no writeups are open, we can continue
			|| confirm("USGS data has been updated. Would you like to re-run the previous search?") //Otherwise, ask the user if they would like the update.
		)
	) {NewList()}
})


let timesLoadUSGSRan = 0
let loadUSGS = async function(useCache) {
	//Gaurd against infinite recursion. Ignores calls when data is new. (within 5 minutes)
	if (window.usgsDataAge < 1000*60*5) {
		return;
	}

	timesLoadUSGSRan++

	let fileName = "flowdata2.json"

	if (useCache) {
		let cache = await caches.open("rivers.run")
		let response = await caches.match(fileName)
		window.usgsarray = await response.json()
	}
	else if (window.fetch) {
		let response = await fetch(fileName)
		window.usgsarray = await response.json()
	}
	else {
		//For browsers that don't support fetch
		let request = new XMLHttpRequest()
		let response = await new Promise((resolve, reject) => {
			request.onload = function(event) {resolve(event.target.response)};
			request.open("GET", fileName);
			request.send()
		})
		window.usgsarray = JSON.parse(response)
	}

	
	console.time("updatingRivers")
	//Add USGS Data to Graph
	for (let i=0;i<ItemHolder.length;i++) {
		try {
			let river = ItemHolder[i]

			river.updateFlowData()
		}
		catch(e) {
			console.error(e)
		}
	}
	console.timeEnd("updatingRivers")

	window.requestTime = usgsarray.generatedAt
	updateUSGSDataInfo()
	window.updateOldDataWarning()
	
	window.dispatchEvent(new Event("usgsDataUpdated"))
}


module.exports = {
	loadUSGS
}

window.loadUSGS = loadUSGS


/***/ }),
/* 1 */
/***/ (function(module, exports) {

//These functions are used by River.js to calculate things based on a rivers flow.

function calculateDirection(usgsNumber) {
    let usgsData = usgsarray[usgsNumber]
    if (usgsData) {

        let data = usgsData.cfs || usgsData.feet

        if (data) {
            let current;
            let previous;

            //TODO: Ignore insignificant changes.

            //We will go back 4 datapoints (1 hour) if possible.
            //Do this because USGS sometimes does 1 hour intervals instead of 15 minutes
            let stop = Math.max(data.length-5, 0)
            for (let i=data.length;i>=stop;i--) {
                let item = data[i]
                if (!item) {continue}
                let value = item.value
                if (!current) {
                    current = value
                }
                else {
                    previous = value
                }
            }

            if (current > previous) {
                //Water level rising
                return "⬆"
            }
            else if (previous > current) {
                //Water level falling
                return "⬇"
            }
            else if (current === previous) {
                //Water level stable
                return " –" //En dash preceeded by a thin space.
            }
        }
    }
    return; //If we got here, there is not enough USGS data.
}



function calculateDirection(usgsNumber, prop="cfs") {
	//We will try first using cfs. If there is no conclusion, try feet. 
    let usgsData = usgsarray[usgsNumber]
    if (usgsData) {

        let data = usgsData[prop]

        if (data) {
            let current;
            let previous;

            //TODO: Ignore insignificant changes.

            //We will go back 2 datapoints (usually 30 minutes) if possible.
            let stop = Math.max(data.length-2, 0)
            for (let i=data.length;i>=stop;i--) {
                let item = data[i]
                if (!item) {continue}
                let value = item.value
                if (!current) {
                    current = value
                }
                else {
                    previous = value
                }
            }

            if (current > previous) {
                //Water level rising
                return "⬆"
            }
            else if (previous > current) {
                //Water level falling
                return "⬇"
            }
            else if (current === previous) {
                //Water level stable
                return " –" //En dash preceeded by a thin space.
            }
        }
    }
	
	if (prop === "cfs") {return calculateDirection(usgsNumber, "feet")}
    return; //If we got here, there is not enough USGS data.
}





function calculateAge(usgsNumber) {
	//Returns millseconds old that USGS data is
    let usgsData = window.usgsarray[usgsNumber]
    if (usgsData) {
        let data = usgsData.cfs || usgsData.feet || usgsData.temp || usgsData.precip;

        if (data) {
            for (let i=data.length;i>=0;i--) {
                let item = data[i]
                if (!item) {continue}
                return Date.now() - Number(new Date(item.dateTime))
            }
        }
    }
    return null; //If we got here, there is not enough USGS data.
}


function calculateRelativeFlow(river) {
    //Defines river.running
    //0-4
    //0 is too low, 4 is too high, other values in between


    let values = ["minrun", "lowflow", "midflow", "highflow", "maxrun"]

    let type; //Currently, we skip a value if one datapoint is cfs and another feet

    for (let i=0;i<values.length;i++) {

        let str = river[values[i]]
        if (!str) {
            values[i] = undefined
            continue;
        }
        str = str.split("(computer)").join("")
        str = str.trim()
        let value = parseFloat(str)
        let currentType = str.match(/[^\d|.]+/) //Match a series of non-digits

        if (currentType) {
            currentType = currentType[0].trim().toLowerCase() //Use the first match
        }
        if (!type && currentType) {
            type = currentType
        }
        else if (type !== currentType && !isNaN(value)) {
            console.warn(values[i] + " on " + river.name + " " + river.section + " has a different extension and has been skipped")
            values[i] = undefined
            continue;
        }

        values[i] = value
    }

	if (values.filter((value) => {return value !== undefined}).length === 0) {
		return null //If no relative flow values exist, return. This should help improve performance with gauges (lots of gauges, none have relative flows)
	}

	
    let flow;
    if (type === "cfs") {
        flow = river.cfs
    }
    else if (type === "feet" || type==="ft") {
        flow = river.feet
    }


    //Use or equal to
    //While that technically may not be correct (says that river is too low at minrun), it makes no significant difference
    //In addition, values equal to minrun or maxrun result in a river.running of 0 or 4
    //Meaning that they may be included in the middle of a darker highlighted rivers
    //When sorting by runnability is used.

    //It would be better if rivers that are too high or too low are still given river.running values
    //related to their level. This would also help in determining if something is just barely
    //too low, and may come up with rain, or is truely too low.

    //If we don't have some values, fill them in using logarithms
    //Although these calculations are not needed when flow is below minrun or above maxrun. they can be useful in
    //alerting people what values are being used, so that they can

    function logDist(low, high, ratio = 0.5) {
        //ratio is how a decimal between 0 and 1. 0.5 means to factor lowLog and highLog evenly. Values greater than 0.5 factor in highLog more, vice versa.
        let lowLog = Math.log10(low)
        let highLog = Math.log10(high)
        if (lowLog > highLog) {
            console.error("Low greater than high on " + river.name + " " + river.section)
            return;
        }
        return 10**(lowLog + (highLog - lowLog)*ratio)
    }

    let minrun = values[0]
    let maxrun = values[4]
    //For midflow, use the nearest values to calculate midflow.
    let midflow = values[2] //Prefer the specified midflow.
    midflow = midflow || logDist(values[1], values[3]) //Average lowflow and highflow
    midflow = midflow || logDist(values[0], values[3], 2/3) // two-thirds of the way between minrun and highflow
    midflow = midflow || logDist(values[1], values[4], 1/3) // one-third of the way between lowflow and maxrun
    midflow = midflow || logDist(minrun, maxrun) //Average minrun and maxrun.
    let lowflow = values[1] || logDist(minrun, midflow)
    let highflow = values[3] || logDist(midflow, maxrun)

    //Add computer generated properties to the river object so that they will display and people can see the values used in calculations.
    values[1] || (river.lowflow = parseFloat(lowflow.toFixed(2)) + type + " (computer)")
    values[2] || (river.midflow = parseFloat(midflow.toFixed(2)) + type + " (computer)")
    values[3] || (river.highflow = parseFloat(highflow.toFixed(2)) + type + " (computer)")


    if (flow <= minrun) {
        //Too low
        river.running = 0
    }
    else if (flow >= maxrun) {
        //Too high
        river.running = 4
    }
    else {

        function calculateRatio(low, high, current) {
            low = Math.log(low)
            high = Math.log(high)

            current = Math.log(current)


            let range = high-low
            let value = current-low

            return value/range

        }

        if (flow < lowflow && minrun) {
            river.running = calculateRatio(minrun, lowflow, flow)
        }
        else if (flow < midflow && lowflow) {
            river.running = 1+calculateRatio(lowflow, midflow, flow)
        }
        else if (flow < highflow && midflow) {
            river.running = 2+calculateRatio(midflow, highflow, flow)
        }
        //Use else if and comparison against maxrun to go to the else in case of isNaN(maxrun)
        else if (flow < maxrun && highflow) {
            river.running = 3+calculateRatio(highflow, maxrun, flow)
        }
        else {
            return null //We can't calculate a ratio, as we lack information. Example: only have minrun and flow above minrun.
        }
    }
    return river.running
}


function calculateColor(river, options) {
    //hsla color values
    //hsla(hue, saturation, lightness, opacity)
    //Saturation hue is 0 red 120 green 240 blue
    //Saturation - use 100%
    //Lightness - use 50%
    //Opacity - Decimal 0 to 1

    let relativeFlow = calculateRelativeFlow(river)

    if (relativeFlow == null || isNaN(relativeFlow)) {
        return ""
    }
    else if (relativeFlow === 0) {
        //Too low
	    let lightness = (options && options.highlighted)? (window.darkMode? "28%": "63%"):  window.darkMode? "23%": "67%"
        return "hsl(0,100%," + lightness + ")"
    }
    else if (relativeFlow === 4) {
        //Too high
    	let lightness = (options && options.highlighted)? (window.darkMode? "30%": "67%"):  window.darkMode? "20%": "69%"
        return "hsl(240,100%," + lightness + ")"
    }
    else {
		//Normal Flow lightness values
		//Tough to see a difference when highlighted amount the more middle values in light mode.
    	let lightness = (options && options.highlighted)? (window.darkMode? "30%": "65%"): window.darkMode? "25%": "70%"
        return "hsl(" + (0 + 60*relativeFlow) + ",100%," + lightness + ")"
    }
}

module.exports = {
	calculateColor,
	calculateAge,
	calculateDirection,
    calculateRelativeFlow
}


/***/ }),
/* 2 */
/***/ (function(module, exports) {

let skillTranslations = {
	"?": "Skill Unknown",
	"FW": "Flat Water",
	"B": "Beginner",
	"N": "Novice",
	"N+": "Novice Plus",
	"LI-": "Low-Intermediate Minus",
	"LI": "Low-Intermediate",
	"LI+": "Low-Intermediate Plus",
	"I-": "Intermediate Minus",
	"I": "Intermediate",
	"I+": "Intermediate Plus",
	"HI-": "High-Intermediate Minus",
	"HI": "High-Intermediate",
	"HI+": "High-Intermediate Plus",
	"A-": "Advanced Minus",
	"A": "Advanced",
	"A+": "Advanced Plus",
	"E-": "Expert Minus",
	"E": "Expert",
	"E+": "Expert Plus"
}

module.exports = {
	skillTranslations
}

/***/ }),
/* 3 */
/***/ (function(module, exports) {

function simpleSort(list, propertyName) {
    list.sort(function(a,b) {
        if (a[propertyName] > b[propertyName]) {
            return 1;
        }
        if (a[propertyName] < b[propertyName]) {
            return -1;
        }
        return 0;
    })
    return list
}


function alphabeticalsort(list, reverse) {
    list = simpleSort(list, "name")

    if (reverse) {
        list.reverse()
    }

    return list
}

function ratingsort(list, reverse) {
	//In the sorting, the numbers all come before the letters
	//Convert numbers to strings so that we are comparng the same type, and do not always get false.
	//Convert back after.

	for (let i=0;i<list.length;i++) {
		if (typeof list[i].rating === "number") {
			list[i].rating = String(list[i].rating)
		}
	}

    list = simpleSort(list, "rating")

	for (let i=0;i<list.length;i++) {
		if (!isNaN(parseFloat(list[i].rating))) {
			list[i].rating = parseFloat(list[i].rating)
		}
	}

	//The list is backwards. Reverse it if reverse is NOT specified.
	if (!reverse) {
        list.reverse()
    }

    //Move error values to end
    while (list[0].rating === "Error") {
        list.push(list.shift())
    }
    return list
}


function skillsort(list, reverse) {
    list.sort(function(a,b) {

        function ToNum(value) {

            let skillList = ["FW","B","N","N+","LI-","LI","LI+","I-","I","I+","HI-","HI","HI+","A-","A","A+","E-","E","E+"]
            value = skillList.indexOf(value.skill)
            if (value === undefined) {value = Infinity}

            return value
        }
        return ToNum(a)-ToNum(b)
    })


    if (reverse) {
        list.reverse()
    }

    while (list[0].skill === "?") {
        list.push(list.shift())
    }

    return list
}


function runningSort(list, reverse) {

    let noData = []
	let hasDam = []
    let hasGauge = []
	let hasGaugeAndDam = []
    let knownState = []

    list.forEach((item) => {
        if (item.running !== undefined && !isNaN(item.running)) {knownState.push(item)}
        //If there is gauge data, the user may be able to determine level themselves
        //As such, put rivers with gauges second
        else if (item.flow && item.dam) {hasGaugeAndDam.push(item)}
        else if (item.flow) {hasGauge.push(item)}
		else if (item.dam) {hasDam.push(item)}
        else {noData.push(item)}
    })

    knownState = simpleSort(knownState, "running")

	//Default order should be highest flow first.
    if (!reverse) {
        knownState.reverse()
    }

    if (window.usgsDataAge === undefined) {
        alert("Sorting based on flow requires flow data, which has not fully loaded. The flow sort is not being performed.")
        return list
    }

    knownState = knownState.concat(hasGaugeAndDam)
    knownState = knownState.concat(hasGauge)
    knownState = knownState.concat(hasDam)
    knownState = knownState.concat(noData)

    return knownState
}





function sort(method, list, reverse) {
    if (method === "none") {}
    else if (method === "alphabetical") {
        list = alphabeticalsort(list, reverse)
    }
    else if (method === "rating") {
        list = ratingsort(list, reverse)
    }
    else if (method === "skill") {
        list = skillsort(list, reverse)
    }
    else if (method === "running") {
        list = runningSort(list, reverse)
    }
    else {
        throw "Unknown sorting method " + method
    }
    return list
}


module.exports = {
    ratingsort,
    alphabeticalsort,
    skillsort,
    sort
}


/***/ }),
/* 4 */,
/* 5 */,
/* 6 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";



try {
	window.loadNewUSGS = "Trying to Load Data"
	if ('serviceWorker' in navigator) {
		window.serviceWorkerMessages = []
		navigator.serviceWorker.ready.then(function(registration) {
			navigator.serviceWorker.onmessage = function(event) {
				window.serviceWorkerMessages.push(event.data)
				let data = event.data

				if (!data.includes("flowdata2.json")) {return;}

				window.oldLoadUSGS = window.loadNewUSGS

				if (data.includes("Updated cache for")) {
					console.log("Updating")
					__webpack_require__(0).loadUSGS(true) //Update the information. true says to use cache.
				}
				else if (data.includes("errored. Using cache")) {
					window.loadNewUSGS = "Unable to load latest data"
				}
				else if (data.includes(" took too long to load from network")) {
					window.loadNewUSGS = "Updating data in backgroud"
				}
				else if (data.includes("has been loaded from the network")) {
					window.loadNewUSGS = "This is likely a glitch. You should be viewing the latest data."
				}
				window.updateOldDataWarning()
			}
		})
	}
}
catch(e) {console.error(e)}

try {
	window.addLine = __webpack_require__(7).addLine
}
catch(e) {console.error(e)}

//Defines window.TopBar and window.triangle
Object.assign(window, __webpack_require__(8))

window.River = __webpack_require__(9).River

window.sort = __webpack_require__(3).sort

//Defines window.normalSearch, window.advanedSearch, and window.toDecimalDegrees
Object.assign(window, __webpack_require__(13))

window.usgsarray = {}

//Defines recursiveAssign, deleteMatchingPortions, and objectsEqual
Object.assign(window, __webpack_require__(15))
__webpack_require__(16) //Defines window.setMenuFromSearch and window.getAdvancedSearchParameters

__webpack_require__(17) //Adds listeners to the searchbox and advanced search menu.

__webpack_require__(18) //Defines window.NewList

document.getElementById("Rivers").appendChild(new TopBar().create())
//createLegend.js needs a #Rivers > .riverbutton to get font-size using getComputedStyle
__webpack_require__(19)


//Handle search links.
	if (window.location.hash.length > 0) {
		let search = decodeURI(window.location.hash.slice(1))
		
	if (search.startsWith("{")) {
		//Advanced search
			let query = JSON.parse(search)
			setMenuFromSearch(query)
	}
		else {
			//Normal search
			let query = window.getAdvancedSearchParameters()
			query.normalSearch = search
			setMenuFromSearch(query)
		}
	}


;(async function() {

	//ItemHolder is a list of all the river objects. New objects should be pushed into the list.
	window.ItemHolder = []
	
	//Load flow information. This is async, and will finish whenever.
	__webpack_require__(0).loadUSGS(false)

	//Load river data so that the page can be rendered.
	let fileName = "riverdata.json"
	if (window.fetch) {
		let response = await fetch(fileName)
		window.riverarray = await response.json()
	}
	else {
		//For browsers that don't support fetch
		let request = new XMLHttpRequest()
		let response = await new Promise((resolve, reject) => {
			request.onload = function(event) {resolve(event.target.response)};
			request.open("GET", fileName);
			request.send()
		})
		window.riverarray = JSON.parse(response)
	}

	console.time("Create River Objects")
	riverarray.map(function(event, index) {
		ItemHolder[index] = new River(index, event)
	})
	console.timeEnd("Create River Objects")

	//If there is a custom search link, use it. Otherwise, just call NewList.

	let query = window.getAdvancedSearchParameters()
	if (
		window.usgsDataAge === undefined &&
		(!objectsEqual(defaultAdvancedSearchParameters.flow, query.flow) || query.sort.query === "running") 
	) {
			//We have no usgs data yet. Wait to flow search/sort.
				let oldQuery = recursiveAssign({}, query)
				delete query.flow
				if (query.sort && query.sort.query === "running") {
					delete query.sort
				}
				function dataNowLoaded() {
					//If the user has made any changes that caused the list to reload, ask.
					if (timesNewListCalled <= 2 || confirm("Flow data has now loaded. Would you like to apply your original search link?")) {
						setMenuFromSearch(oldQuery)
						NewList()
					}
					window.removeEventListener("usgsDataUpdated", dataNowLoaded)
				}
				if (!objectsEqual(query, oldQuery)) {
					window.addEventListener("usgsDataUpdated", dataNowLoaded)
					let searchNotFinished = document.createElement("p")
					searchNotFinished.id = "topOldDataWarning" //Reuse styling
					searchNotFinished.innerHTML = "Portions of your search link use flow data, which is still loading. "
					//loadUSGS.js will delete searchNotFinished when it is not needed due to the id overlap.
					let legend = document.getElementById("legend")
					legend.parentNode.insertBefore(searchNotFinished, legend)
			}
			NewList(query)
		}
	else {
		NewList()
	}
}())


/***/ }),
/* 7 */
/***/ (function(module, exports) {

//Graph Code
//It's Ugly... It should be fixed
//BUT IT WORKS

//addline(canvas, horizontal, vertical, color, graphtype, numplace)

//canvas - HTML canvas element
//horizontal - array of horizontal values. Pass 0 and it will evenly space.
//vertical - array of vertical values

//color - Optional. Color of line. Default black
//graphtype - Optional. Specify 2 to put 2 lines and 2 scales on one graph. See numplace below
//numplace - Use only if you are using graphtype = 2.
//If you specify 0 or do not pass a value, the line's scale will be on the left side of the graph.
//If you specify 1, the line's scale will be on the right side of the graph
function addLine(GraphName, timeframe, Source, canvas, horizontal, vertical, color, graphtype, numplace) {
    if (graphtype === 3) {
        var endcolor = numplace
        }
    if (graphtype !== 2) {
        numplace = 0
    }
    var height = canvas.height*0.80
    var width = canvas.width

    var ctx = canvas.getContext('2d');

    if (!isNaN(Number(horizontal))) {
        horizontal = []
        for (var i = 0;i<vertical.length;i++) {
            horizontal.push(i*width)
        }
    }
    if (horizontal.length !== vertical.length) {
        console.warn("Uneven amount of datapoints. " + horizontal.length + " horizontal points found, but " + vertical.length + " vertical points found.")
    }

    color = color || "#000000"

    ctx.lineWidth = Math.ceil(Math.min(width, height)/60)

    ctx.beginPath();

    if (graphtype === 2) {
        width = width*0.86 //We need to put values on both sides
		//Because there are two lines, make the second line thinner so that it can't entirely cover the first. (first is about double the size.)
		if (numplace === 1) {
        	ctx.lineWidth = Math.ceil(ctx.lineWidth/1.6) //Thinner
		}
		else {
        	ctx.lineWidth = Math.ceil(ctx.lineWidth*1.1) //Slightly Wider
		}
    }
    else {
        width = width*0.93
    }

	//Eliminate invalid values so that they can't cause issues in calculating min/max.
    var calcvertical = []
    for (var i = 0;i<vertical.length;i++) {
        if (!isNaN(Number(vertical[i])) && (vertical[i]) !== "") {
            calcvertical.push(vertical[i])
        }
    }
	
	let verticalMax = Math.max(...calcvertical)
	let verticalMin = Math.min(...calcvertical)
	let horizontalMax = Math.max(...horizontal)
	let horizontalMin = Math.min(...horizontal)
	
    var vscale = verticalMax - verticalMin
    var hscale = horizontalMax - horizontalMin
    vscale = height/vscale
    hscale = width/hscale
    var voffset = verticalMin
    var hoffset = horizontalMin

    hoffset -= (Math.max(...horizontal) - Math.min(...horizontal))*0.07

    var px = Math.floor(((canvas.width)*0.07)/2.6)
    ctx.font = (px + 'px serif')
    if (color.length === 9) {
        color = color.slice(0,7)
    }
    ctx.fillStyle = color
    ctx.strokeStyle = color

    if (graphtype === 3) {
        var grd = ctx.createLinearGradient(0, 0, 0, height);
        grd.addColorStop(0, color);
        grd.addColorStop(1, endcolor);
        ctx.strokeStyle = grd;
        ctx.fillStyle = grd;
    }

    if (numplace === 0 || numplace === undefined) {
        var start = 1
        }
    else {
        var start = canvas.width-(canvas.width*0.07)
        }
        ctx.font = "bold " + ctx.font
    for(var i = 1;i<11;i++) {
        var Text = ((Math.max(...calcvertical) - Math.min(...calcvertical))*((i-1)/10))+Math.min(...calcvertical)

        let precision = Math.max(0, 3-String(Math.round(Text)).length)

        Text = Number(Text.toFixed(precision))

        ctx.fillText(Text, start, (height*(11-i))/10-5);
    }

    //Top one
    Text = ((Math.max(...calcvertical) - Math.min(...calcvertical))*((i-1)/10))+Math.min(...calcvertical)

    let precision = Math.max(0, 3-String(Math.round(Text)).length)

    Text = Number(Text.toFixed(precision))

    ctx.fillText(Text, start, 27);





    var px = Math.floor(((canvas.width)*0.07)/2.4)
    ctx.font = (px + 'px serif')
    if (color.length === 9) {
        color = color.slice(0,7)
    }


    if (!window.darkMode) {
        ctx.fillStyle = "black"
    }
    else {
        //Dark Mode
        ctx.fillStyle = "#eeeeee"
    }



    function formatDate(date) {
        var time = String(date.getHours())

        if (date.getHours() < 10) {
            time = "0" + time
        }
        time += ":"
        if (date.getMinutes() < 10) {
            time += "0" + date.getMinutes()
        }
        else {
            time += date.getMinutes()
        }
        time += " " + (date.getMonth()+1) + "/" + date.getDate() + "/" +date.getFullYear()
        return time
    }

    var time1 = new Date(timeframe[0])
    var time2 = new Date(timeframe[timeframe.length - 1])
    var time3 = new Date(((time2-time1)/2)+time1.getTime())

    var starttime = formatDate(time1)
    var endtime = formatDate(time2)
    var midtime = formatDate(time3)

    ctx.fillText(starttime, 10, (canvas.height*(11/12))-(canvas.height*0.06)-12)

    ctx.textAlign = "end";
    ctx.fillText(endtime, canvas.width-10, (canvas.height*(11/12))-(canvas.height*0.06)-12)

    ctx.textAlign = "center";
    ctx.fillText(midtime, canvas.width/2, (canvas.height*(11/12))-(canvas.height*0.06)-12)

    ctx.textAlign = "start";

	ctx.lineJoin = "round" //Round out edges, and make sure that lines don't spike off the canvas (miter is a really bad default)

    var px = Math.floor(((canvas.width)*0.07)/2.0)
    ctx.font = (px + 'px serif')
    ctx.fillStyle = color
    //We need to create a gradient for just the text "Water Temperature (F)"
    if (graphtype === 3) {
        var grd = ctx.createLinearGradient(0, height, 200, height);
        grd.addColorStop(0, color);
        grd.addColorStop(1, endcolor);
        ctx.strokeStyle = grd;
        ctx.fillStyle = grd;
    }

    if (graphtype === 2) {
        if (numplace === 0 || numplace === undefined) {
            ctx.fillText("Flow (Cubic Feet/Second)", start+5, (canvas.height*(11/12)));
        }
        else {
            ctx.textAlign = "right";
            ctx.fillText("Gauge Height (Feet)", start-5, (canvas.height*(11/12)));
            ctx.textAlign = "start";
        }
    }
    else if (graphtype === 3) {
        ctx.fillText("Water Temperature (°F)", start+5, (canvas.height*(11/12)));
    }
    else {
        if (GraphName === "Precipitation") {
            ctx.fillText("Precipitation (Inches)", start+5, (canvas.height*(11/12)));
            var fulldayprecip = 0
            var halfdayprecip = 0
            var preciplist = vertical.slice(-96)
            var preciplist = preciplist.map(Number)
            //convert strings to numbers
            preciplist.forEach(function(value){
                fulldayprecip += value
            })
            preciplist = preciplist.slice(-48)
            preciplist.forEach(function(value){
                halfdayprecip += value
            })

            fulldayprecip = fulldayprecip.toFixed(2)
            halfdayprecip = halfdayprecip.toFixed(2)

            ctx.fillText("Last 24 Hours: " + fulldayprecip + "\"", canvas.width-770, (canvas.height*(11/12)));
            ctx.fillText("Last 12 Hours: " + halfdayprecip + "\"", canvas.width-400, (canvas.height*(11/12)));
        }
        else if (GraphName === "cfs") {
            ctx.fillText("Flow (Cubic Feet/Second)", start+5, (canvas.height*(11/12)));
        }
        else if (GraphName === "height") {
            ctx.fillText("Gauge Height (Feet)", start+5, (canvas.height*(11/12)));
        }
        else {
            ctx.fillText("Labeling Error...", start+5, (canvas.height*(11/12)));
        }
    }

    //set it back
    if (graphtype === 3) {
        //The area that actually has the graph is the top 80% height wise
        var grd = ctx.createLinearGradient(0, 0, 0, canvas.height*0.8);
        grd.addColorStop(0, color);
        grd.addColorStop(1, endcolor);
        ctx.strokeStyle = grd;
        ctx.fillStyle = grd;
    }

    if (!window.darkMode) {
        ctx.fillStyle = "black"
    }
    else {
        //Dark Mode
        ctx.fillStyle = "#eeeeee"
    }

    ctx.textAlign = "center";
	//Fill the name of the gauge. Max 1150px.
    ctx.fillText(Source, canvas.width/2 , canvas.height-10, 1150);
    ctx.textAlign = "start";

    function H(Value) {
        return Math.round((Value-hoffset)*hscale)
    }

    function V(Value) {
        return Math.round(height-((Value-voffset)*vscale))
    }


    for (var p = 0;p<Math.min(vertical.length, horizontal.length);p++) {
        if (!isNaN(Number(vertical[p])) && vertical[p] !== "") {
            ctx.moveTo(H(horizontal[p]), V(vertical[p]))
            break;
        }
    }


    var valid = 1

    for (var i = p;i<Math.min(vertical.length, horizontal.length);i++) {
        if (!isNaN(Number(vertical[i])) && vertical[i] !== "") {
            if (valid === 1) {
                ctx.lineTo(H(horizontal[i]), V(vertical[i]))
            }
            else {
                ctx.moveTo(H(horizontal[i]), V(vertical[i])+10)
                ctx.lineTo(H(horizontal[i]), V(vertical[i]))
                valid = 1
            }
        }
        else {
            valid = 0
        }
    }


    ctx.stroke();
    ctx.beginPath()

    ctx.lineWidth = Math.ceil(ctx.lineWidth/10)

    if (!window.darkMode) {
        ctx.strokeStyle = "000000AA"
    }
    else {
        //Dark Mode
        ctx.strokeStyle = "#ccccccAA"
    }

    for (var i = 1;i<11;i++) {
        ctx.moveTo(0, height*(11-i)/10)
        ctx.lineTo(canvas.width, height*(11-i)/10)
    }
    ctx.stroke()
}


module.exports = {
    addLine
}


/***/ }),
/* 8 */
/***/ (function(module, exports) {

function NewSpan(Text) {
    let span = document.createElement("span")
    span.className = "riverspan"
    span.innerHTML = Text
    return span
}

function addSorting(span, type, reverse = false) {
    span.addEventListener("click", function() {
        let query = window.getAdvancedSearchParameters()
        if (query.sort.query === type) {
            query.sort.reverse = !query.sort.reverse
            reverse = query.sort.reverse
        }
        else {
            query.sort.query = type
            query.sort.reverse = reverse
            reverse = !reverse
        }
        window.setMenuFromSearch(query)
        NewList()
    })
}


function TopBar() {
    this.create = function() {
        let button = document.createElement("button")
        button.id = "topbar"
        button.className = "riverbutton"

        if (!!window.MSInputMethodContext && !!document.documentMode) {
            //IE 11 will not dispatch click events to the Name, Skill, Rating, etc, spans, but rather to their parent.
            //Time to do an evil workaround...
            button.onclick = function(e) {
                var x = e.clientX, y = e.clientY,
                    elementMouseIsOver = document.elementFromPoint(x, y);

                elementMouseIsOver.click()
            }
        }

        let span = NewSpan("River⇅")
        addSorting(span, "alphabetical", true) //Starts sorted alphabetically, a-z. Pass 1 so the first sort reverses that.
        button.appendChild(span)

        button.appendChild(NewSpan("Section"))

        function addSkillSpan() {
            span = NewSpan("Skill⇅")
            span.classList.add("skillspan")
            addSorting(span, "skill", false)
            button.appendChild(span)
        }

        function addClassSpan() {
            span = NewSpan("Class")
            span.classList.add("classspan")
            button.appendChild(span)
        }

        if (localStorage.getItem("classOrSkill") === "class") {
            addClassSpan() //Add the class span first so it shows up on small screens.
            addSkillSpan()
        }
        else {
            addSkillSpan() //Add the skill span first so it shows up on small screens.
            addClassSpan()
        }

	    span = NewSpan("Rating⇅")
        addSorting(span, "rating", false) //We want greatest first, not least first, on the first sort. Pass 0 to not reverse
        button.appendChild(span)

        span = NewSpan("Flow/Trend⇅")
        addSorting(span, "running", false) //Show highest flow first, instead of lowest. Pass 0 to not reverse.
        button.appendChild(span)

        return button
    }

    this.delete = function() {
        let Node = document.getElementById("topbar")
        if (Node) {
            Node.parentNode.removeChild(Node)
        }
    }
}


module.exports = {
    TopBar
}


/***/ }),
/* 9 */
/***/ (function(module, exports, __webpack_require__) {

let {calculateColor, calculateDirection, calculateRelativeFlow} = __webpack_require__(1)

const {skillTranslations} = __webpack_require__(2)
const {riverbuttonClicked} = __webpack_require__(10)

function addHandlers(button, locate) {
		let river = ItemHolder[locate]

		button.addEventListener("mouseover", function(){
					button.style.backgroundColor =  calculateColor(river, {highlighted: true})
				})

				button.addEventListener("mouseout", function(){
					button.style.backgroundColor = calculateColor(river)
				})

				window.addEventListener("colorSchemeChanged", function() {
					if (river.dam) {
						button.style.background = createStripes()
					}
					button.style.backgroundColor = calculateColor(river)
				})


	button.addEventListener("click", function() {
		riverbuttonClicked(button, river)
	})
}


function createStripes(newColor = window.darkMode ? "rgba(256,256,256,0.25)":"rgba(170,170,170,0.33)", oldColor = "rgba(0,0,0,0)") {
		//If the river has a dam, stripe it.

		let background = "linear-gradient(150deg"

		for (let i=0;i<19;i++) {
			background += ", "
			background += i % 3 ? oldColor:newColor
		}

        background += ")"

		return background
}



function AddSpan(text, elem, className) {
	let span = document.createElement("span")
    span.innerHTML = text
    span.className = "riverspan"
	if (className) {span.classList.add(className)}
	elem.appendChild(span)
    return span
}


			function addClassSpan(river, button) {
				let riverclass = river.class || ""
				//Put a zero width space between a parantheses and the preceeding character so that the browser knows it can split the line.
				//This helps make the browser correctly wrap class instead of overflowing.
				riverclass = riverclass.split("(").join("\u200b(")
				AddSpan(riverclass, button).classList.add("classspan")
			}

			function addSkillSpan(river, button) {
				//Check if the user has disabled tooltips.
				if (localStorage.getItem("skillTooltips") === "false") {
					AddSpan(river.skill, button).classList.add("skillspan")
				}
				else {
					let skillSpan = document.createElement("span")
					skillSpan.className = "riverspan skillspan tooltip"

					let tooltip = document.createElement("div")
					tooltip.innerHTML = river.skill
					tooltip.className = "tooltip"

					let tooltiptext = document.createElement("span")
					tooltiptext.innerHTML = skillTranslations[river.skill]
					tooltiptext.className = "tooltiptext"

					skillSpan.style.borderBottom = "none"

					tooltip.appendChild(tooltiptext)
					skillSpan.appendChild(tooltip)
					button.appendChild(skillSpan)
				}
			}


function addRatingSpan(river, button) {
            //Star images for rating
            if (river.rating === "Error") {
				//Make sure that the span is the correct width, but inivisble.
                let span = AddSpan("☆☆☆☆☆", button)
				span.style.opacity = "0.2"
				span.classList.add("emptyStars")
            }
            else {
				let span = document.createElement("span")
                span.className = "riverspan"

				//We will use one empty span to set the width of the containing span.
				//We will use another empty span to overlay the full stars
                let spacer = document.createElement("span")
				spacer.className = "emptyStars"
				spacer.innerHTML = "☆☆☆☆☆"
				spacer.style.opacity = "0"
                span.appendChild(spacer)

                let empty = document.createElement("span")
				empty.className = "emptyStars"
				empty.innerHTML = "☆☆☆☆☆"
				empty.style.position = "absolute"
				empty.style.zIndex = "1" //Overlay the full stars
                span.appendChild(empty)

				let full = document.createElement("span")
				full.className = "fullStars"
				full.innerHTML = "★★★★★"
				full.style.width = river.rating*20 + "%"
                span.appendChild(full)

                button.appendChild(span)
            }
}


function addFlowData(river) {
	try {
			//Load this.flow from usgsarray.
			let data = usgsarray[river.usgs]
			if (data) {
	            let cfs = data.cfs
	            let feet = data.feet

	            let latestCfs, latestFeet;
				try {
					if (cfs) {
						let latestCFSReading = cfs[cfs.length - 1]
						if (latestCFSReading) {
							//Equipment malfunctions, conversion table changes/creation, backwater at measurement site, etc, will result in USGS intentionally making values null.
							latestCfs = latestCFSReading.value
						}
					}
				}
				catch(e) {console.error(e);console.log(river.usgs)}
				try {
					if (feet) {
						let latestFeetReading = feet[feet.length - 1]
						if (latestFeetReading) {
							//Though issues are alot rarer than with CFS, equipment malfunctions can cause this to be null. 
							latestFeet = latestFeetReading.value
						}
					}
				}
				catch(e) {console.error(e);console.log(river.usgs)}

	            river.feet = latestFeet
	            river.cfs = latestCfs

	            if (latestCfs && latestFeet) {
	                river.flow = latestCfs + "cfs " + latestFeet + "ft"
	            }
	            else if (latestCfs) {
	                river.flow = cfs[cfs.length - 1].value + " cfs"
	            }
	            else if (latestFeet) {
	                river.flow = feet[feet.length - 1].value + " ft"
	            }
			}
	}
	catch(e) {console.error(e)}
}



function addFlowSpan(river, button) {
			//If there is already a flowspan, get rid of it.
			let current = button.querySelector(".flowspan")
			if (current) {current.remove()}
	
            if (river.flow) {
				let value = river.flow + (calculateDirection(river.usgs) || "")
				//If the user has color blind mode enabled, add river.running to one digit onto the flow data.
				if (localStorage.getItem("colorBlindMode") === "true" && calculateColor(river) && river.running !== undefined) {
					value += "(" + Math.round(river.running*10)/10 + ")"
				}
				//TODO: Show the text "Dam" if there is plenty of space to do so. Consider using a smaller icon instead.
				//value += this.dam ? "Dam" : ""
                AddSpan(value, button, "flowspan")
            }
			else if (river.dam) {AddSpan("Dam", button, "flowspan")}
}


function addFlowStyling(river, button) {
		if (river.dam) {
			button.style.background = createStripes()
		}
		if (calculateColor(river)) {
			button.style.backgroundColor = calculateColor(river)
		}
		else if (river.dam) {
			//Background color gets overwrote by background. This class uses !important to prevent that.
			button.classList.add("riverbuttonDam")
		}
}


function River(locate, event) {

    //Copies name, section, skill, rating, writeup, tags, usgs, plat,plon, tlat,tlon, aw, dam
    Object.assign(this, event)
    //tags and writeup need to be a string. They can't be undefined
    this.tags = this.tags || ""
    this.writeup = this.writeup || ""
    //Convert the numeric value to the filename

	this.rating = parseFloat(this.rating)
	//Consider allowing ratings less than 1.
    if (this.rating < 1 || this.rating > 5 || isNaN(this.rating) || this.rating === undefined) {
        this.rating = "Error"
    }

    this.skill = this.skill || "?"

    this.base = "b" + locate
    this.expanded = 0
    this.index = locate
	
	if (this.relatedusgs) {
		try {
			this.relatedusgs = JSON.parse(this.relatedusgs)
		}
		catch(e) {console.warn(e);}
	}

    this.create = function (forceregenerate) {
        //Only create the button once - It's about 3 times faster.
        if (!this.finished || forceregenerate) {

            var button = document.createElement("button")
            button.id = this.base + 1
			
			if (!this.id) {
				button.classList.add("riverbuttonGauge")
			}			

            AddSpan(this.name, button)
            AddSpan(this.section, button)


			if (localStorage.getItem("classOrSkill") === "class") {
				//Put class first so that it will show up if screen small.
				addClassSpan(this, button)
				addSkillSpan(this, button)
			}
			else {
				//Put skill first so that it will show up if screen small.
				addSkillSpan(this, button)
				addClassSpan(this, button)
			}

            //Star images for rating
            addRatingSpan(this, button)

			addFlowData(this)

			addFlowSpan(this, button)


            button.classList.add("riverbutton")
            //Add the click handler
            addHandlers(button, locate)

            //Store button for reuse later
            this.finished = button

        }

		this.updateExpansion = function() {
			//Do not use "this". If called from event listener on window it will fail.
			let river = ItemHolder[locate]
			//Make sure it is expanded. Otherwise, there is no need to update the expansion - and
			//updating the expansion can take a lot of time, expecially if it causes reflow.
			if (river.expanded) {
				river.finished.click()
				river.finished.click()
			}
		}

		window.addEventListener("colorSchemeChanged", this.updateExpansion) //TODO: This event listener should not remain forever.

		addFlowStyling(this, this.finished)

        //Return finished button
        return this.finished

    }
	
	
	this.updateFlowData = function() {
		addFlowData(this) //Update the flow information on the river object.
		if (this.finished) {
			addFlowSpan(this, this.finished) //Update the flowspan if it exists.
			addFlowStyling(this, this.finished) //And make sure colors, etc, are updated.
		}
		else {
			calculateRelativeFlow(this) //Adds the lowflow, relative flow, and other values to the object.
		}
		if (this.updateExpansion) {
			this.updateExpansion()
		}
	}

	this.updateFlowData()

    this.delete = function () {
        let river = ItemHolder[locate]
        function Remove(Code) {
            let ToDelete = document.getElementById(river.base + Code)
            if (ToDelete) {
                ToDelete.parentNode.removeChild(ToDelete)
            }
        }

        //Reset background color
        let reset = document.getElementById(river.base + 1)
        if (reset) {
            reset.style.backgroundColor = ""
        }

        Remove(2)
        Remove(1)

    }
}

module.exports = {
	River
}


/***/ }),
/* 10 */
/***/ (function(module, exports, __webpack_require__) {

const {skillTranslations} = __webpack_require__(2)    
const addGraphs = __webpack_require__(11).addGraphs
const {calculateAge} = __webpack_require__(1)
const {createDeviceNotificationsWidget, createEmailNotificationsWidget} = __webpack_require__(12)

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

			div.innerHTML = ""

			//Only show a link if river.dam is a link. This allows rivers to be marked as dams and explainations to be put in the writeups.
			if (river.dam && river.dam.trim().startsWith("http")) {
                //Adding to div.innerHTML works, but logs CSP errors
                let link = document.createElement("a")
                link.target = "_blank"
                link.rel = "noopener"
                link.href = river.dam
                link.innerHTML = "This river has a dam. View information."
                div.appendChild(link)
				div.appendChild(document.createElement("br"))
				div.appendChild(document.createElement("br"))
            }

			div.innerHTML += river.writeup + "<br><br>"

			if (river.class && river.skill) {
				div.innerHTML += "This river is class " + river.class + " and is rated " + skillTranslations[river.skill] + ".<br>"
			}
			else if (river.class) {
				div.innerHTML += "This river is rated class " + river.class + ".<br>"
			}
			else if (river.skill) {
				div.innerHTML += "This river is rated " + skillTranslations[river.skill] + ".<br>"
			}


			if (river.averagegradient) {div.innerHTML += "Average gradient: " + river.averagegradient + " feet per mile.<br>"}
			if (river.maxgradient) {div.innerHTML += "Maximum gradient: " + river.maxgradient + " feet per mile.<br>"}

			if (river.plat && river.plon) {
                div.innerHTML += "Put-In GPS Coordinates: " + river.plat + ", " + river.plon + "<br>"
            }

            if (river.tlat && river.tlon) {
                div.innerHTML += "Take-Out GPS Coordinates: " + river.tlat + ", " + river.tlon + "<br>"
            }

			//Show the user the values being used for determining relative flow.
            let values = ["minrun", "lowflow", "midflow", "highflow", "maxrun"]
			let flowRange = document.createElement("p")
			flowRange.innerHTML = ""
            for (let i=0;i<values.length;i++) {
                let name = values[i]
                if (river[name] && !isNaN(parseFloat(river[name]))) {
                    flowRange.innerHTML += name + ":" + river[name] + " "
                }
            }
			if (flowRange.innerHTML !== "") {div.appendChild(flowRange)}

			if (river.id) {
				//All rivers have an ID. All gauges do not.
				div.appendChild(document.createElement("br"))
				let link = document.createElement("a")
				link.target = "_blank"
				link.rel = "noopener"
				link.href = "https://docs.google.com/document/d/" + river.id
				link.innerHTML = "Edit this river"
				div.appendChild(link)
			}
            if (river.aw) {
                div.appendChild(document.createElement("br"))
                let link = document.createElement("a")
                link.target = "_blank"
                link.rel = "noopener"
                link.href = "https://www.americanwhitewater.org/content/River/detail/id/" + river.aw
                link.innerHTML = "View this river on American Whitewater"
                div.appendChild(link)
            }


            if (river.usgs) {
                //Adding to div.innerHTML works, but logs CSP errors
                div.appendChild(document.createElement("br"))
                let link = document.createElement("a")
                link.target = "_blank"
                link.rel = "noopener"
                link.href = "https://waterdata.usgs.gov/nwis/uv?site_no=" + river.usgs
                link.innerHTML = "View flow information on USGS"
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

			//Auxillary function
			//TODO: Show button to see code used by virtual gauge.
			function addUSGSGraphs(usgsID, relatedGauge) {

				let data = self.usgsarray[usgsID]
				if (!data) {console.log("No flow data for " + usgsID); return;}
				
				//Alert the user if the data is (at least 2 hours) old
				let dataAge
                try {
                    dataAge = calculateAge(usgsID)
                }
                catch(e) {
                    console.error(e)
                    dataAge = null
                }
                let maxAge = 1000*60*60*2
                let oldDataWarning;
				if (dataAge > maxAge) {
					oldDataWarning = document.createElement("p")
					oldDataWarning.innerHTML = "Check the dates! This river data is more than " + Math.floor(dataAge/1000/60/60) + " hours old!"

					oldDataWarning.className = "oldDataWarning"
					div.appendChild(oldDataWarning)
				}

				function addDisclaimer(text) {
					let disclaimer = document.createElement("p")
					disclaimer.style.fontWeight = "bold"
					disclaimer.style.textAlign = "center"
					disclaimer.innerHTML = text
					return div.appendChild(disclaimer)
				}

				if (relatedGauge) {
					//Space out the gauges.
					div.appendChild(document.createElement("br"))
					div.appendChild(document.createElement("br"))
					div.appendChild(document.createElement("br"))
				}
				div.appendChild(createDeviceNotificationsWidget(river, usgsID))
				div.appendChild(createEmailNotificationsWidget(river, usgsID))

				console.time("Add Graphs")
				let graphs = addGraphs(data)
				div.appendChild(graphs)
				
				//Fetch comprehensive flow data, then update the graphs.
				//TODO: Add XMLHttpRequest fallback.
				if (!usgsarray[usgsID].full) {
					fetch("gaugeReadings/" + usgsID).then((response) => {
						response.json().then((newData) => {
							usgsarray[usgsID] = newData
							usgsarray[usgsID].full = true
							graphs.replaceWith(addGraphs(self.usgsarray[usgsID]))
							if (oldDataWarning) {oldDataWarning.remove()}
						})
					})
				}
				
				console.timeEnd("Add Graphs")
			}

            //USGS data may not have loaded yet
			if (self.usgsarray) {
				river.usgs && addUSGSGraphs(river.usgs)
				if (river.relatedusgs) {
					for (let i=0;i<river.relatedusgs.length;i++) {
						if (river.relatedusgs[i] === "") {continue;}
						addUSGSGraphs(river.relatedusgs[i], true)
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

/***/ }),
/* 11 */
/***/ (function(module, exports) {


//Auxillary Function
//Creates the canvas used by each of the graphs
function createcanvas() {
    let canvas = document.createElement("canvas")
    canvas.width = 1200
    canvas.height = 800

	canvas.className = "graph"
	
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
		if (!arr[i]) {continue;}
        let obj = arr[i]
        values.push(obj.value)
        timestamps.push(obj.dateTime)
    }

    return {values:values,timestamps:timestamps}
}

//In dark mode, blue doesn't show up well enough, so different colors are used.


function getFlowGraph(cfs, height, data) {
    //Make sure we actually have some data, and don't create an empty graph
    if (!(cfs || height)) {return}

    let canvas = createcanvas()
    //Time to create a dual lined graph!
    if (cfs && height) {
		let parts = toparts(cfs)
        addLine("cfs", parts.timestamps, data.name, canvas, 0, parts.values, "#00CCFF", 2)
        parts = toparts(height)
        addLine("height", parts.timestamps, data.name, canvas, 0, parts.values, window.darkMode?"#7175ff":"#0000FF", 2, 1)
	}
    //We won't have both cfs and height. Draw a single line graph for whichever we have.
    else if (cfs) {
        let parts = toparts(cfs)
        addLine("cfs", parts.timestamps, data.name, canvas, 0, parts.values, "#00CCFF")
    }
    else {
        let parts = toparts(height)
        addLine("height", parts.timestamps, data.name, canvas, 0, parts.values,  window.darkMode?"#7175ff":"blue")
    }

	return canvas
}


function getTempGraph(temp, data) {
    if (temp) {
        let canvas = createcanvas()

        let parts = toparts(temp)
        addLine("", parts.timestamps, data.name, canvas, 0, parts.values, "red", 3, window.darkMode?"#00AAFF":"blue")

 		return canvas
    }
}



function getPrecipGraph(precip, data) {
    if (precip) {
        let canvas = createcanvas()

        let parts = toparts(precip)
        addLine("Precipitation", parts.timestamps, data.name, canvas, 0, parts.values, "#0099FF")

		return canvas
    }
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
			try {
				//Use one graph for cfs and one for feet if the user is in color blind mode.
				let cfsGraph = getFlowGraph(data.cfs, undefined, data)
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
				let feetGraph = getFlowGraph(undefined, data.feet, data)
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
        let tempGraph = getTempGraph(data.temp, data)
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
        let precipGraph = getPrecipGraph(data.precip, data)
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


/***/ }),
/* 12 */
/***/ (function(module, exports) {

			function createDeviceNotificationsWidget(river, usgsID) {
				let data = {
					id: river.id,
					name: river.name
				}

				let existing;
				let current;

				function resyncData() {
					existing = JSON.parse(localStorage.getItem("flownotifications") || "{}")
					current = existing[usgsID]
					if (current) {
						current = current[river.id]
					}
				}

				resyncData()

				console.log(current)

				//Container for the river alert creator.
				let container = document.createElement("div")
				container.className = "notificationsContainer"

				//Describe what this does, and alert the user if their browser is unsupported.
				let description = document.createElement("p")
				container.appendChild(description)
				description.innerHTML = "Receive notifications for " + ((usgsarray[usgsID] && usgsarray[usgsID].name) || "this river") + ":<br>"
				description.style.marginBottom = "0.5em" //Make the description closer to what it is describing...

				if (!("PushManager" in window) || !("Notification" in window) || !("serviceWorker" in navigator)) {
					description.innerHTML += "Your browser does not support flow alerts. (iOS users - blame apply for abusive app store monopoly behavior). You may however utilize email notifications."
					return description;
				}

				let low = document.createElement("input")
				low.className = "minimum"
				low.type = "number"
				low.placeholder = "Minimum"
				low.value = (current && current.minimum) || ""

				let high = document.createElement("input")
				high.className = "maximum"
				high.placeholder = "Maximum"
				high.value = (current && current.maximum) || ""
				high.type = "number"

				let units = document.createElement("select")

				let blank = document.createElement("option")
				blank.selected = true
				blank.disabled = true
				blank.value = ""
				blank.innerHTML = "Units"
				units.appendChild(blank)

				let feet = document.createElement("option")
				feet.value = "ft"
				feet.innerHTML = "Feet"
				feet.pattern = "[0-9]"
				units.appendChild(feet)

				let cfs = document.createElement("option")
				cfs.value = "cfs"
				cfs.innerHTML = "CFS"
				cfs.pattern = "[0-9]"
				units.appendChild(cfs)

				units.value = (current && current.units) || ""

				let save = document.createElement("button")
				save.innerHTML = "Save"

				save.addEventListener("click", function() {
			        let lowValue = parseFloat(low.value)
					let highValue = parseFloat(high.value)

					data.minimum = lowValue
					data.maximum = highValue
					data.units = units.value

					if (isNaN(lowValue)) {
						alert("Minimum must be a number. Ex: 2.37, 3000")
						return
					}

					if (isNaN(highValue)) {
						alert("Maximum must be a number. Ex: 2.37, 3000")
						return
					}

					if (!units.value) {
						alert("Please specify whether feet or cfs should be used.")
						return;
					}

					resyncData() //Make sure we don't restore rivers that were removed while this river was open.

					existing[usgsID] = existing[usgsID] || {}
					existing[usgsID][river.id] = data

					localStorage.setItem("flownotifications", JSON.stringify(existing))

					window.open("notifications.html")
				})

				let manage = document.createElement("button")
				manage.innerHTML = "Manage Notifications"
				manage.addEventListener("click", function() {
					window.open("notifications.html")
				})

				container.appendChild(low)
				container.appendChild(high)
				container.appendChild(units)
				container.appendChild(save)
				container.appendChild(manage)
				return container
			}
			



//TODO: How should email notificatios get handled?			

//Proposal: Seperate widget. Save button may want to actually save instead of opening the window.
//TODO: Remove a lot of duplication

			function createEmailNotificationsWidget(river, usgsID) {
				let data = {
					id: river.id,
					name: river.name
				}

				//Container for the river alert creator.
				let container = document.createElement("div")
				container.className = "notificationsContainer"

				//Describe what this does, and alert the user if their browser is unsupported.
				let description = document.createElement("p")
				container.appendChild(description)
				description.innerHTML = "Receive Emails for " + ((usgsarray[usgsID] && usgsarray[usgsID].name) || "this river") + ":<br>"
				description.style.marginBottom = "0.5em" //Make the description closer to what it is describing...

				let low = document.createElement("input")
				low.className = "minimum"
				low.type = "number"
				low.placeholder = "Minimum"

				let high = document.createElement("input")
				high.className = "maximum"
				high.placeholder = "Maximum"
				high.type = "number"

				let units = document.createElement("select")

				let blank = document.createElement("option")
				blank.selected = true
				blank.disabled = true
				blank.value = ""
				blank.innerHTML = "Units"
				units.appendChild(blank)

				let feet = document.createElement("option")
				feet.value = "ft"
				feet.innerHTML = "Feet"
				feet.pattern = "[0-9]"
				units.appendChild(feet)

				let cfs = document.createElement("option")
				cfs.value = "cfs"
				cfs.innerHTML = "CFS"
				cfs.pattern = "[0-9]"
				units.appendChild(cfs)

				let save = document.createElement("button")
				save.innerHTML = "Save"

				save.addEventListener("click", function() {
					let addparameters = {}
					
			        let lowValue = parseFloat(low.value)
					let highValue = parseFloat(high.value)

					data.minimum = lowValue
					data.maximum = highValue
					data.units = units.value

					if (isNaN(lowValue)) {
						alert("Minimum must be a number. Ex: 2.37, 3000")
						return
					}

					if (isNaN(highValue)) {
						alert("Maximum must be a number. Ex: 2.37, 3000")
						return
					}

					if (!units.value) {
						alert("Please specify whether feet or cfs should be used.")
						return;
					}

					addparameters[usgsID] = {}
					addparameters[usgsID][river.id] = data

					localStorage.setItem("addparameters", JSON.stringify(addparameters))

					window.open("emailnotifications.html")
				})

				let manage = document.createElement("button")
				manage.innerHTML = "Manage Notifications"
				manage.addEventListener("click", function() {
					window.open("emailnotifications.html")
				})

				container.appendChild(low)
				container.appendChild(high)
				container.appendChild(units)
				container.appendChild(save)
				container.appendChild(manage)
				return container
			}
			

			module.exports = {
				createDeviceNotificationsWidget,
				createEmailNotificationsWidget
			}

/***/ }),
/* 13 */
/***/ (function(module, exports, __webpack_require__) {

((typeof window !== "undefined" && window) || globalThis).toDecimalDegrees = function(coord) {
	if (!isNaN(Number(coord))) {
		return Number(coord) //Coordinate is already in decimal form.
	}
	
	if (typeof coord !== "string") {
		return undefined;
	}

	let parts = coord.split(/[^.\w]+/) //Split on non-alphanumeric characters that aren't decimals.
	console.log(parts)
	let direction;
	for (let i=0;i<parts.length;i++) {
		if (["N","S","E","W"].includes(parts[i])) {
			direction = parts[i];
			parts.splice(i, 1)
			break;
		}
	}
	console.log(parts)
	let degrees = Number(parts[0])
	let minutes = Number(parts[1]) || 0
	let seconds = Number(parts[2]) || 0

	minutes += seconds/60
	degrees += minutes/60

	if (isNaN(Number(degrees))) {throw "Coordinate " + coord + " could not be processed."}

	if (direction === "S" || direction === "W") {degrees = -degrees}
	
	return degrees
}



let sortUtils = __webpack_require__(3)


function normalSearch(list, query) {
    query = query.toLowerCase().trim()
	
	if (query === "") {return sortUtils.sort("alphabetical", list)} //Don't search for an empty query.
	
	//The first buckets are better matches than later ones.
    let buckets = [[],[],[],[],[],[],[]]
	let bucket2 = [] //Bucket 2 - index 1 in buckets - is special.
	
	//corejs regexp polyfill is taking 40 times longer splitting with the regex /[ ,]+/ than using .split(",").join(" ").split(" ")
	//A bug will need to be filed - this level of performance is simply unacceptable.
	//See if this polyfill can be removed.
		
	list.forEach(function(event) {
		
		let lowerCaseName = event.name.toLowerCase()
		let lowerCaseSection = event.section.toLowerCase()
		
		
		//First bucket
		let nameExactMatch = (lowerCaseName === query)
		let sectionExactMatch = (lowerCaseSection === query)
				
		if (nameExactMatch || sectionExactMatch) {
			buckets[0].push(event)
			return
		}

		
		//Second Bucket
		//This bucket is build to handle searches across name and section - such as "Lower Haw"
		//As long as name and section contain all space seperated parts of the query, this bucket can be used.
		
		//Split on spaces and commas. This handles things like "Lower, Lower Yough"
		let words = query.split(",").join(" ").split(" ")
		
		if (words.length > 1) {
			let passes = words.every((word) => {
				return (lowerCaseName.indexOf(word) !== -1) || (lowerCaseSection.indexOf(word) !== -1)
			})

			let nameWords = lowerCaseName.split(",").join(" ").split(" ")
			let sectionWords = lowerCaseSection.split(",").join(" ").split(" ")
			//For the search "Lower Haw", the Lower Haw should show up higher than Lower Hawksbill Creek.
			//This works by assigning higher relevance to exact matches, then startsWith, than contains.
			let bonus = words.reduce((bonus, word) => {
				//TODO: Consider making .includes() and startsWith worth 7.
				if (nameWords.includes(word)) {
					delete nameWords[nameWords.indexOf(word)] //Remove the word so that is can't be matched twice (ex. text lower, search lower lower)
					return bonus + 10
				}
				else if (sectionWords.includes(word)) {
					delete sectionWords[sectionWords.indexOf(word)]
					return bonus + 10
				}
				else if (lowerCaseName.startsWith(word) || lowerCaseSection.startsWith(word)) {
					return bonus + 6
				}
				//If name or section contains word.
				else if ((lowerCaseName.indexOf(word) !== -1) || (lowerCaseSection.indexOf(word) !== -1)) {
					return bonus + 2
				}
				return bonus
			}, 0)

			//If the total number of words in the query are equal to the number of words in name and section (so all words matched), add one point.
			//This makes things like the Lower Yough show up above the Lower Lower Yough for the search Lower Yough
			if (bonus && nameWords.length + sectionWords.length === words.length) {bonus += 1}

			if (passes) {
				bucket2[bonus] = bucket2[bonus] || []
				bucket2[bonus].push(event)
				return;
			}
		}
		
		//Thrid bucket
		let nameMatches = lowerCaseName.startsWith(query)
		let sectionMatches = lowerCaseSection.startsWith(query)
		
		if (nameMatches || sectionMatches) {
			buckets[2].push(event)
			return;
		}
		
		//Fourth bucket
		let tagsContains = (event.tags.toLowerCase().indexOf(query) !== -1)
		
		if (tagsContains) {
			buckets[3].push(event)
			return;
		}

		
		//Fifth bucket
		let nameContains = (lowerCaseName.indexOf(query) !== -1)
		
		if (nameContains) {
			buckets[4].push(event)
			return;
		}
		
		//Sixth Bucket
		let sectionContains = (lowerCaseSection.indexOf(query) !== -1)

		if (sectionContains) {
			buckets[5].push(event)
			return;
		}
		
		//Final Bucket
		let writeupContains = (event.writeup.toLowerCase().indexOf(query) !== -1)
		
		if (writeupContains) {buckets[6].push(event)}
    })
	
	//Sort each match level alphabetically by river name
	buckets = buckets.map((bucket) => {return sortUtils.sort("alphabetical", bucket)})
		
	bucket2.reverse() //Highest relevance ones come first in the second bucket.
	
	for (let i=0;i<bucket2.length;i++) {
		let subbucket = bucket2[i]
		if (subbucket) {
			//Sort the subbucket alphabetically.
			subbucket = sortUtils.sort("alphabetical", subbucket)
			subbucket.forEach((value) => {
				buckets[1].push(value)
			})
		}
	}
	
    let result = [].concat(...buckets)
	result.buckets = buckets
	return result
}


function stringQuery(parameters) {

    let content = parameters.content
    let query = parameters.query

    //Ignore case by default
    if (!parameters.matchCase) {
        content = content.toLowerCase()
        query = query.toLowerCase()
    }

    if (parameters.type === "contains") {
        return content.includes(query)
    }
    else if (parameters.type === "matches") {
        return content === query
    }
    else {
        throw "Unknown Search Type " + parameters.type
    }
}


function stringFilter(list, property, parameters) {
    //Filter out the elements that fail the test
    //Since we may be deleting elements in the list, items will be skipped if we use array.length
    for (let item in list) {
        parameters.content = list[item][property]
        let passes = stringQuery(parameters)
        if (!passes) {
            //Remove the item if it fails
            delete list[item]
        }
    }
    delete parameters.content //Cleanup
    return list
}



function skillToNumber(skill) {
    let value
    switch (skill) {
        case "FW":
            value = 1;
            break;
        case "B":
            value = 2;
            break;
        case "N":
            value = 3;
            break;
        case "LI":
            value = 4;
            break;
        case "I":
            value = 5;
            break;
        case "HI":
            value = 6;
            break;
        case "A":
            value = 7;
            break;
        case "E":
            value = 8;
    }
    return value
}






function skillFilter(list, parameters) {

    let query = parameters.query

    let min = Math.min(query[0], query[1])
    let max = Math.max(query[0], query[1])

    for (let item in list) {

        let passes = false;
        let skill = skillToNumber(list[item].skill)

        if (min <= skill && skill <= max) {
            passes = true
        }

        if (!passes && !(parameters.includeUnknown && skill === undefined)) {
            //Remove the item if it fails
            delete list[item]
        }
    }

	return list
}









let calculateDistance = __webpack_require__(14).lambert //Lambert formula

function locationFilter(list, parameters) {

    let maxDistance = Number(parameters.distance)
    let lat1 = toDecimalDegrees(parameters.lat)
    let lon1 = toDecimalDegrees(parameters.lon)
		
    if (!(maxDistance && lat1 && lon1)) {
        //Cancel the search.
        //Technically we could be missing part of 1 coordinate, sometimes both, and eliminate some rivers, however this goes against
		//the purpose of location sorting - to find rivers, not eliminate them (we want all rivers to have full coordinates)
        return list
    }

    for (let item in list) {
        let river = list[item]

		let lat2 = toDecimalDegrees(river.plat) || toDecimalDegrees(river.tlat) || toDecimalDegrees(river.hidlat)
    	let lon2 = toDecimalDegrees(river.plon) || toDecimalDegrees(river.tlon) || toDecimalDegrees(river.hidlon)
	
		let distance = calculateDistance(lat1, lon1, lat2, lon2)
        		
        let passes = (distance < maxDistance) || parameters.includeUnknown //Follow parameters.includeUnknown unless the river has been eliminated on distance.

        if (!passes) {
            //Remove the item if it does not pass the test.
            delete list[item]
        }
    }
    return list

}


function flowFilter(list, parameters) {

	let query = parameters.query
	let min = query[0]
	let max = query[1]

    //Alert user when an actually useful flow search can't be performed.
    if (window.usgsDataAge === undefined && (max !== 4 || min !== 0)) {
        alert("Searching based on flow requires flow data, which has not fully loaded. The flow search is not being performed.")
        return list
    }

	for (let item in list) {
		let river = list[item]

        if (river.dam && parameters.includeDams) {
            //Do nothing if the river is a dam and dams are to be included.
        }
        //If we do not know flow status, follow parameters.includeUnknown
        else if (river.running === undefined) {
            if (!parameters.includeUnknown) {
                delete list[item]
            }
        }
        //If we do know flow status, filter based on the flow.
		else if (river.running < min || river.running > max) {
			delete list[item]
		}
	}
	return list
}

function tagsFilter(list, parameters) {
	let query = parameters.query
	let components = parameters.query.split(" ").join("").split(",")

	for (let item in list) {
		let river = list[item]

		for (let i=0;i<components.length;i++) {
			if (typeof river.tags !== "string" || !river.tags.toLowerCase().includes(components[i].toLowerCase())) {
				delete list[item]
			}
		}
	}
	return list
}


function ratingFilter(list, parameters) {

	let query = parameters.query
	let min = query[0]
	let max = query[1]

	for (let item in list) {
		let river = list[item]

        if (river.rating === "Error" && !parameters.includeUnknown) {
			delete list[item]
		}
		else if (Number(river.rating) < min || Number(river.rating) > max) {
			delete list[item]
		}
	}
	return list
}


//Query is in form of:
//{
//  name: {
//    type: "matches",
//    query: "potomac"
//},
//section: {
//    type: "contains",
//    query: "something"
//  },
// skill: {
//	type:"" //easier harder exactly from
//	value: 3 //An array of 2 if from
//from is inclusive (From medium to hard)
//},
//location:{
//	distance: 100 //Maximum distance in miles
//	lat: 78//Starting latitude
//	lon:-56 //Starting londitude
//	includeUnknown: false //Do not eliminate if location not known
//}
//}



function IDSearch(list, query) {
	if (query === undefined) {return list}

	let components = query.split(",")

	if (components.length === 0) {return list} //No IDs to search for.

	for (let item in list) {
		let river = list[item]
		if (!components.includes(river.id)) {
			delete list[item]
		}
	}
	return list
}



//This doesn't work for difficulty and rating - no greater than or equal to.
//That needs to be added
function advancedSearch(list, query) {
    //List is the array of river elements that we are searching
    //Query is the search parameters
    console.log(recursiveAssign({},query))

    for (let property in query) {
        //Iterate through each part of the query

        let parameters = query[property]

        if (["name", "section", "writeup"].includes(property)) {
            list = stringFilter(list, property, parameters)
        }
        else if (property === "normalSearch" || property === "sort") {
            //These are delt with later
        }
        else if (property === "skill") {
            list = skillFilter(list, parameters)
        }
        else if (property === "rating") {
            list = ratingFilter(list, parameters)
        }
        else if (property === "location") {
            list = locationFilter(list, parameters)
        }
        else if (property === "flow") {
            list = flowFilter(list, parameters)
        }
		else if (property === "tags") {
			list = tagsFilter(list, parameters)
		}
		else if (property === "id") {
			list = IDSearch(list, parameters)
		}
        else {
            alert("Unable to search based on " + property)
        }
    }

	list = list.filter(item => item !== undefined)
	console.time("normalSearch")
    if (query["normalSearch"] !== undefined) {list = normalSearch(list, query["normalSearch"])}
	console.timeEnd("normalSearch")
    if (query["sort"]) {list = sortUtils.sort(query["sort"].query, list, query["sort"].reverse)}
	
	let gaugesList = []
	if (list.buckets) {
		gaugesList = gaugesList.concat(...list.buckets.slice(0,3)) //Buckets 0, 1 and 2
	}
	else {
		gaugesList = list
	}

	let riverAmount = gaugesList.reduce((total, value) => {return total + (value.id !== undefined ? 1:0)}, 0) //Number of good river matches.
	
	if (list.buckets) {
		let additionalRivers = ([].concat(...list.buckets.slice(3))).reduce((total, value) => {return total + (value.id !== undefined ? 1:0)}, 0)
		list.gaugeAmount = list.length - riverAmount - additionalRivers
		list.riverAmount = riverAmount + additionalRivers
		
	}
	else {
		list.gaugeAmount = list.length - riverAmount
		list.riverAmount = riverAmount
	}
	
	if (riverAmount === 0) {list.useGauges = true}
	else {list.useGauges = false}
		
    return list
}






module.exports = {
    normalSearch,
    advancedSearch
}


/***/ }),
/* 14 */
/***/ (function(module, exports) {

function lambert(lat1, lon1, lat2, lon2) {
	//Should be accurate to <100 meters

	//Parameters from WGS-84
	let radius = 3963.1905919430524 //Equatorial radius in miles
	let flattening = 0.0033528106647474805

	lat1 = lat1 / 180 * Math.PI
	lon1 = lon1 / 180 * Math.PI
	lat2 = lat2 / 180 * Math.PI
	lon2 = lon2 / 180 * Math.PI

	let ratio = 1-flattening

	let reducedLat1 = Math.atan(ratio*Math.tan(lat1))
	let reducedLat2 = Math.atan(ratio*Math.tan(lat2))

    //Spherical Law of Cosines
	let angle = Math.acos(Math.sin(reducedLat1) * Math.sin(reducedLat2) + Math.cos(reducedLat1) * Math.cos(reducedLat2) * Math.cos(lon2-lon1))

	let p = (reducedLat1+reducedLat2)/2
	let q = (reducedLat2-reducedLat1)/2
	let x = (angle - Math.sin(angle)) * (((Math.sin(p)**2)*(Math.cos(q)**2))/(Math.cos(angle/2)**2))
	let y = (angle + Math.sin(angle)) *(((Math.cos(p)**2)*(Math.sin(q)**2))/(Math.sin(angle/2)**2))
	return radius*(angle-((flattening/2)*(x+y)))
}


module.exports = {
  lambert
}


/***/ }),
/* 15 */
/***/ (function(module, exports) {

//Used to determine where search parameters match the default.
//This is rather ineffecient, because it has to be called twice. A new system (probably using object.keys()) should be used instead.
	function _objectsEqual(obj1, obj2) {
		//Tells if all properties, recursively, match.

		//Avoid property of undefined issues.
		if (obj1 === undefined || obj2 === undefined) {
			if (obj1 !== obj2) {return false}
			return true
		}

		for (let property in obj1) {
			if (typeof obj1[property] === "object") {
				if (!objectsEqual(obj1[property], obj2[property])) {
					return false
				}
			}
			else {
				if (obj1[property] !== obj2[property]) {
					return false
				}
			}
		}
		return true
	}

	function objectsEqual(obj1, obj2) {
		return _objectsEqual(obj1, obj2) && _objectsEqual(obj2, obj1)
	}

function deleteMatchingPortions(obj1, obj2) {
	//Deletes all properties on obj1, recursively, that are identical to obj2
	if (!obj1 || !obj2) {
		return obj1
	}
	for (let property in obj1) {
			if (typeof obj1[property] === "object") {
				if (objectsEqual(obj1[property], obj2[property])) {
					//If the objects are equal, delete them.
					delete obj1[property]
				}
				//With an array, positional data can be totally lost by this. Do not delete portions of arrays.
				else if (!(obj1[property] instanceof Array)) {
					//Delete the portions of the objects that match.
					deleteMatchingPortions(obj1[property], obj2[property])
				}
			}
			else {
				if (obj1[property] === obj2[property]) {
					delete obj1[property]
				}
			}
		}
	return obj1
}

function recursiveAssign(target, ...objects) {
	if (objects.length > 1) {
		for (let i=0;i<objects.length;i++) {
			recursiveAssign(target, objects[i])
		}
	}
	else {
		let object = objects[0]
		for (let property in object) {
			if (typeof object[property] === "object") {
				if (typeof target[property] !== "object") {
					//Fixing needed!!!
					//Right here we need to clone, recursively, object[property]
					//Object.assign() is only one level deep.
					target[property] = recursiveAssign({}, object[property])
				}
				else {
					//Setting target[property] to the result probably isn't needed.
					target[property] = recursiveAssign(target[property], object[property])
				}
			}
			else {
				target[property] = object[property]
			}
		}
	}
	return target
}

module.exports = {
	recursiveAssign,
	deleteMatchingPortions,
	objectsEqual
}


/***/ }),
/* 16 */
/***/ (function(module, exports) {

function highlightFailingFields(parameters) {
	//Input checking. Highlight fields that fail in red.
	if (!toDecimalDegrees(parameters.location.lat) && (toDecimalDegrees(parameters.location.lon) || Number(parameters.location.distance) > 0)) {
		document.getElementById("latitudeQuery").style.border = "3px solid red"
	}
	else {
		document.getElementById("latitudeQuery").style.border = ""
	}
	
	if (!toDecimalDegrees(parameters.location.lon) && (toDecimalDegrees(parameters.location.lat) || Number(parameters.location.distance) > 0)) {
		document.getElementById("longitudeQuery").style.border = "3px solid red"
	}
	else {
		document.getElementById("longitudeQuery").style.border = ""
	}
	
	if (!(Number(parameters.location.distance) > 0) && (toDecimalDegrees(parameters.location.lat) || toDecimalDegrees(parameters.location.lon))) {
		document.getElementById("distanceQuery").style.border = "3px solid red"
	}
	else {
		document.getElementById("distanceQuery").style.border = ""
	}
}


//Generate advanced search parameters from menu
window.getAdvancedSearchParameters = function(filter) {
	//filter: Filter out parameters that match defaults.
	let parameters = {}

	parameters.name = {
		type: document.getElementById("nameType").value,
		query: document.getElementById("nameQuery").value
	}

	parameters.section  = {
		type: document.getElementById("sectionType").value,
		query: document.getElementById("sectionQuery").value
	}

	parameters.writeup = {
		type: document.getElementById("writeupType").value,
		query: document.getElementById("writeupQuery").value
	}

	parameters.location = {
		lat: document.getElementById("latitudeQuery").value,
		lon: document.getElementById("longitudeQuery").value,
		distance: document.getElementById("distanceQuery").value,
		includeUnknown: document.getElementById("includeUnknownLocation").checked
	}

	//ID search is currently hidden from the user.
	parameters.id = window.IDSearchParameters

	parameters.tags = {
		query: document.getElementById("tagsQuery").value
	}


	parameters.skill = {
		type: "from",
		query: [
			Number(document.getElementById("skillQuery1").value),
			Number(document.getElementById("skillQuery2").value)
		],
		includeUnknown: document.getElementById("includeUnknownSkill").checked
	}

	parameters.normalSearch = document.getElementById("searchbox").value

	parameters.flow = {
		type: "from",
		query: [
			Number(document.getElementById("flowQuery1").value),
			Number(document.getElementById("flowQuery2").value)
		],
		includeDams: document.getElementById("includeDams").checked,
		includeUnknown: document.getElementById("includeUnknownFlow").checked
	}
	
	parameters.rating = {
		type: "from",
		query: [
			Number(document.getElementById("ratingQuery1").value),
			Number(document.getElementById("ratingQuery2").value)
		],
		includeUnknown: document.getElementById("includeUnknownRating").checked
	}
	
	parameters.sort = {
		query: document.getElementById("sortQuery").value,
		reverse: document.getElementById("sortQueryReverse").checked
	}
	
	highlightFailingFields(parameters)

	return parameters
}


window.setMenuFromSearch = function(query) {
	query = recursiveAssign(window.getAdvancedSearchParameters(), query)

	document.getElementById("nameType").value = query.name.type
	document.getElementById("nameQuery").value = query.name.query
	document.getElementById("sectionType").value = query.section.type
	document.getElementById("sectionQuery").value = query.section.query
	document.getElementById("writeupType").value = query.writeup.type
	document.getElementById("writeupQuery").value = query.writeup.query

	document.getElementById("distanceQuery").value = query.location.distance
	document.getElementById("includeUnknownLocation").checked = query.location.includeUnknown
	document.getElementById("latitudeQuery").value = query.location.lat
	document.getElementById("longitudeQuery").value = query.location.lon

	document.getElementById("tagsQuery").value = query.tags.query

	document.getElementById("skillQuery1").value = query.skill.query[0]
	document.getElementById("skillQuery2").value = query.skill.query[1]
	document.getElementById("includeUnknownSkill").checked = query.skill.includeUnknown
	
	document.getElementById("ratingQuery1").value = query.rating.query[0]
	document.getElementById("ratingQuery2").value = query.rating.query[1]
	document.getElementById("includeUnknownRating").checked = query.rating.includeUnknown

	document.getElementById("searchbox").value = query.normalSearch
	document.getElementById("normalSearchBoxOnAdvancedSearch").value = query.normalSearch

	document.getElementById("flowQuery1").value = query.flow.query[0]
	document.getElementById("flowQuery2").value = query.flow.query[1]
	document.getElementById("includeDams").checked = query.flow.includeDams
	document.getElementById("includeUnknownFlow").checked = query.flow.includeUnknown

	document.getElementById("sortQuery").value = query.sort.query
	document.getElementById("sortQueryReverse").checked = query.sort.reverse
	//ID search is currently hidden from the user.
	window.IDSearchParameters = query.id
	
	highlightFailingFields(query)
}


//Previously I just used the initial state of the HTML fields to calculate defaultAdvancedSearchParameters (call getAdvancedSearchParameters at page load) - 
//However Chrome will remember the state of input fields if the hits the back button to go back to the page (sometimes with the app to), causing issues.
//This is probably a feature intended to stop users from losing form inputs if they navigate accidentally - meaning that filing a bug report would be useless.
window.defaultAdvancedSearchParameters = {
  "name": {
    "type": "contains",
    "query": ""
  },
  "section": {
    "type": "contains",
    "query": ""
  },
  "writeup": {
    "type": "contains",
    "query": ""
  },
  "location": {
    "lat": "",
    "lon": "",
    "distance": "",
    "includeUnknown": false
  },
  "tags": {
    "query": ""
  },
  "skill": {
    "type": "from",
    "query": [1, 8],
    "includeUnknown": true
  },
  "rating": {
    "type": "from",
    "query": [1, 5],
    "includeUnknown": true
  },
  "normalSearch": "",
  "flow": {
    "type": "from",
    "query": [0, 4],
    "includeDams": true,
    "includeUnknown": true
  },
  "sort": {
    "query": "none",
    "reverse": false
  }
};

window.setMenuFromSearch(window.defaultAdvancedSearchParameters)

/***/ }),
/* 17 */
/***/ (function(module, exports) {


//Prepare the Advanced Search button
let advanced_search_modal = document.getElementById('advanced-search-modal');

let span = document.getElementById("advanced-search-modal-close").onclick = function() {
    advanced_search_modal.style.display = "none"
}

document.addEventListener("click", function(event) {
    if (event.target === advanced_search_modal) {
        advanced_search_modal.style.display = "none"
    }
})

document.getElementById("advancedsearch").addEventListener("click", function() {
    advanced_search_modal.style.display = "block"
})


//For dynamic searching, we may want to use the keyup event instead of input if there are performance issues when users hold down delete.
//Event listeners for the normal search boxes.

function searchBoxChange(event) {
    let query = window.getAdvancedSearchParameters()
    query.sort.query = "none" //Normal searches apply their own sorting. query.sort will override this.
    query.normalSearch = event.target.value
    setMenuFromSearch(query) //Make sure the user knows that the sort has been canceled.
	NewList(query)
}

document.querySelectorAll("#searchbox, #normalSearchBoxOnAdvancedSearch").forEach((element) => {
    element.addEventListener("input", function searchBoxKeyPress(event) {
		//If the user is backspacing, search only when key lifted up or box empty.
		if (event.inputType === "deleteContentBackward") {
			if (event.target.value === "") {
				window.removeEventListener("keyup", searchBoxChange)
				searchBoxChange(event)
			}
			else {
				window.addEventListener("keyup", searchBoxChange, {once: true})
			}
			return
		}
    	//If the user presses the "Go" button (Actually an Enter/Return), unfocus the searchbox.
    	if (event.keyCode === 13) {
    		event.target.blur()
    	}
    	searchBoxChange(event)
    })
})

//Advanced search event listeners.
let elements = document.querySelectorAll(
    "#advanced-search-modal > .modal-content > input, " +
    "#advanced-search-modal > .modal-content > select, " +
    "#advanced-search-modal > .modal-content > #locationSearchPortion > input"
).forEach((element) => {
    function input() {
		//If the user presses the "Go" key (Actually an Enter/Return), unfocus the searchbox.
		if (event.keyCode === 13) {
			event.target.blur()
		}
		NewList()
	}
    element.addEventListener("input", input)
    element.addEventListener("change", input) //Some browsers don't fire input event in some cases due to bugs
    element.addEventListener("click", input) //Just an extra precaution.
})


async function calculateCoordinates() {

	let status = document.getElementById("locationProgress")
	let num = 0
	let progress = setInterval(function() {
		num = (num+1)%6
		status.innerHTML = "Calculating your Approximate Location (Expect this to take 15-60 seconds)" + ".".repeat(num)
	}, 500)

	let position;
	try {
		position = await new Promise((resolve, reject) => {
			navigator.geolocation.getCurrentPosition(resolve, reject)
		});
	}
	catch(error) {
		let output = "Your device encountered an error when attempting to find your position. " //Message for POSITION_UNAVAILABLE error.
		if (error.PERMISSION_DENIED) {
			//If the error is actually permission denied, check to see if we have location permission.
			let status = await navigator.permissions.query({name:'geolocation'})
			if (status.state === "granted") {
				//If we do have location permission, odds are that the browser did not. Tell that to the user.
				//Browsers used to do this, but it looks like they now give a POSITION_UNAVAILABLE error.
				output = "It appears that your browser could not access your location. Make sure that location services is enabled and allowed for your device and browser."
			}
			else if (status.state === "denied"){
				//If the user denied permission, tell the user that they need to enable it.
				output = "Rivers.run does not have permission access to your location. Please enable location permission in site settings. You will also want to check that location is on for your device and/or browser."
			}
			else if (status.state === "prompt") {
				//If the user dismissed the prompt, tell them that they need to click Allow.
				output = "It appears that you dismissed the permission prompt. To find your location, you need to grant the location permission."
			}
		}
		output += "\n\nError message: " + error.message
		alert(output)
		clearInterval(progress)
		status.innerHTML = output
	}


	let coords = position.coords

	clearInterval(progress)

	document.getElementById("latitudeQuery").value = coords.latitude
	document.getElementById("longitudeQuery").value = coords.longitude
	status.innerHTML = "You are within " + coords.accuracy + " meters of " + coords.latitude + " degrees latitude and " + coords.longitude + " degrees longitude."

	//Alert the user if the potential error is greater than 10 miles..
	if (coords.accuracy > 10*1609.344) {
		alert("Your device stated that GPS readings could be up to " + Math.ceil(coords.accuracy/1609.344) + " miles off target. You may want to make sure the coordinates are working properly.")
	}

	NewList()
}

document.getElementById("calculateCoordinates").addEventListener("click", calculateCoordinates)


elements = document.querySelectorAll(".clearAdvancedSearch")
for (let i=0;i<elements.length;i++) {
	elements[i].addEventListener("click", function() {
		if (confirm("Are you sure that you would like to clear the advanced search query?")) {
			//Reset all but normalSearch
			let query = recursiveAssign({}, window.defaultAdvancedSearchParameters)
			query.normalSearch = getAdvancedSearchParameters().normalSearch
			window.setMenuFromSearch(query)
			NewList()
		}
	})
}


let ipLocation = document.getElementById("ipLocation")
try {
	//IP based Geolocation only appears to be accurate with WIFI.
	//Although most browsers don't support it, try not to use IP based geolocation for mobile users.
	//Note that the IP geolocation service should be able to tell us if the user is mobile.

	let notWifi
	if (window.navigator && navigator.connection && navigator.connection.type) {
		notWifi = (navigator.connection.type !== "wifi")
	}

    if (window.fetch && !notWifi) {
		//TODO: Add XMLHttpRequest fallback.
        fetch("https://rivers.run/node/ip2location").then((response) => {
    		response.json().then((locationInfo) => {

    			ipLocation.innerHTML = "Would you like to use coordinates for " + locationInfo.city + ", " + locationInfo.region + "? (From IP Address) "
    			ipLocation.style.display = "block"

    			function close() {
    				//IP2Location wants attribution.
    				ipLocation.innerHTML = "IP to geolocation data from <a href='https://lite.ip2location.com'>http://lite.ip2location.com</a>"
    				ipLocation.style.opacity = 0
    				ipLocation.style.fontSize = 0
    				setTimeout(function() {
    					ipLocation.remove()
    				}, 3000)
    			}

    			let yes = document.createElement("button")
    			yes.innerHTML = "Yes"
    			yes.addEventListener("click", function() {
    				let query = window.getAdvancedSearchParameters()
    				query.location.lat = locationInfo.latitude
    				query.location.lon = locationInfo.longitude
    				window.setMenuFromSearch(query)
    				close()
    			})
    			ipLocation.appendChild(yes)

    			let no = document.createElement("button")
    			no.innerHTML = "No"
    			no.addEventListener("click", function() {
    				close()
    			})
    			ipLocation.appendChild(no)
    		})
    	})
    }
}
catch (e) {
	console.error(e)
}


/***/ }),
/* 18 */
/***/ (function(module, exports) {

window.timesNewListCalled = 0 //Used to handle advanced search links with flow, and to prevent drawing rivers from an older search.
let previousSearchQuery; //Used to avoid spending CPU to do the same search query again.
window.NewList = function(query = recursiveAssign({}, defaultAdvancedSearchParameters, window.getAdvancedSearchParameters())) {
	//For the advanced search paramters, use the defaults in all non-specified cases. This is ineffecient because we run a search with every parameter, even when that parameter is useless (as the defaults are).

	if (objectsEqual(previousSearchQuery, query)) {
		//The search query is the same as the one that was run before. Ignore it.
		console.log("Killed search");
		return
	}
	previousSearchQuery = query
	timesNewListCalled++

	let orderedlist = ItemHolder.slice(0); //Clone the array
	orderedlist = advancedSearch(orderedlist, query)

	//Clear Current
	ItemHolder.forEach(function(event) {
		event.delete()
	})
	document.querySelectorAll(".gaugesBelow").forEach((elem) => {elem.remove()})

	let useGauges = orderedlist.useGauges
	
	//Append New
	var div = document.getElementById("Rivers")
	//To avoid lagging, append a small amount of rivers at the start, then finish adding rivers in the background.
	let completed = 0
	let callNumber = timesNewListCalled
	
	function drawMore(milliseconds = 8, options = {}) {
		let lastDrawn = options.lastDrawn
		
		//We won't draw more if we have already drawn more than 5 times the windows height below where the user has scrolled to.
		//This will help keep performance reasonable.
		//TODO: Draw only the window height. Wait small amount of time to see if NewList is called again (so typing in searchbox, etc). If not, resume drawing to 5x.
		//If we do this inside the loop, it destroys performance of rendering.
		if (lastDrawn && lastDrawn.offsetTop - window.innerHeight * 5 > window.scrollY) {return {lastDrawn, finished: false, time: 0}}
		
		//Draw rivers to the screen for milliseconds milliseconds.
		let start = Date.now()
		for (;completed<orderedlist.length;completed++) {
			
			if (!orderedlist[completed].id && !options.useGauges) {continue}
			if (orderedlist[completed].id && options.onlyGauges) {continue}

			//If we have exceeded allocated time, or NewList has been called again (so another draw process is in place), stop drawing.
			if (Date.now() - start > milliseconds || callNumber !== timesNewListCalled) {break;}
			let riverbutton = orderedlist[completed].create()
			lastDrawn = riverbutton
			div.appendChild(riverbutton)
		}
		return {
			finished: completed >= orderedlist.length,
			time: Date.now() - start, //Really slow devices may take more than the allocated amount of time to finish
			lastDrawn
		}
	}
	function asyncDraw(options = {}) {
		let oldCompleted = completed
		let drawing = drawMore(8, options)
		if (drawing.finished && !useGauges) {
			useGauges = true; 
			completed = 0;
			drawing.finished = false
			if (orderedlist.gaugeAmount > 0) {
				//Add an element that says gauges are shown below.
				let gaugesBelow = document.createElement("div")
				gaugesBelow.classList.add("riverbutton")
				gaugesBelow.classList.add("gaugesBelow")
				let span = document.createElement("span")
				span.innerHTML = "Gauges Matching your Search are Shown Below"
				gaugesBelow.appendChild(span)
				span.style.width = "100%"
				div.appendChild(gaugesBelow)
			}
		}
		if (callNumber === timesNewListCalled && !drawing.finished) {
			let minTime = 16
			if (completed === oldCompleted) {minTime = 64} //If we didn't draw any rivers (enough already drawn), save some CPU by increasing the amount of time between executions.
			setTimeout(asyncDraw, Math.max(minTime, drawing.time*2), {
				lastDrawn: drawing.lastDrawn, 
				useGauges, 
				onlyGauges: (useGauges !== orderedlist.useGauges)
			})
		}
	}
	asyncDraw({useGauges, onlyGauges: (useGauges !== orderedlist.useGauges)})

	query = deleteMatchingPortions(query, defaultAdvancedSearchParameters) //Filter out parameters where the default is used.

	//Add link to this search to the advanced search menu.
	let link;
	//If the only parameter is normalSearch, create a normal search link.
	if (query.normalSearch && objectsEqual(query, {normalSearch:query.normalSearch})) {
		link = encodeURI(window.root + "#" + query.normalSearch)
	}
	else if (objectsEqual(query, {})) {
		link = window.root //There is no search. Provide the link to this page.
	}
	else {
		link = encodeURI(window.root + "#" + JSON.stringify(query))
		//There are advanced search parameters other than normalSearch. Show the advanced search warning.
	}
	
	document.getElementById("searchlink").innerHTML = "Link to this search: <a target=\"_blank\" href=\"" + link + "\">" + link + "</a>"
	
	try {
		history.replaceState("",document.title, link)
	}
	catch(e) {console.error(e)}

	//If there are parameters other than normalSearch and sort, show the advanced search warning
	if (objectsEqual(query, {normalSearch:query.normalSearch,sort:query.sort})) {
		document.getElementById("advancedSearchWarning").style.display = "none" //No parameters other than sort and normalSearch
	}
	else {
		document.getElementById("advancedSearchWarning").style.display = "block" //Advanced search is in affect!
	}
}


/***/ }),
/* 19 */
/***/ (function(module, exports) {



function drawColors(canvas, height) {

    let context = canvas.getContext("2d")

    //Some browsers flip screen.width and screen.height on rotation - some don't

    //window.innerWidth fails - the window is expanded to handle the width of the legend
    //Then the legend doesn't resize (because the window has resized to it)

    //This seems to be the only simple cross browser solution, although it fails if numerous rotations are made

	let tooLowLightness = window.darkMode? "23%": "67%"
	let tooHighLightness = window.darkMode? "20%": "69%"
	let normalValueLightness = window.darkMode? "25%": "70%"

	canvas.width = document.documentElement.clientWidth
    canvas.height = height

    let gradient = context.createLinearGradient(0,0,canvas.width,0) //Horizontal gradient

    let redColor = "hsl(0,100%," + tooLowLightness + ")"
    let blueColor = "hsl(240,100%," + tooHighLightness + ")"

    gradient.addColorStop(0, redColor)
    gradient.addColorStop(0.08, redColor)

    let start = 0.08
    let end = 0.92

    let range = end-start
    //240 is number of whole number hsl values

    for (let i=0;i<=240;i++) {
        gradient.addColorStop(start + (i/240*range), "hsl(" + i + ",100%," + normalValueLightness + ")")
    }

    gradient.addColorStop(0.92, blueColor)
    gradient.addColorStop(1, blueColor)

    context.fillStyle = gradient
    context.fillRect(0,0,canvas.width,canvas.height)

}


//To makes these stand out slightly better, styles have been changed from the striping applied to the rivers.
//In addition, the canvas does some weird things (why did changing from transparent black to transparent white do anything?),
//and makes some features of linear-gradient tough to use.
function drawStripes(canvas, newColor = window.darkMode ? "rgba(256,256,256,0.4)":"rgba(170,170,170,0.33)", oldColor = window.darkMode? "rgba(255,255,255,0)":"rgba(0,0,0,0)") {
	//Stripe the bottom (has dam) portion of the legend.
    let context = canvas.getContext("2d")

	let angle = 60 / 180 * Math.PI //First number is degrees
    let gradient = context.createLinearGradient(0,0, canvas.width * Math.cos(angle), canvas.width * Math.sin(angle))

	for (let i=0;i<37;i++) {
		gradient.addColorStop(i/36, i%3 ? oldColor:newColor)
	}
	
	console.log(gradient)

    context.fillStyle = gradient
	//Apply stripes to bottom 40% of legend.
    context.fillRect(0,canvas.height*3/5,canvas.width,canvas.height)
}


function drawText(canvas, fontSize) {

    let context = canvas.getContext("2d")
    context.fillStyle = window.darkMode ? "white" : "black"

    //The fourth parameter is the maximum width of the text in pixels
    //We use it here, but it takes an extremely small screen before it comes into affect.

    let maxWidth = canvas.width/5

    let height = fontSize

    context.font = fontSize + "px Arial"

    context.textAlign = "start"
		
    context.fillText("Too Low", 0, height, maxWidth)

    context.textAlign = "center"
	
	//Draw the "Has Dam text at the center on the bottom, in smaller text."
	context.font = fontSize/1.15 + "px Arial"
	context.fillText("Has Dam", canvas.width/2, (canvas.height - height/4))
    context.font = fontSize + "px Arial"

    //Low Flow and High Flow confine the legend, making the range for low-high flow between 8% and 92%. Because of this, lowflow is 29% (8+84*0.25), and highflow is 71%.
    context.fillText("Low Flow", canvas.width*0.29, height, maxWidth)
    context.fillText("Mid Flow", canvas.width/2, height, maxWidth)
    context.fillText("High Flow", canvas.width*0.71, height, maxWidth)

    //Black text on blue is near inivisible - so use white text on blue
    if (!window.darkMode) {context.fillStyle = "white"}

    context.textAlign = "end"
    context.fillText("Too High", canvas.width, height, maxWidth)

}


function makeSticky(canvas) {
    //Make the legend stick to the top of the screen

    //We should use position:sticky here, but there were some issues with it in Safari.
    //canvas.style.position = "-webkit-sticky"
    //canvas.style.position = "sticky"
    //canvas.style.top = 0

	canvas.style.zIndex = 2 //Show up on top of stars.

    window.addEventListener("scroll", function() {
        //We could use canvas.offsetTop, but that doesn't work with absolute positioning, and can't be calculated once,
        //because warnings and alerts above the canvas can change the correct offset.
        //As such, we will use #topbar, and subtract the height of the canvas.
        let elementOffset = document.getElementById("topbar").offsetTop - canvas.height
        let pageOffset = window.pageYOffset

        if (pageOffset > elementOffset) {
            canvas.style.position = "fixed"
            canvas.style.top = 0
            document.body.style.paddingTop = canvas.height + "px" //Avoid sudden jerk in page content
        }
        else {
            canvas.style.position = ""
            canvas.style.top = ""
            document.body.style.paddingTop = 0
        }
    })
}


function updateLegend() {
    try {
    let canvas = document.getElementById("legend")

    canvas.getContext("2d").clearRect(0,0,canvas.width,canvas.height)

    let fontSize = parseFloat(window.getComputedStyle(document.getElementById("Rivers").firstChild).getPropertyValue("font-size"))

    let height;
    //Picked what I thought looked best
    if (fontSize > 18) {
        height = 10 + fontSize*2
    }
    else if (fontSize > 14.8){
        fontSize *= 1.2
        height = 10 + fontSize*2
    }
    else {
        fontSize *= 1.4
        height = 10 + fontSize*2
    }

    //Smart watch mode
    if (window.innerWidth <= 309) {
        fontSize = (window.innerWidth * 0.032 * 1.5)
        height = 10 + fontSize*2
    }

    drawColors(canvas, height)
    drawText(canvas, fontSize)
	drawStripes(canvas)
    makeSticky(canvas)
    }
    catch (e) {
        //Something went badly wrong. Prevent from taking down whole page.
        console.error("Legend failed to draw. Logging error.")
        console.error(e)
    }

}

window.addEventListener("resize", updateLegend)
//orientationchange should be fired on resize, but some browsers (such as Safari) do not
window.addEventListener("orientationchange", updateLegend)
window.addEventListener("colorSchemeChanged", updateLegend)

updateLegend()


/***/ })
/******/ ]);
//# sourceMappingURL=index.js.map