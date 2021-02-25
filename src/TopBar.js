function NewSpan(Text) {
    let span = document.createElement("span")
    span.className = "riverspan"
    span.innerHTML = Text
    return span
}

function addSorting(span, type, reverse = false) {
    span.addEventListener("click", function() {
        let query = window.getAdvancedSearchParameters()
        if (query.sort.query === type) {
            query.sort.reverse = !query.sort.reverse
            reverse = query.sort.reverse
        }
        else {
            query.sort.query = type
            query.sort.reverse = reverse
            reverse = !reverse
        }
        window.setMenuFromSearch(query)
        NewList()
    })
}


function TopBar() {
    this.create = function() {
        let button = document.createElement("button")
        button.id = "topbar"
        button.className = "riverbutton"

        if (!!window.MSInputMethodContext && !!document.documentMode) {
            //IE 11 will not dispatch click events to the Name, Skill, Rating, etc, spans, but rather to their parent.
            //Time to do an evil workaround...
            button.onclick = function(e) {
                var x = e.clientX, y = e.clientY,
                    elementMouseIsOver = document.elementFromPoint(x, y);

                elementMouseIsOver.click()
            }
        }

        let span = NewSpan("River⇅")
        addSorting(span, "alphabetical", true) //Starts sorted alphabetically, a-z. Pass 1 so the first sort reverses that.
        button.appendChild(span)

        button.appendChild(NewSpan("Section"))

        span = NewSpan("Skill⇅")
        span.classList.add("skillspan")
        addSorting(span, "skill", false)
        button.appendChild(span)

        span = NewSpan("Class")
        span.classList.add("classspan")
        button.appendChild(span)

	    span = NewSpan("Quality⇅")
        addSorting(span, "rating", false) //We want greatest first, not least first, on the first sort. Pass 0 to not reverse
        button.appendChild(span)

        span = NewSpan("Flow/Trend⇅")
        addSorting(span, "running", false) //Show highest flow first, instead of lowest. Pass 0 to not reverse.
        button.appendChild(span)

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
