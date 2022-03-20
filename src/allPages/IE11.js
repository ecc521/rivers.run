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
	//Polyfill window.scrollY
	(window.scrollY !== undefined) || Object.defineProperty(window, "scrollY", {get: function() {return window.pageYOffset}})
}
catch(e) {
	console.error(e)
}


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

try {
	//IE 11 elem.replaceWith() polyfill
	function ReplaceWithPolyfill() {
	  'use-strict'; // For safari, and IE > 10
	  var parent = this.parentNode, i = arguments.length, currentNode;
	  if (!parent) return;
	  if (!i) // if there are no arguments
		parent.removeChild(this);
	  while (i--) { // i-- decrements i and returns the value of i before the decrement
		currentNode = arguments[i];
		if (typeof currentNode !== 'object'){
		  currentNode = this.ownerDocument.createTextNode(currentNode);
		} else if (currentNode.parentNode){
		  currentNode.parentNode.removeChild(currentNode);
		}
		// the value of "i" below is after the decrement
		if (!i) // if currentNode is the first argument (currentNode === arguments[0])
		  parent.replaceChild(currentNode, this);
		else // if currentNode isn't the first
		  parent.insertBefore(currentNode, this.previousSibling);
	  }
	}
	if (!Element.prototype.replaceWith)
		Element.prototype.replaceWith = ReplaceWithPolyfill;
	if (!CharacterData.prototype.replaceWith)
		CharacterData.prototype.replaceWith = ReplaceWithPolyfill;
	if (!DocumentType.prototype.replaceWith)
		DocumentType.prototype.replaceWith = ReplaceWithPolyfill;
	}
catch(e) {console.error(e)}
