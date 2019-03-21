
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
                div.innerHTML += "<br><br><a href='https://www.americanwhitewater.org/content/River/detail/id/" + river.aw + "'>Click here to view this river on American Whitewater</a>"
            }

            //USGS data may not have loaded yet
            if (self.usgsarray) {
                data = self.usgsarray[river.usgs] 
                addGraphs(div, data)
            }

            div.style.padding = "6px"
            div.id = river.base + 2
            if (!window.darkMode) {
                button.style.backgroundColor = "#e3e3e3"
            }
            else {
                //Dark Mode
                button.style.backgroundColor = "#333333"
            }
            button.parentNode.insertBefore(div, button.nextSibling)
        }
        else {
            river.expanded = 0
            button.style.backgroundColor = ""//Let the button inherit the default color
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

            function AddSpan(text) {
                let span = document.createElement("span")
                span.innerHTML = text
                span.className = "riverspan"
                button.appendChild(span)
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
                AddSpan(this.flow + " " + calculateDirection(this.usgs))
            }
            

            
            button.className = "riverbutton"
            //Add the click handler
            addClickHandler(button, locate)


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

