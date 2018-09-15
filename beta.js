function GetId(Name) {
  return document.getElementById(Name)
}

function River(name, section, difficulty, quality, length, writeup, usgs, base) {
  this.name = name
  this.section = section
  this.difficulty = difficulty
  this.quality = quality
  this.length = length
  this.writeup = writeup
  this.usgs = usgs
  this.base = "b" + base
  
  this.display = function () {
    var button = document.createElement("button")
    button.id = this.base + 1
    
    
  }
  this.hide = function () {
    
  }

}
