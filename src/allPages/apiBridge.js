//Link up the iframe to needed APIs.

//We'll provide localStorage so far.
//Current design is overwrite existing localstorage async.
//Upload changes async.

//We'll wait for localStorage to load on main page. This means direct links into other pages might cause issues,
//where localStorage doesn't match the UI, but everything else should be fine.
window.addEventListener("storage", function() {
	return new Promise((resolve, reject) => {
		let randomKey = Math.random()

		function listener(event) {
			if (event.data.randomKey === randomKey) {
				window.removeEventListener("message", listener)

				if (event.data.throw === true) {
					reject(event.data.message)
				}
				else {
					resolve(event.data.message)
				}
			}
		}

		window.addEventListener("message", listener)

		window.parent.postMessage({
			type: "setStorage",
			args: [JSON.stringify(localStorage)],
			randomKey
		}, "*")
	})
})

async function syncStorage() {
	let res = await new Promise((resolve, reject) => {
		let randomKey = Math.random()

		function listener(event) {
			if (event.data.randomKey === randomKey) {
				window.removeEventListener("message", listener)

				if (event.data.throw === true) {
					reject(event.data.message)
				}
				else {
					resolve(event.data.message)
				}
			}
			else {
				console.log(event.data.randomKey, randomKey)
			}
		}

		window.addEventListener("message", listener)

		window.parent.postMessage({
			type: "getStorage",
			args: [],
			randomKey
		}, "*")
	})

	res = JSON.parse(res)
	for (let prop in res) {
		localStorage.setItem(prop, res[prop])
	}
	window.dispatchEvent(new Event("storage")) //Trigger dark mode to update. 
}

window.syncStoragePromise = syncStorage()
