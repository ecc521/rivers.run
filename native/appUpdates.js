//TODO: Dark mode for the update alerts.

module.exports = function() {
	if (Capacitor?.getPlatform() === "ios") {
	    try {
	        ;((async function() {
	            //Alert for App Updates.

	            //iTunes is settings CORS headers, but those headers don't change when the CDN resends the content -
	            //if the CDN serves us, the CORS headers are for whatever origin last issued the request.

	            //Fail on Apple's part there. Time to start cache busting. Leave a nice note in case this leaves some weird stuff in logs.
	            //Apple takes up to a day to stop caching anyways, so this is probably a good thing from that perspective.

	            let req = await fetch("https://itunes.apple.com/lookup?bundleId=run.rivers.twa&YourCDNDoesNotChangeCORSHeadersSoMustCacheBust" + Math.random())
	            let res = await req.json()
	            let latestVersion = res.results[0].version

	            let deviceInfo = await window.Capacitor.Plugins.Device.getInfo()
	            let currentVersion = deviceInfo.appVersion

	            //Using numeric comparison, so version codes can't have more than one decimal.
	            if (parseFloat(currentVersion) < parseFloat(latestVersion)) {
					let popup = document.createElement("div")
					popup.innerHTML = `
					<h2>App Update</h2>
					<h3>There is a Rivers.run <a href='https://apps.apple.com/us/app/rivers-run/id1552809249' target='_blank'>app update</a>. Downloading it is recommended. You may experience issues if you do not update.</h3>`
					popup.style.left = popup.style.top = popup.style.bottom = popup.style.right = "0"
					popup.style.position = "absolute"
					popup.style.textAlign = "center"
					popup.style.backgroundColor = "white"
					popup.style.color = "black"
					popup.style.padding = "10px"
					popup.style.paddingTop = "30px"
					let closeButton = document.createElement("button")
					closeButton.innerHTML = "Close"
					closeButton.style.padding = "20px"
					closeButton.addEventListener("click", function() {
						popup.remove()
					})

					popup.appendChild(closeButton)
					document.body.appendChild(popup)
	            }
	        })())
	    }
	    catch (e) {console.error(e)}
	}
}
