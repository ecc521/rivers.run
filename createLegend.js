	

function drawColors(canvas) {

	let context = canvas.getContext("2d")	
	
	//These don't really matter. It will be stretched or compressed anyways	
	canvas.width = window.innerWidth
	canvas.height = 75

	let gradient = context.createLinearGradient(0,0,canvas.width,canvas.height) //Not sure about parameters  
	
	let redLightness = window.darkMode ? "35%":"65%"
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
	
	let height = 14
	
	context.font = "14px Arial"
	
	context.textAlign = "start"
	context.fillText("Too Low", 0, height)
	
	context.textAlign = "center"
	context.fillText("Low Flow", canvas.width*0.28, height)
	context.fillText("Mid Flow", canvas.width/2, height)
	context.fillText("High Flow", canvas.width*0.72, height)
	
	context.textAlign = "end"
	context.fillText("Too High", canvas.width, height, canvas.width*0.2)

}





function updateLegend() {
	let canvas = document.getElementById("legend")

	canvas.getContext("2d").clearRect(0,0,canvas.width,canvas.height)
	
	drawColors(canvas)
	drawText(canvas)
}

window.addEventListener("resize", updateLegend)
updateLegend()