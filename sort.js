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
	
	if (reverse) {
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

            switch (value.skill) {
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
                    break;
                default:
                    value = 9;
            }
            return value
        }       
        return ToNum(a)-ToNum(b)
    })


    if (reverse) {
        list.reverse()
        while (list[0].skill === "?") {
            list.push(list.shift())
        }
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
    
    if (reverse) {
        knownState.reverse()
    }
    
    if (knownState.length === 0) {
        alert("Flow data has not yet loaded.")
        return list
    }
	
    knownState = knownState.concat(hasGaugeAndDam)
    knownState = knownState.concat(hasGauge)
    knownState = knownState.concat(hasDam)
    knownState = knownState.concat(noData)

    return knownState
}





function sort(method, list, reverse) {
    if (method === "alphabetical") {
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