//Handle universal links into the app.


module.exports = function({iframe, baseUrl}) {
	//Navigate to target.
	function processRedirect(target) {
		iframe.src = ""
		baseUrl = new URL(baseUrl)
		let targetUrl = new URL(target)

		baseUrl.pathname = targetUrl.pathname
		baseUrl.hash = targetUrl.hash

		iframe.src = baseUrl.href
	}

	Capacitor.Plugins.App.addListener('appUrlOpen', (data) => {
		console.log('App opened with URL: ' +  data.url);
		processRedirect(data.url)
	});

	Capacitor.Plugins.App.getLaunchUrl().then((ret) => {
		if (ret && ret.url) {
			console.log('Launch url: ', ret.url);
			processRedirect(ret.url)
		}
	});
}
