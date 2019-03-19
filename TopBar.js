

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

        let span = NewSpan("River⇅")

        span.onclick = function() {
            if (this.value) {
                NewList("alphabetical", "sort", true)
                this.value = 0
            }
            else {
                NewList("alphabetical", "sort")
                this.value = 1
            }
        }
        span.value = 1//Starts sorted alphabetically, a-z. The first sort needs to flip that.
        button.appendChild(span)


        button.appendChild(NewSpan("Section"))


        span = NewSpan("Skill⇅")
        span.onclick = function() {
            if (this.value === 1) {
                NewList("skill", "sort", true)
                this.value = 0
            }
            else {
                NewList("skill", "sort")
                this.value = 1
            }
        }
        span.value = 0
        button.appendChild(span) 

        span = NewSpan("Rating⇅")

        span.onclick = function() {
            if (this.value === 1) {
                NewList("rating", "sort", true)
                this.value = 0
            }
            else {
                NewList("rating", "sort")
                this.value = 1
            }
        }
        span.value = 0
        button.appendChild(span) 

        button.appendChild(NewSpan("Flow Info"))

        return button
    }

    this.delete = function() {
        let Node = document.getElementById("topbar")
        if (Node) {
            Node.parentNode.removeChild(Node)
        }
    }
}


module.exports = {
    TopBar
}
