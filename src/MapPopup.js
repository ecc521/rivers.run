class MapPopup extends google.maps.OverlayView {
	constructor(position, content) {
		super();
		this.position = position;
		content.classList.add("popup-bubble");
		content.style.minWidth = "80vw";

		function bringToFront() {
			//Set out zIndex to highest.
			let overlays = document.querySelectorAll(".popup-bubble")
			let maxZIndex = 0
			for (let i=0;i<overlays.length;i++) {
				let zIndex = Number(overlays[i].style.zIndex)
				if (zIndex > maxZIndex) {
					maxZIndex = zIndex
				}
			}
			content.style.zIndex = ++maxZIndex
		}
		content.addEventListener("click", bringToFront)
		bringToFront()
		// This zero-height div is positioned at the bottom of the bubble.
		const bubbleAnchor = document.createElement("div");
		bubbleAnchor.classList.add("popup-bubble-anchor");
		bubbleAnchor.appendChild(content);
		// This zero-height div is positioned at the bottom of the tip.
		this.containerDiv = document.createElement("div");
		this.containerDiv.classList.add("popup-container");
		this.containerDiv.appendChild(bubbleAnchor);
		// Optionally stop clicks, etc., from bubbling up to the map.
		MapPopup.preventMapHitsAndGesturesFrom(this.containerDiv);

		this.offsetX = 0
		this.offsetY = 0

		let lastX;
		let lastY;
		content.draggable = true
		let drag = (function(event) {
			if (lastX !== undefined && lastY !== undefined) {
				this.offsetX += event.screenX - lastX
				this.offsetY += event.screenY - lastY
			}
			lastX = event.screenX
			lastY = event.screenY
			this.draw()
		}).bind(this)
		content.ondrag = drag

		content.ondragend = function(event) {
			drag(event) //Do this to force the element back to the correct location.
			//I suspect that, since there isn't a drop target, the last drag reverts all previous drags.
			//The current behavior is a bit jumpy, but works.
			lastX = undefined
			lastY = undefined
		}
	}
	/** Called when the popup is added to the map. */
	onAdd() {
		this.getPanes().floatPane.appendChild(this.containerDiv);

		let currentPixel = this.getProjection().fromLatLngToContainerPixel(
			this.position
		);

		this.map.panBy(currentPixel.x - this.map.getDiv().offsetWidth * 0.5, currentPixel.y - this.map.getDiv().offsetHeight * 0.8)
	}
	/** Called when the popup is removed from the map. */
	onRemove() {
		if (this.containerDiv.parentElement) {
			this.containerDiv.parentElement.removeChild(this.containerDiv);
		}
	}
	/** Called each frame when the popup needs to draw itself. */
	draw() {
		const divPosition = this.getProjection().fromLatLngToDivPixel(
			this.position
		);
		// Hide the popup when it is far out of view.
		const display =
		Math.abs(divPosition.x) < 4000 && Math.abs(divPosition.y) < 4000
		? "block"
		: "none";

		if (display === "block") {
			this.containerDiv.style.left = divPosition.x + this.offsetX + "px";
			this.containerDiv.style.top = divPosition.y + this.offsetY + "px";
		}

		if (this.containerDiv.style.display !== display) {
			this.containerDiv.style.display = display;
		}
	}
}

module.exports = MapPopup
