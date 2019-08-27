let normalSearch = require("./src/search.js").normalSearch
const fs = require("fs")

console.log(normalSearch)

window = {}
eval(fs.readFileSync("riverarray.js", {encoding:"utf8"}))
let riverarray = window.riverarray
delete window

let name = "Lower Haw River"

//Delete the word river (plus the leading space), if it exists in any casing.
name = name.split(/ river/i).join("")

let rivers = normalSearch(riverarray, name)

console.log(rivers)