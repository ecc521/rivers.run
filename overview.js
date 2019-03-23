let overview_modal = document.getElementById('overview-modal');

let span = document.getElementById("overview-modal-close").onclick = function() {
	overview_modal.style.display = "none"
}

window.onclick = function(event) {
  if (event.target == overview_modal) {
    overview_modal.style.display = "none";
  }
}


	
class RiverOverview extends HTMLElement {
  constructor() {
	  super();

	  function openOverview() {
		  let text = "This overview (" + this.innerHTML + ") is not available. This is likely due to a data entry error"
		  if (window.overviews && window.overviews[this.innerHTML]) {
		  	text = window.overviews[this.innerHTML]
		  }
	  	
		  document.getElementById("overview-modal-text").innerHTML = text
		  document.getElementById("overview-modal").style.display = "block"
	  }
	  
	  
	  //Style so that text looks like a link/button
	  this.style.cursor = "pointer"
	  this.style.color = "blue"
	  this.style.textDecoration = "underline"

	  this.addEventListener("click", openOverview)
	
  }
}

customElements.define('river-overview', RiverOverview);
