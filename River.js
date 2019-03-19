    
let addGraphs = require("./addGraphs.js").addGraphs


module.exports.River = function(locate, event) {
  this.name = event.name
  this.section = event.section
  this.skill = event.skill
    
  switch (Number(event.rating)) {
    case 1:
        this.rating = "1Star";
        break;
    case 2:
    case 3:
    case 4:
    case 5:
        this.rating = event.rating + "Stars";
        break;
    default:
        this.rating = "Error"
  }
  if (!this.rating) {
      this.rating = "Error"
  }

  this.writeup = event.writeup
  this.tags = event.tags || ""
  this.usgs = event.usgs
  this.plat = event.plat
  this.plon = event.plon
  this.tlat = event.tlat
  this.tlon = event.tlon
  this.aw = event.aw
  this.base = "b" + locate
  this.expanded = 0
  this.index = locate
    
    
  this.create = function (forceregenerate) {
    //Only create the button once - It's about 3 times faster.
    if (!this.finished || forceregenerate) {
    var button = document.createElement("button")
    button.id = this.base + 1
      
    function AddSpan(text) {
    let span = document.createElement("span")
    span.innerHTML = text
    span.className = "riverspan"
    button.appendChild(span)
    }
            
    AddSpan(this.name)
    AddSpan(this.section)
    AddSpan(this.skill)
      
    //Star images for rating
    if (this.rating === "Error") {
        AddSpan("???") 
    }
    else {
    let img = document.createElement("img")
    img.src = "resources/" + this.rating + ".png"
    img.alt = this.rating[0] + " Stars"
    img.className = "starimg"
    let span = document.createElement("span")
    span.appendChild(img)
    span.className = "riverspan"
    button.appendChild(span)
    }
      
      
      
    if (this.flow) {
      AddSpan(this.flow)
    }
    button.className = "riverbutton"
      
    
    button.onclick = function () {
        let river = ItemHolder[locate]
        if (river.expanded === 0) {
        river.expanded = 1
        var div = document.createElement("div")
        div.innerHTML = river.writeup + "<br>"
                  
        if (river.plat && river.plon) {
            div.innerHTML += "<br>Put-In GPS Coordinates: " + river.plat + ", " + river.plon
        }
        
        if (river.tlat && river.tlon) {
            div.innerHTML += "<br>Take-Out GPS Coordinates: " + river.tlat + ", " + river.tlon
        }
            
        if (river.aw) {
            div.innerHTML += "<br><br><a href='https://www.americanwhitewater.org/content/River/detail/id/" + river.aw + "'>Click here to view this river on American Whitewater</a>"
        }

		//USGS data may not have loaded yet
        if (self.usgsarray) {
          	data = self.usgsarray[river.usgs] 
			addGraphs(div, data)
        }
            
        div.style.padding = "6px"
        div.id = river.base + 2
        if (!window.darkMode) {
            button.style.backgroundColor = "#e3e3e3"
        }
        else {
            //Dark Mode
            button.style.backgroundColor = "#333333"
        }
        button.parentNode.insertBefore(div, button.nextSibling)
        }
        else {
        river.expanded = 0
        button.style.backgroundColor = ""
        var elem = GetId(river.base + 2)
        if (elem) {
        elem.parentNode.removeChild(elem)
        }
            
        }        
    }
        
    
    
    //Make content available to Googlebot for indexing
    if (navigator.userAgent.toLowerCase().indexOf("google") !== -1) {
        try {
            setTimeout(function(){button.dispatchEvent(new Event("click"))}, 100)
        }
        catch(e) {}
    }
    //The code directly above this is used to allow Googlebot to index content. 
    //Shall it result in an SEO hit, or shall Googlebot be improved to handle content inside of JavaScript,
    //It can safely be removed.    
    
    
    //Store button for reuse later   
    this.finished = button
        
    }    
    
    //Return finished button
    return this.finished
      
  }
  this.delete = function () {
    let river = ItemHolder[locate]
    function Remove(Code) {
        let ToDelete = GetId(river.base + Code)
        if (ToDelete) {
            ToDelete.parentNode.removeChild(ToDelete)
        }
    }
      
    //Reset background color
    let reset = GetId(river.base + 1)
    if (reset) {
        reset.style.backgroundColor = ""
    }
      
    Remove(2)
    Remove(1)   
      
  } 
}
    
