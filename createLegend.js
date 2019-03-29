	

function drawColors(canvas) {

	let context = canvas.getContext("2d")	
	    
    //Some browsers flip screen.width and screen.height on rotation - some don't
    
    //window.innerWidth fails - the window is expanded to handle the width of the legend
    //Then the legend doesn't resize (because the window has resized to it) 
    
    //This seems to be the only cross browser solution
    canvas.width = document.documentElement.clientWidth
	canvas.height = 40
	
	let gradient = context.createLinearGradient(0,0,canvas.width,canvas.height) //Not sure about parameters  
	
	let redLightness = "50%"
	let redColor = "hsl(0,100%," + redLightness + ",60%)"
		
	
	gradient.addColorStop(0, redColor)
	gradient.addColorStop(0.08, redColor)
	
	let start = 0.08
	let end = 0.92
	
	let range = end-start
	//240 is number of whole number hsl values
		
	for (let i=0;i<=240;i++) {
		gradient.addColorStop(start + (i/240*range), "hsl(" + i + ",100%,50%,30%)")	
	}
	
	gradient.addColorStop(0.92, "hsla(240,100%,50%,60%)")
	gradient.addColorStop(1, "hsla(240,100%,50%,60%)")

	context.fillStyle = gradient
	context.fillRect(0,0,canvas.width,canvas.height)	
	
}



function drawText(canvas) {
		
	let context = canvas.getContext("2d")	
	context.fillStyle = window.darkMode ? "white" : "black"

	//The fourth parameter is the maximum width of the text in pixels
	//rivers.run may want to use it
	
	let height = 14
	
	
	context.font = "14px Arial"
	
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
	
	let elementOffset = canvas.offsetTop
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
	let canvas = document.getElementById("legend")

	canvas.getContext("2d").clearRect(0,0,canvas.width,canvas.height)
	
	canvas.style.backgroundColor = window.getComputedStyle(document.body).getPropertyValue("background-color")
    
	drawColors(canvas)
	drawText(canvas)
	makeSticky(canvas)
    	
}

window.addEventListener("resize", updateLegend)
//orientationchange should be fired on resize, but some browsers (such as Safari) do not
window.addEventListener("orientationchange", updateLegend)

updateLegend()