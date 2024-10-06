//Link up the iframe to needed APIs.
function callNativeCommand(commandType, ...args) {
	return new Promise((resolve, reject) => {
		let randomKey = Math.random() //Identifier so we can determine which response is for this request.

		function listener(event) {
			if (event.data.randomKey === randomKey) {
				window.removeEventListener("message", listener)

				if (event.data.throw === true) {
					//The response is an error object that should be thrown.
					reject(event.data.message)
				}
				else {
					resolve(event.data.message)
				}
			}
		}

		window.addEventListener("message", listener)

		window.parent.postMessage({
			type: commandType,
			args: args,
			randomKey
		}, "*")
	})
}


//Current design is overwrite existing localstorage async.
//Upload changes async.

//We'll wait for localStorage to load on main page. This means direct links into other pages might cause issues,
//where localStorage doesn't match the UI, but everything else should be fine.

function syncToNative() {
	return callNativeCommand("setStorage", [JSON.stringify(localStorage)])
}
window.addEventListener("storage", syncToNative)

//Storage event doesn't fire for the current page.
let _setItem = localStorage.setItem
localStorage.setItem = function(...args) {
	_setItem.call(localStorage, ...args)
	syncToNative()
}

async function syncStorage() {
	let res = await callNativeCommand("getStorage")

	res = JSON.parse(res)
	for (let prop in res) {
		localStorage.setItem(prop, res[prop])
	}
	localStorage.setItem("hasSynced", "true")
	window.dispatchEvent(new Event("storage")) //Trigger dark mode to update.
}

//We only want to sync once every time localStorage is cleared.
if (!localStorage.getItem("hasSynced")) {
	window.syncStoragePromise = syncStorage()
}
else {
	syncToNative() //Storage event isn't fired when the tab changes. So if we've already synced, sync now.
}


window.nativeLocationRequest = function nativeLocationRequest() {
	return callNativeCommand("getCurrentPosition")
}