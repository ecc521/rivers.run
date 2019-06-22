function NewSpan(Text) {
    let span = document.createElement("span")
    span.className = "riverspan"
    span.innerHTML = Text
    return span
}

function addSorting(span, type) {
    span.onclick = function() {
        if (this.value === 1) {
            NewList(type, "sort", true) //Reversed
            this.value = 0
        }
        else {
            NewList(type, "sort")
            this.value = 1
        }
    }
}


function TopBar() {
    this.create = function() {
        let button = document.createElement("button")
        button.id = "topbar"
        button.className = "riverbutton"


        let span = NewSpan("River⇅")
        addSorting(span, "alphabetical")
        span.value = 1 //Starts sorted alphabetically, a-z. The first sort needs to reverse that.
        button.appendChild(span)

        button.appendChild(NewSpan("Section"))

        span = NewSpan("Skill⇅")
        addSorting(span, "skill")
        span.value = 0
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
		
        addSorting(span, "rating")
        span.value = 0 //We want greatest first, not least first, on the first sort
        button.appendChild(span) 

		
		
        span = NewSpan("Flow/Trend⇅")
        addSorting(span, "running")
        span.value = 0 //Show highest flow first, instead of lowest
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
