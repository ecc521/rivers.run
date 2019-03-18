    
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

        //Graph
        let data;
        if (self.usgsarray) {
          data = self.usgsarray[river.usgs] 
        }
        
        //The graphing is wrapped in a try-catch statement because USGS often supplies invalid data
        //for a specific river due to gauge problems.
        //Each canvas is wrapped individually because sometimes only some graphs have invalid data
          if (data) {
              div.innerHTML += "<br><br>" //Space the first canvas

              let temp = data["00010"]
              let precip = data["00045"]
              let cfs = data["00060"]
              let height = data["00065"]


              //Auxillary Function
              function toparts(arr) {
                  let values = []
                  let timestamps = []

                  for (let i=0;i<arr.length;i++) {
                      let obj = arr[i]
                      values.push(obj.value)
                      timestamps.push(obj.dateTime)
                  }

                  return {values:values,timestamps:timestamps}
              }

              //Auxillary Function
              function createcanvas() {
                  let canvas = document.createElement("canvas")
                  canvas.width = 1200
                  canvas.height = 800 
                  
                  //Make sure the background is not transparent
                  let ctx = canvas.getContext("2d");
                  if (!window.darkMode) {
                      ctx.fillStyle = "white";
                  }
                  else {
                      //Dark Mode
                      ctx.fillStyle = "black"
                  }
                  ctx.fillRect(0, 0, canvas.width, canvas.height);

                return canvas
              }

              try {
                  if (cfs||height) {
                      let canvas1 = createcanvas()

                      if (cfs && height) {
                          let parts = toparts(cfs.values)
                          addLine("cfs", parts.timestamps, data.name, canvas1, 0, parts.values, "#00AAFFa0", 2)
                          parts = toparts(height.values)
                          addLine("height", parts.timestamps, data.name, canvas1, 0, parts.values, "#2222FFa0", 2, 1)                
                      }
                      else if (cfs) {
                          let parts = toparts(cfs.values)
                          addLine("cfs", parts.timestamps, data.name, canvas1, 0, parts.values, "#00AAFF")
                      }
                      else {
                          let parts = toparts(height.values)
                          addLine("height", parts.timestamps, data.name, canvas1, 0, parts.values, "#2222FF")    
                      }

                      //For some reason, only the last canvas was showing. Use images
                      //Images also allow "Save Image As"
                      let img = document.createElement("img")
                      img.className = "graph"
                      //Blobs may be faster - but I don't know of a synchronus method
                      img.src = canvas1.toDataURL("image/png")

                      div.appendChild(img)
                  }
              }
              catch(e){console.warn("Graphing Error: " + e)}
              
              try {
                 if (temp) {
                      let canvas2 = createcanvas()

                      let parts = toparts(temp.values)
                      addLine("", parts.timestamps, data.name, canvas2, 0, parts.values, "#FF0000", 3, "#0000FF")

                      //For some reason, only the last canvas was showing. Use images
                      //Images also allow "Save Image As"
                      let img = document.createElement("img")
                      img.className = "graph"
                      img.src = canvas2.toDataURL("image/png")
                      div.appendChild(img)
                  }
              }
              catch(e){console.warn("Graphing Error: " + e)}
              
              try {
                  if (precip) {
                      let canvas3 = createcanvas() 

                      let parts = toparts(precip.values)
                      addLine("Precipitation", parts.timestamps, data.name, canvas3, 0, parts.values, "#0066FF")

                      //For some reason, only the last canvas was showing. Use images
                      //Images also allow "Save Image As"
                      let img = document.createElement("img")
                      img.className = "graph"
                      img.src = canvas3.toDataURL("image/png")
                      div.appendChild(img)
                  }
              }
              catch(e){console.warn("Graphing Error: " + e)}
          }
        //End of Graph
            
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
    
