function normalSearch(list, query) {
    let l = [[],[],[],[],[]]
    list.forEach(function(event){
        if(event.tags.toLowerCase().indexOf(query) !== -1) {
            if (event.name.toLowerCase().indexOf(query) !== -1) {
                l[0].push(event)
            }
            else {
                l[1].push(event)
            }
        }
        else if (event.name.toLowerCase().indexOf(query) !== -1) {
            l[2].push(event)
        }
        else if (event.section.toLowerCase().indexOf(query) !== -1) {
            l[3].push(event)
        }
        else if (event.writeup.toLowerCase().indexOf(query) !== -1) {
            l[4].push(event)
        }
    })

    list = l[0].concat(l[1],l[2],l[3])

    //Add the less relevant results below
    list = list.concat(l[4])
    
    return list
}


function matchesQuery(parameters) {
    
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


//Query is in form of:
//{
  //  name: {
    //    type: "matches",
    //    query: "potomac"
    //},
    //section: {
    //    type: "contains",
    //    query: "something"
  //  }
//}

//This doesn't work for difficulty and rating - no greater than or equal to.
//That needs to be added
function advancedSearch(list, query) {
    
    console.log(query)

    for (let property in query) {
        let parameters = query[property]        
        
        //Since we may be deleting elements in the list, items will be skipped if we use array.length
        for (let item in list) {
            //Parameters currently contains the query parameters and types.
            //We need to add the content
            parameters.content = list[item][property]
            let passes = matchesQuery(parameters)
            if (!passes) {
                //Remove the item if it fails
                delete list[item]
            }
        }
    }
    
    return list
}






module.exports = {
    normalSearch,
    advancedSearch
}






//Prepare the Advanced Search button
let advanced_search_modal = document.getElementById('advanced-search-modal');

let span = document.getElementById("advanced-search-modal-close").onclick = function() {
	advanced_search_modal.style.display = "none"
}

advanced_search_modal.onclick = function() {
    this.style.display = "none"
}

document.getElementById("advancedsearch").addEventListener("click", function() {
    advanced_search_modal.style.display = "block"
})




