function alphabeticalsort(orderedlist, reverse) {
  
    function compare(a,b) {
    if (a.name < b.name)
        return -1;
    if (a.name > b.name)
        return 1;
    return 0;
    }
  
    orderedlist.sort(compare);
    if (reverse) {
        orderedlist.reverse()
    }
  
    return orderedlist
}

function ratingsort(orderedlist, reverse) {
    function compare(a,b) {
    if (a.rating > b.rating)
        return -1;
    if (a.rating < b.rating)
        return 1;
    return 0;
    }
    orderedlist.sort(compare);
    if (reverse) {
         orderedlist.reverse()
    }
    //Move error values to end
    while (orderedlist[0].rating === "Error") {
        orderedlist.push(orderedlist.shift())
    }  
    return orderedlist
  
}


function skillsort(orderedlist) {
        orderedlist.sort(function(a,b) {
    
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
        orderedlist.reverse()
        while (orderedlist[0].skill === "?") {
            orderedlist.push(orderedlist.shift())
        }
    }
    
    return orderedlist
}



module.exports = {
    ratingsort,
    alphabeticalsort,
    skillsort,
}