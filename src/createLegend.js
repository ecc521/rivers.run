

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

    let gradient = context.createLinearGradient(0,0,canvas.width,0) //Horizontal gradient

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


//To makes these stand out slightly better, styles have been changed from the striping applied to the rivers.
//In addition, the canvas does some weird things (why did changing from transparent black to transparent white do anything?),
//and makes some features of linear-gradient tough to use.
function drawStripes(canvas, newColor = window.darkMode ? "rgba(256,256,256,0.4)":"rgba(170,170,170,0.33)", oldColor = window.darkMode? "rgba(255,255,255,0)":"rgba(0,0,0,0)") {
	//Stripe the bottom (has dam) portion of the legend.
    let context = canvas.getContext("2d")

	let angle = 60 / 180 * Math.PI //First number is degrees
    let gradient = context.createLinearGradient(0,0, canvas.width * Math.cos(angle), canvas.width * Math.sin(angle))

	for (let i=0;i<37;i++) {
		gradient.addColorStop(i/36, i%3 ? oldColor:newColor)
	}
	
	console.log(gradient)

    context.fillStyle = gradient
    context.fillRect(0,canvas.height/2,canvas.width,canvas.height)
}


function drawText(canvas, fontSize) {

    let context = canvas.getContext("2d")
    context.fillStyle = window.darkMode ? "white" : "black"

    //The fourth parameter is the maximum width of the text in pixels
    //We use it here, but it takes an extremely small screen before it comes into affect.

    let maxWidth = canvas.width/5

    let height = fontSize

    context.font = fontSize + "px Arial"

    context.textAlign = "start"
		
    context.fillText("Too Low", 0, height, maxWidth)

    context.textAlign = "center"
	
	//Draw the "Has Dam text at the center on the bottom, in smaller text."
	context.font = fontSize/1.15 + "px Arial"
	context.fillText("Has Dam", canvas.width/2, (canvas.height - height/4))
    context.font = fontSize + "px Arial"

    //Low Flow and High Flow confine the legend, making the range for low-high flow between 8% and 92%. Because of this, lowflow is 29% (8+84*0.25), and highflow is 71%.
    context.fillText("Low Flow", canvas.width*0.29, height, maxWidth)
    context.fillText("Mid Flow", canvas.width/2, height, maxWidth)
    context.fillText("High Flow", canvas.width*0.71, height, maxWidth)

    //Black text on blue is near inivisible - so use white text on blue
    if (!window.darkMode) {context.fillStyle = "white"}

    context.textAlign = "end"
    context.fillText("Too High", canvas.width, height, maxWidth)

}


function makeSticky(canvas) {
    //Make the legend stick to the top of the screen

    //We should use position:sticky here, but there were some issues with it in Safari.
    //canvas.style.position = "-webkit-sticky"
    //canvas.style.position = "sticky"
    //canvas.style.top = 0

	canvas.style.zIndex = 2 //Show up on top of stars.

    window.addEventListener("scroll", function() {
        //We could use canvas.offsetTop, but that doesn't work with absolute positioning, and can't be calculated once,
        //because warnings and alerts above the canvas can change the correct offset.
        //As such, we will use #topbar, and subtract the height of the canvas.
        let elementOffset = document.getElementById("topbar").offsetTop - canvas.height
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

    //Smart watch mode
    if (window.innerWidth <= 309) {
        fontSize = (window.innerWidth * 0.032 * 1.5)
        height = 10 + fontSize*2
    }

    drawColors(canvas, height)
    drawText(canvas, fontSize)
	drawStripes(canvas)
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
