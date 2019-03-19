//Auxillary Function
//Sets the direction that the triangle on a header is facing
function settri(elem, facingUpwards) {
    let upArrow = "⬆"
    let downArrow = "⬇"
    let lastChar = elem.innerHTML.slice(-1)

    //Make sure there is a triangle first.
    if (lastChar === upArrow || lastChar === downArrow) {
        elem.innerHTML = elem.innerHTML.slice(0,-1)
    }
    if (facingUpwards) {
        elem.innerHTML += upArrow
    }
    else {
        elem.innerHTML += downArrow
    }
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
