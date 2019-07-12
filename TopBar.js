function NewSpan(Text) {
    let span = document.createElement("span")
    span.className = "riverspan"
    span.innerHTML = Text
    return span
}

function addSorting(span, type, reverse = 0) {
    span.addEventListener("click", function() {
        console.log("sorting")
        if (reverse === 1) {
            NewList(type, "sort", true) //Reversed
            reverse = 0
        }
        else {
            NewList(type, "sort")
            reverse = 1
        }
    })
    console.log("Added " + type)
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
        addSorting(span, "alphabetical", 1) //Starts sorted alphabetically, a-z. Pass 1 so the first sort reverses that.
        button.appendChild(span)

        button.appendChild(NewSpan("Section"))

        span = NewSpan("Skill⇅")
        addSorting(span, "skill", 0)
        button.appendChild(span)


		//The rating span needs to be the same size as the stars.
		span = NewSpan("")
		//Create an invisible star span. This will make the spans width the same as the ratings.
        let empty = document.createElement("span")
		empty.className = "emptyStars"
		empty.innerHTML = "☆☆☆☆☆"
		empty.style.opacity = "0" //Invisible

		//Create the text span.
		let realContent = document.createElement("span")
		realContent.innerHTML = "Rating⇅"
		//Make sure that the span is positioned correctly.
		realContent.style.position = "absolute"
		realContent.style.left = 0
		realContent.style.bottom = 0

		span.appendChild(empty)
		span.appendChild(realContent)

        addSorting(span, "rating", 0) //We want greatest first, not least first, on the first sort. Pass 0 to not reverse
        button.appendChild(span)

        span = NewSpan("Flow/Trend⇅")
        addSorting(span, "running", 0) //Show highest flow first, instead of lowest. Pass 0 to not reverse.
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
