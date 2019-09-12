		let url = "https://rivers.run/node/notifications"			

        async function sendToServer(body) {
            let response = await fetch(url, {
                method: "POST",
                cache: "no-store",
                body:JSON.stringify(body)
            })
			return await response.text()
        }	

		async function getSubscription(key) {
			let result = await sendToServer({
				getSubscriptionFromURL: key
			})
			if (result === "No Subscription") {return null}
			else {return JSON.parse(result)}
		}

		async function deleteEmailSubscription(key) {
			let result = await sendToServer({
				delete: true,
				address: getEmail(),
			})
			if (result === "Deleted Subscription") {return true}
			else {return result}
		}

		async function deleteBrowserSubscription(key) {
			let result = await sendToServer({
				delete: true,
				subscription: await (await navigator.serviceWorker.ready).pushManager.getSubscription()
			})
			if (result === "Deleted Subscription") {return true}
			else {return result}
		}

		async function updateSubscription(subscription) {
			let result = await sendToServer(subscription)
			if (result === "Saved Subscription") {return true}
			else {return result}
		}

		function setDisabledView() {
                document.getElementById("unsubscribe").style.display = "none"
                document.getElementById("subscribe").style.display = "inline-block"
                document.getElementById("notificationsState").style.backgroundColor = window.darkMode?"#555500":"#ffff55"
                currentSelections.style.opacity = 0.5
			}
			
			function setEnabledView() {
                document.getElementById("subscribe").style.display = "none"
                document.getElementById("unsubscribe").style.display = "inline-block"
                document.getElementById("notificationsState").style.backgroundColor = ""
                currentSelections.style.opacity = 1
			}



let currentSelections = document.getElementById("currentSelections")
        //Add the header
        //This was HTML, but a space was added in between the spans, unless the spans had no whitespace between them.
        currentSelections.innerHTML += '<div class="row"></div>'
        currentSelections.firstChild.innerHTML += '<span class="gaugeColumn">Gauge</span>'
        currentSelections.firstChild.innerHTML += '<span class="nameColumn">Name</span>'
        currentSelections.firstChild.innerHTML += '<span class="rangeColumn">Range</span>'
        currentSelections.firstChild.innerHTML += '<span class="deleteButton">Delete</span>'        
		
		
		async function redrawRows() {
            //Clear the current list.
            let rows = currentSelections.children
            //The first child element is the header. Don't delete the firstChild, but the nextSibling.
            while (currentSelections.firstChild.nextSibling) {
                currentSelections.firstChild.nextSibling.remove()
            }
			
			if (!(subscription && subscription.parameters)) {return;} //No current subscription. Consider adding an element to say that.

			let selections = subscription.parameters
			
            for (let gauge in selections) {
                for (let id in selections[gauge]) {

					let row = document.createElement("div")
                    row.className = "row"

                    let gaugeColumn = document.createElement("span")
                    gaugeColumn.className = "gaugeColumn"
                    gaugeColumn.innerHTML = gauge
                    row.appendChild(gaugeColumn)

                    let nameColumn = document.createElement("span")
                    nameColumn.className = "nameColumn"
                    nameColumn.innerHTML = selections[gauge][id].name
                    row.appendChild(nameColumn)

                    let minColumn = document.createElement("span")
                    minColumn.className = "rangeColumn"
                    minColumn.innerHTML = selections[gauge][id].minimum + "-" + selections[gauge][id].maximum + selections[gauge][id].units
                    row.appendChild(minColumn)

                    let deleteButton = document.createElement("span")
                    deleteButton.className = "deleteButton"
                    deleteButton.innerHTML = "✖"
                    row.appendChild(deleteButton)

                    deleteButton.addEventListener("click", function() {
                        if (confirm("Remove " + selections[gauge][id].name + " at gauge " + gauge + "?")) {
                            delete selections[gauge][id]
                            //Trim out the gauge object if it is empty.
                            if (Object.keys(selections[gauge]).length === 0) {
                                delete selections[gauge]
                            }
                            localStorage.setItem("flownotifications", JSON.stringify(selections))
                            redrawRows()
                        }
                    })

                    currentSelections.appendChild(row)

                    let panel = document.createElement("div")
                    panel.innerHTML = "id: " + id

                    row.addEventListener("click", function() {
                        let currentlyExists = (panel.offsetHeight > 0)
                        panel.remove() //Doesn't do anything if panel doesn't exist.
                        if (!currentlyExists) {
                            currentSelections.insertBefore(panel, row.nextSibling)
                        }
                    });
                }
            }
        }