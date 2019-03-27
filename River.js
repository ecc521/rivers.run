
let addGraphs = require("./addGraphs.js").addGraphs



function addClickHandler(button, locate) {
    //Code that runs when the button is clicked
    button.onclick = function () {
        let river = ItemHolder[locate]
        if (river.expanded === 0) {
            river.expanded = 1
            var div = document.createElement("div")
            div.innerHTML = river.writeup + "<br>"

            if (river.plat && river.plon) {
                div.innerHTML += "<br>Put-In GPS Coordinates: " + river.plat + ", " + river.plon
            }

            if (river.tlat && river.tlon) {
                div.innerHTML += "<br>Take-Out GPS Coordinates: " + river.tlat + ", " + river.tlon
            }

            if (river.aw) {
				//Adding to div.innerHTML works, but logs CSP errors
				div.appendChild(document.createElement("br"))
				div.appendChild(document.createElement("br"))
				let link = document.createElement("a")
				link.href = "https://www.americanwhitewater.org/content/River/detail/id/" + river.aw
				link.innerHTML = "Click here to view this river on American Whitewater"
				div.appendChild(link)
            }

            //USGS data may not have loaded yet
            if (self.usgsarray) {
                data = self.usgsarray[river.usgs] 
                addGraphs(div, data)
            }

            div.style.padding = "6px"
            div.id = river.base + 2
            button.parentNode.insertBefore(div, button.nextSibling)
        }
        else {
            river.expanded = 0
            var elem = document.getElementById(river.base + 2)
            if (elem) {
                elem.parentNode.removeChild(elem)
            }

        }        
    }    
}




function calculateDirection(usgsNumber) {
	let usgsData = usgsarray[usgsNumber]
	if (usgsData) {
		let data;
		
		if (usgsData["00060"]) {data = usgsData["00060"].values}
		else if (usgsData["00065"]) {data = usgsData["00065"].values}
		
		if (data) {
			let current;
			let previous;
			
			//We will go back 4 datapoints (1 hour) if possible. 
			//Do this because USGS sometimes does 1 hour intervals instead of 15 minutes
			let stop = Math.max(data.length-5, 0)
			for (let i=data.length;i>stop;i--) {
				let item = data[i]
				if (!item) {continue}
				let value = item.value
				if (!current) {
					current = value
				}
				else {
					previous = value
				}
			}
			
			if (current > previous) {
				//Water level rising
				return "⬆"
			}
			else if (previous > current) {
				//Water level falling
				return "⬇"
			}
			else if (current === previous) {
				//Water level stable
				return "-"
			}
			
		}
	}
	return; //If we got here, there is not enough USGS data. 
}




function calculateColor(river, options) {
	//hsla color values
	//hsl(hue, saturation, lightness, opacity)
	//Saturation hue is 0 red 120 green 240 blue
	//Saturation - use 100%
	//Lightness - use 50%
	//Opacity - Percentage
	

	let values = ["minrun", "lowflow", "midflow", "highflow", "maxrun"]
	
	let type; //Currently, we skip a value if one datapoint is cfs and another feet
	
	for (let i=0;i<values.length;i++) {
		
		let str = river[values[i]]
		if (!str) {
			values[i] = undefined
			continue;
		}
		
		let value = parseFloat(str)
		let currentType = str.match(/[^0-9]+/)
		
		if (currentType) {
			currentType = currentType[0].trim() //Match a string of non-digits
		}
		
		if (!type && currentType) {
			type = currentType
		}
		else if (type === currentType) {}
		else {
			values[i] = undefined
			continue;
		}
		
		values[i] = value
	}
	
	let flow;
	if (type === "cfs") {
		flow = river.cfs
	}
	else if (type === "feet") {
		flow = river.feet
	}
	
	let lightness = (options && options.lightness) || "50%"
	
	//TODO: It is difficult to tell when the minimum has not bee reached or the maximum has been exceeded. Make that easy
	if (flow < values[0]) {
		return "hsl(0,100%," + lightness + ",100%)"
	}
	else if (flow > values[4]) {
		return "hsl(240,100%," + lightness + ",50%,60%)"
	}
	else {
		//If we don't have some values, fill them in using logarithms
		//TODO: Do some analyzsis and figure out the best way to do these calculations
		
		let minrun = values[0]
		let maxrun = values[4]
		let midflow = values[2] || 10**((Math.log10(minrun) + Math.log10(maxrun))/2)
		let lowflow = values[1] || 10**((Math.log10(minrun) + Math.log10(midflow))/2)
		let highflow = values[3] || 10**((Math.log10(midflow) + Math.log10(maxrun))/2)
		
				
		function calculateRatio(low, high, current) {
			low = Math.log(low)
			high = Math.log(high)
			
			current = Math.log(current)
			
			
			let range = high-low
			let value = current-low
			
			return value/range
			
		}
		
		
		if (flow < lowflow) {
			return "hsl(" + (0 + 60*calculateRatio(minrun, lowflow, flow)) + ",100%," + lightness + ",30%"
		}
		else if (flow < midflow) {
			return "hsl(" + (60 + 60*calculateRatio(lowflow, midflow, flow)) + ",100%," + lightness + ",30%"
		}
		else if (flow < highflow) {
			return "hsl(" + (120 + 60*calculateRatio(midflow, highflow, flow)) + ",100%," + lightness + ",30%"
		}
		else {
			return "hsl(" + (180 + 60*calculateRatio(highflow, maxrun, flow)) + ",100%," + lightness + ",30%"
		}
	}
}







module.exports.River = function(locate, event) {
	
	//Copies name, section, skill, rating, writeup, tags, usgs, plat,plon, tlat,tlon, aw
	Object.assign(this, event)
	//tags needs to be a string. It can't be undefined
    this.tags = this.tags || ""
	//Convert the numeric value to the filename
    switch (Number(this.rating)) {
        case 1:
            this.rating = "1Star";
            break;
        case 2:
        case 3:
        case 4:
        case 5:
            this.rating = event.rating + "Stars";
            break;
        default:
            this.rating = "Error"
    }
    if (!this.rating) {
        this.rating = "Error"
    }


    this.base = "b" + locate
    this.expanded = 0
    this.index = locate


    this.create = function (forceregenerate) {
        //Only create the button once - It's about 3 times faster.
        if (!this.finished || forceregenerate) {
			
            var button = document.createElement("button")
            button.id = this.base + 1

			button.normalColor = window.darkMode ? "" : "" //Inherit from CSS
			button.focusedColor = window.darkMode ? "#333333" : "#e3e3e3"
			
            function AddSpan(text) {
                let span = document.createElement("span")
                span.innerHTML = text
                span.className = "riverspan"
                button.appendChild(span)
				return span
            }

            AddSpan(this.name)
            AddSpan(this.section)
            AddSpan(this.skill)

            //Star images for rating
            if (this.rating === "Error") {
                AddSpan("???") 
            }
            else {
                let img = document.createElement("img")
                img.src = "resources/" + this.rating + ".png"
                img.alt = this.rating[0] + " Stars"
                img.className = "starimg"
                let span = document.createElement("span")
                span.appendChild(img)
                span.className = "riverspan"
                button.appendChild(span)
            }

            if (this.flow) {
                let flowSpan = AddSpan(this.flow + " " + calculateDirection(this.usgs))
				if (this.minrun && this.maxrun) {
					button.normalColor = calculateColor(this)
					button.focusedColor = window.darkMode ?  calculateColor(this, {lightness:"75%"}) : calculateColor(this, {lightness:"35%"})
					button.style.backgroundColor = button.normalColor
				}
            }
            

            
            button.className = "riverbutton"
            //Add the click handler
            addClickHandler(button, locate)

			
			button.addEventListener("mouseover", function(){this.style.backgroundColor = this.focusedColor})
			button.addEventListener("mouseout", function(){this.style.backgroundColor = this.normalColor})
			

            //Make content available to Googlebot for indexing
            if (navigator.userAgent.toLowerCase().indexOf("google") !== -1) {
                try {
                    setTimeout(function(){button.dispatchEvent(new Event("click"))}, 100)
                }
                catch(e) {}
            }
            //The code directly above this is used to allow Googlebot to index content. 
            //Shall it result in an SEO hit, or shall Googlebot be improved to handle content inside of JavaScript,
            //It can safely be removed.    


            //Store button for reuse later   
            this.finished = button

        }    

        //Return finished button
        return this.finished

    }


    this.delete = function () {
        let river = ItemHolder[locate]
        function Remove(Code) {
            let ToDelete = document.getElementById(river.base + Code)
            if (ToDelete) {
                ToDelete.parentNode.removeChild(ToDelete)
            }
        }

        //Reset background color
        let reset = document.getElementById(river.base + 1)
        if (reset) {
            reset.style.backgroundColor = ""
        }

        Remove(2)
        Remove(1)   

    } 
}

