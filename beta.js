function GetId(Name) {
  return document.getElementById(Name)
}

function River(name, section, difficulty, quality, length, writeup, usgs, idbase) {
  this.name = name
  this.section = section
  this.difficulty = difficulty
  this.quality = quality
  this.length = length
  this.writeup = writeup
  this.usgs = usgs
  this.base = "b" + idbase
  
  this.display = function () {
    var button = document.createElement("button")
    button.className = this.base + 1
    
    
  }
  this.hide = function () {
    
  }

}
