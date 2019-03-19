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

function advancedSearch(list) {
    //Passthrough function
    return list
}



module.exports = {
    normalSearch,
    advancedSearch
}