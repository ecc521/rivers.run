//Auxillary Function        
//True means pointing up, false means pointing down
function triangle(facing) {
  //Most values in this function are arbitrary
  let scale = window.innerWidth/750
  scale = scale ** 0.5 //Square Root to make difference smaller
  
  let div = document.createElement("div")
  div.style.width = 0;
  div.style.height = 0;
  div.style.display = "inline-block";
  div.style.borderLeft = 4*scale + "px solid transparent"
  div.style.borderRight = 4*scale + "px solid transparent"
  div.style.marginLeft = 1.5*scale + "px"
  //If triangle is pointing up
  if (facing) {
    div.style.borderBottom = 8*scale + "px solid black"
  }
  else {
    div.style.borderTop = 8*scale + "px solid black"
  }
  return div;
}

function TopBar() {
    this.create = function() {
        let button = document.createElement("button")
        button.id = "topbar"
        button.className = "riverbutton"
      
        //Auxillary Function
        function NewSpan(Text) {
          let span = document.createElement("span")
          span.className = "riverspan"
          span.innerHTML = Text
          return span
        }
        
        //Auxillary Function
        //Elem is the span element. If facing is true, set triangle to up, else down
        function settri(elem, facing) {
          elem.lastChild.remove()
          elem.appendChild(triangle(facing))
        }
      
      
        let span = NewSpan("River")
        span.appendChild(triangle(true))

        span.onclick = function() {
          if (this.value) {
            settri(this, false)
            NewList("alphabetical", "sort", true)
            this.value = 0
          }
          else {
            settri(this, true)
            NewList("alphabetical", "sort")
            this.value = 1
          }
        }
        span.value = 1//Starts sorted alphabetically, a-z. The first sort needs to flip that.
        button.appendChild(span)
        
        
        button.appendChild(NewSpan("Section"))

        
        span = NewSpan("Skill")
        span.appendChild(triangle(true))
        span.onclick = function() {
            if (this.value === 1) {
                NewList("skill", "sort", true)
                settri(this, false)
                this.value = 0
            }
            else {
                NewList("skill", "sort")
                settri(this, true)
                this.value = 1
            }
        }
        span.value = 0
        button.appendChild(span) 
        
        span = NewSpan("Rating")
        span.appendChild(triangle(true))

        span.onclick = function() {
                if (this.value === 1) {
                    NewList("rating", "sort", true)
                    settri(this, true)
                    this.value = 0
                }
                else {
                    NewList("rating", "sort")
                    settri(this, false)
                    this.value = 1
                }
        }
        span.value = 0
        button.appendChild(span) 
        
        button.appendChild(NewSpan("Flow Info"))

        return button
    }
    
    this.delete = function() {
        let Node = GetId("topbar")
        if (Node) {
            Node.parentNode.removeChild(Node)
        }
    }
}


module.exports = {
    triangle,
    TopBar
}