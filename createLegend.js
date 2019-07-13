

function drawColors(canvas, height) {

    let context = canvas.getContext("2d")

    //Some browsers flip screen.width and screen.height on rotation - some don't

    //window.innerWidth fails - the window is expanded to handle the width of the legend
    //Then the legend doesn't resize (because the window has resized to it)

    //This seems to be the only simple cross browser solution, although it fails if numerous rotations are made

	let tooLowLightness = window.darkMode? "23%": "67%"
	let tooHighLightness = window.darkMode? "20%": "69%"
	let normalValueLightness = window.darkMode? "25%": "70%"

	canvas.width = document.documentElement.clientWidth
    canvas.height = height

    let gradient = context.createLinearGradient(0,0,canvas.width,canvas.height) //Not sure about parameters

    let redColor = "hsl(0,100%," + tooLowLightness + ")"
    let blueColor = "hsl(240,100%," + tooHighLightness + ")"

    gradient.addColorStop(0, redColor)
    gradient.addColorStop(0.08, redColor)

    let start = 0.08
    let end = 0.92

    let range = end-start
    //240 is number of whole number hsl values

    for (let i=0;i<=240;i++) {
        gradient.addColorStop(start + (i/240*range), "hsl(" + i + ",100%," + normalValueLightness + ")")
    }

    gradient.addColorStop(0.92, blueColor)
    gradient.addColorStop(1, blueColor)

    context.fillStyle = gradient
    context.fillRect(0,0,canvas.width,canvas.height)

}



function drawText(canvas, fontSize) {

    let context = canvas.getContext("2d")
    context.fillStyle = window.darkMode ? "white" : "black"

    //The fourth parameter is the maximum width of the text in pixels
    //rivers.run may want to use it

    let height = fontSize

    context.font = fontSize + "px Arial"

    context.textAlign = "start"
    context.fillText("Too Low", 0, height)

    context.textAlign = "center"
    context.fillText("Low Flow", canvas.width*0.28, height)
    context.fillText("Mid Flow", canvas.width/2, height)
    context.fillText("High Flow", canvas.width*0.72, height)


    //Black text on blue is near inivisible - so use white text on blue
    if (!window.darkMode) {context.fillStyle = "white"}

    context.textAlign = "end"
    context.fillText("Too High", canvas.width, height, canvas.width*0.2)

}


function makeSticky(canvas) {
    //Make the legend stick to the top of the screen

    //We should use position:sticky here, but there were some issues with it in Safari.
    //canvas.style.position = "-webkit-sticky"
    //canvas.style.position = "sticky"
    //canvas.style.top = 0

	canvas.style.zIndex = 2 //Show up on top of stars.
	let elementOffset = canvas.offsetTop;
    if (elementOffset === 0) {
        //It looks like the canvas was absolutely positioned at this time.
        //We can approxtimate this number VERY closley using the topbar and canvas height.
        //This is probably better than removing the absolute positioning to calculate, then re-adding.
        elementOffset = document.getElementById("topbar").offsetTop - canvas.height
    }

    window.addEventListener("scroll", function() {
        let pageOffset = window.pageYOffset

        if (pageOffset > elementOffset) {
            canvas.style.position = "fixed"
            canvas.style.top = 0
            document.body.style.paddingTop = canvas.height + "px" //Avoid sudden jerk in page content
        }
        else {
            canvas.style.position = ""
            canvas.style.top = ""
            document.body.style.paddingTop = 0
        }
    })
}


function updateLegend() {
    try {
    let canvas = document.getElementById("legend")

    canvas.getContext("2d").clearRect(0,0,canvas.width,canvas.height)

    let fontSize = parseFloat(window.getComputedStyle(document.getElementById("Rivers").firstChild).getPropertyValue("font-size"))

    let height;
    //Picked what I thought looked best
    if (fontSize > 18) {
        height = 10 + fontSize*2
    }
    else if (fontSize > 14.8){
        fontSize *= 1.2
        height = 10 + fontSize*2
    }
    else {
        fontSize *= 1.4
        height = 10 + fontSize*2
    }

    drawColors(canvas, height)
    drawText(canvas, fontSize)
    makeSticky(canvas)
    }
    catch (e) {
        //Something went badly wrong. Prevent from taking down whole page.
        console.error("Legend failed to draw. Logging error.")
        console.error(e)
    }

}

window.addEventListener("resize", updateLegend)
//orientationchange should be fired on resize, but some browsers (such as Safari) do not
window.addEventListener("orientationchange", updateLegend)
window.addEventListener("colorSchemeChanged", updateLegend)

updateLegend()
