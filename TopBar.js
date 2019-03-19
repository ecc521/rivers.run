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
          //Make sure there is a triangle first.
          if (elem.innerHTML.slice(-1) === "▲" || elem.innerHTML.slice(-1) === "▼") {
           elem.innerHTML = elem.innerHTML.slice(0,-1)
          }
          if (facing) {
            elem.innerHTML += "▲"
          }
          else {
            elem.innerHTML += "▼"
          }
        }
      
      
        let span = NewSpan("River")
        settri(span, true)

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
        settri(span, true)
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
        settri(span, true)

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
    TopBar
}
