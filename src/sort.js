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


function classSort(list, reverse) {
    //This sort isn't supposed to work very well - it's designed so that people stop complaining
    //The hope is that they will quickly realize why a class based sort doesn't work.

    let classes = ["A", "I", "II", "III", "IV", "V", "VI"]

    //Add -/+
    classes = classes.map((val) => {
        return [
            val + "-",
            val,
            val + "+"
        ]
    }).flat()

    classes = classes.map((val) => {
        return [val, `(${val})`]
    }).flat()

    console.log(classes)

    list.sort(function(a,b) {

       function ToNum(value) {
           for (let i=classes.length-1;i>=0;i--) {
               let classStr = classes[i]
               let index = value.class.lastIndexOf(classStr) //Use lastIndex - the last instance should be the highest (we don't want to match the first V in IV-V - we want the second)

               if (index !== -1) {
                   if (classStr.includes("(")) {
                       //If a value is in parens, it comes below that same value not in parens.
                       return i - 1.5
                   }
                   else if (value.class[index - 1] !== "I") {
                       //V is a subset of IV - verify that we aren't dealing with a subset
                       return i
                   }
               }
           }

            return reverse?-Infinity:Infinity
        }

        return ToNum(a)-ToNum(b)
    })


    if (reverse) {
        list.reverse()
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
		if (item.isGauge) {noData.push(item)} //Don't bother checking river.running if it is a gauge.
        else if (item.running != undefined && !isNaN(item.running)) {knownState.push(item)}
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
    else if (method === "class") {
        list = classSort(list, reverse)
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
