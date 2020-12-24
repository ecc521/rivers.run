
class MapTooltip extends google.maps.OverlayView {
	constructor(position, content, offsetY = 0) {
		super();
		this.position = position;
		this.offsetY = offsetY
		content.classList.add("popup-bubble");
		content.style.whiteSpace = "nowrap"

		// This zero-height div is positioned at the bottom of the bubble.
		const bubbleAnchor = document.createElement("div");
		bubbleAnchor.classList.add("tooltip-bubble-anchor");
		bubbleAnchor.appendChild(content);
		// This zero-height div is positioned at the bottom of the tip.
		this.containerDiv = document.createElement("div");
		this.containerDiv.classList.add("popup-container");
		this.containerDiv.appendChild(bubbleAnchor);
		// Optionally stop clicks, etc., from bubbling up to the map.
		//MapTooltip.preventMapHitsAndGesturesFrom(this.containerDiv);
	}
	/** Called when the popup is added to the map. */
	onAdd() {
		this.getPanes().floatPane.appendChild(this.containerDiv);
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
			this.containerDiv.style.left = divPosition.x + "px";
			this.containerDiv.style.top = (divPosition.y - this.offsetY) + "px";
		}

		if (this.containerDiv.style.display !== display) {
			this.containerDiv.style.display = display;
		}
	}
}

module.exports = MapTooltip
