import { AppUpdate, AppUpdateAvailability } from '@capawesome/capacitor-app-update';

async function createPopupIfUpdate() {
	let appUpdateInfo = await AppUpdate.getAppUpdateInfo();
	if (appUpdateInfo.updateAvailability !== AppUpdateAvailability.UPDATE_AVAILABLE) {
		return;
	}

	let popup = document.createElement("div")
	popup.innerHTML = `
					<h1>App Update</h1>
					<h2>There is a Rivers.run app update. Downloading it is recommended. You may experience issues if you do not update.</h2>`
	popup.style.left = popup.style.top = popup.style.bottom = popup.style.right = "0"
	popup.style.position = "absolute"
	popup.style.textAlign = "center"
	popup.style.backgroundColor = "white"
	popup.style.color = "black"
	popup.style.padding = "10px"
	popup.style.paddingTop = "30px"

	let beginUpdateButton = document.createElement("button")
	beginUpdateButton.innerHTML = "Update Now"
	beginUpdateButton.style.padding = "20px"
	beginUpdateButton.style.fontSize = "2em"
	beginUpdateButton.addEventListener("click", function() {
		AppUpdate.openAppStore()
	})
	popup.append(beginUpdateButton)

	let closeButton = document.createElement("button")
	closeButton.innerHTML = "Close"
	closeButton.style.padding = "20px"
	closeButton.style.fontSize = "2em"
	closeButton.addEventListener("click", function() {
		popup.remove()
	})

	popup.appendChild(closeButton)
	document.body.appendChild(popup)
}


export {createPopupIfUpdate}