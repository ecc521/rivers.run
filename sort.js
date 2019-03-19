function simpleSort(list, propertyName) {
    list.sort(function(a,b) {
        if (a[propertyName] > b[propertyName]) {
            return -1;
        }
        if (a[propertyName] < [propertyName]) {
            return 1;
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
    list = simpleSort(list, "rating")

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