try {
	//IE 11 Event and CustomEvent polyfill.
	(function () {
	  if (
	      typeof window.CustomEvent === "function" ||
	      // In Safari, typeof CustomEvent == 'object' but it otherwise works fine
	      window.CustomEvent.toString().indexOf('CustomEventConstructor')>-1
	  ) { return; }

	  function CustomEvent ( event, params ) {
	    params = params || { bubbles: false, cancelable: false, detail: undefined };
	    var evt = document.createEvent( 'CustomEvent' );
	    evt.initCustomEvent( event, params.bubbles, params.cancelable, params.detail );
	    return evt;
	   }

	  CustomEvent.prototype = window.Event.prototype;

	  window.CustomEvent = CustomEvent;
	  window.Event = CustomEvent
	})();
}
catch(e) {console.error(e)}

try {
	//IE doesn't define console unless devtools is open.
	if(!window.console) {window.console={}}

	['assert', 'clear', 'count', 'debug', 'dir', 'dirxml', 'error', 'exception', 'group', 'groupCollapsed', 'groupEnd', 'info', 'log', 'markTimeline', 'profile', 'profileEnd', 'table', 'time',
	'timeEnd', 'timeline', 'timelineEnd', 'timeStamp', 'trace', 'warn'].forEach((method) => {
		if (!window.console[method]) {
			//When the console is opened, all of the old messages should be dumped within 5 seconds.
			window.console[method] = function(...data) {
				let interval = setInterval(function() {
					if(window.console[method].toString().indexOf('[native code]') > -1 || window.console[method].toString().indexOf("__BROWSERTOOLS_CONSOLE_SAFEFUNC") > -1) {
						console.log(...data)
						window.console[method](...data)
						clearInterval(interval)
					}
				}, 5000)
			}
		}
	})
}
catch(e) {console.error(e)}

try {
	//IE11 Polyfill. The gaurd appears to be unneeded.
	if (!NodeList.prototype.forEach) {
		NodeList.prototype.forEach = Array.prototype.forEach;
	}
}
catch(e) {console.error(e)}

try {
	//IE 11 elem.remove() polyfill
	if (!('remove' in Element.prototype)) {
	    Element.prototype.remove = function() {
	        if (this.parentNode) {
	            this.parentNode.removeChild(this);
	        }
	    };
	}
}
catch(e) {
	console.error(e)
}