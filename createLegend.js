	

function drawColors(canvas) {

	let context = canvas.getContext("2d")	
	
	//These don't really matter. It will be stretched or compressed anyways	
	canvas.width = window.innerWidth
	canvas.height = 40
	
	//The 51%'s are actually 30% on the riverbuttons
	//At 30%, it wouldn't show up for some reason.
	
	//66%'s are actually 60% on the riverbuttons
	//Trying to make them show up with above
	
	let gradient = context.createLinearGradient(0,0,canvas.width,canvas.height) //Not sure about parameters  
	
	let redLightness = "50%"
	let redColor = "hsl(0,100%," + redLightness + ",66%)"
		
	
	gradient.addColorStop(0, redColor)
	gradient.addColorStop(0.08, redColor)
	
	let start = 0.08
	let end = 0.92
	
	let range = end-start
	//240 is number of whole number hsl values
		
	for (let i=0;i<=240;i++) {
		gradient.addColorStop(start + (i/240*range), "hsl(" + i + ",100%,50%,51%)")	
	}
	
	gradient.addColorStop(0.92, "hsla(240,100%,50%,66%)")
	gradient.addColorStop(1, "hsla(240,100%,50%,66%)")

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
	
	let yOffest = canvas.offsetTop
	window.addEventListener("scroll", function() {
		if (window.pageYOffset > yOffest) {
			canvas.style.position = "fixed"
			canvas.style.top = 0
		}
		else {
			canvas.style.position = ""
			canvas.style.top = ""			
		}
	})
}



function updateLegend() {
	let canvas = document.getElementById("legend")

	canvas.getContext("2d").clearRect(0,0,canvas.width,canvas.height)
	
	drawColors(canvas)
	drawText(canvas)
	makeSticky(canvas)
	
}

window.addEventListener("resize", updateLegend)
updateLegend()