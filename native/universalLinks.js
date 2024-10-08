//Handle universal links into the app.
import { App } from '@capacitor/app';

function enableUniversalLinks({iframe, baseUrl}) {
	//Navigate to target.
	function processRedirect(target) {
		baseUrl = new URL(baseUrl)
		let targetUrl = new URL(target)

		baseUrl.pathname = targetUrl.pathname
		baseUrl.hash = targetUrl.hash

		iframe.onload = function() {
			iframe.src = baseUrl.href
			iframe.onload = null
		}
		iframe.src = ""
	}

	App.addListener('appUrlOpen', (data) => {
		console.log('App opened with URL: ' +  data.url);
		processRedirect(data.url)
	});

	App.getLaunchUrl().then((ret) => {
		if (ret && ret.url) {
			console.log('Launch url: ', ret.url);
			processRedirect(ret.url)
		}
	});
}

export {enableUniversalLinks}