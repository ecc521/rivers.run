function GetId(Id) {
    return document.getElementById(Id)
}
function ReloadAllCache() {
    localStorage.setItem("TimeStamp", Date.now())
    
    navigator.serviceWorker.getRegistrations().then(function(registrations) {
 for(let registration of registrations) {
  registration.unregister()
} })
    
    window.location.reload(true)
}
if (localStorage.getItem("TimeStamp") !== null && Date.now()-localStorage.getItem("TimeStamp") > 5000) {
    GetId("ReloadAll").hidden= ""
    if (navigator.onLine) {
    GetId("ReloadAllButton").style = "display: inline"
    }
    window.addEventListener("offline", function() {GetId("ReloadAllButton").style = "display: none"})
    window.addEventListener("offline", function() {GetId("ReloadAllButton").style = "display: inline"})
    GetId("ReloadAllButton").addEventListener("click", ReloadAllCache)
    GetId("ReloadAllButton").value = "Update Now"
    GetId("ReloadAllText").innerHTML = "You are viewing the offline version of this site from " + Math.floor((Date.now() - localStorage.getItem("TimeStamp"))/1000) + " seconds ago."
}
else {
    if (localStorage.getItem("TimeStamp") === null) {
    localStorage.setItem("TimeStamp", Date.now())
    }
}

if (screen.width<560 && screen.height>screen.width) {
    GetId("RotateMobile").innerHTML = "<span style=\"background-color: orange\"><strong>Rotating your display to Landscape mode is recommended.</strong></span>"
    GetId("RotateMobile").hidden = ""
}
window.addEventListener("orientationchange", function() {
if (screen.width<560 && screen.height>screen.width) {
    GetId("RotateMobile").innerHTML = "<span style=\"background-color: orange\"><strong>Rotating your display to Landscape mode is recommended.</strong></span>"
    GetId("RotateMobile").hidden = ""
}
else {
    GetId("RotateMobile").hidden = true
}
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('https://riversoffline.github.io/serviceworker.js')
  .then(function(registration) {
  })
  .catch(function(error) {
  });
}



//Popup Text
var modal = document.getElementById('myModal');
var span = document.getElementsByClassName("close")[0];
span.onclick = function() {
    modal.style.display = "none";
}
window.onclick = function(event) {
    if (event.target == modal) {
        modal.style.display = "none";
    }
}

function DisplayPopup(text) {
    GetId("PopupText").innerHTML = text
    modal.style.display = "block";
}

function AddElement(b,c,d,e,f,w) {
    var li = document.createElement("li")
    var t,span;
    
    function A(g) {
    if (g === undefined) {
        g = "Missing Data"
    }
    t = document.createTextNode(g);
    span = document.createElement("Span")
    span.appendChild(t)
    li.appendChild(span)
    }
    
    A(b)
    A(c)
    A(d)
    A(e)
    A(f)
    if (w !== undefined) {
        li.addEventListener("click", function() {DisplayPopup(w)})
    }
    
    
    GetId("Rivers").appendChild(li)
}


function ClearList() {
var myNode = GetId("Rivers");
while (myNode.firstChild) {
    myNode.removeChild(myNode.firstChild);
}
AddElement("River Name", "Section", "Difficulty", "Quality", "Writeup Length")
}


function CreateList(array) {
ClearList()
for (var i=0;i<array.length;i++) {
    var Obj = array[i]
    AddElement(Obj.Name, Obj.Section, Obj.Difficulty, Obj.Quality, Obj.WriteupLength, Obj.Writeup)
}
}

//RiverArray is defined because of the other JavaScript file that was loaded.
CreateList(RiverArray)
//That will be the initial list with everything in it.

try {
GetId("SearchBox").addEventListener("keydown", function() {setTimeout(SortListGen, 20)})
function SortListGen() {
    var Text = GetId("SearchBox").value
    var array = []
    var array2 = []
    for (var i = 0;i<RiverArray.length;i++) {
        var Obj = RiverArray[i]
        
        if (Obj.Name.indexOf(Text) !== -1) {
            array.push(Obj)
        }
        else {
            
        if (Obj.Section.indexOf(Text) !== -1) {
            array2.push(Obj)
        }   
        } 
    }
    for (var i = 0; i<array2.length;i++) {
        array.push(array2[i])
    }
    CreateList(array)
    
    if (array.length === 0) {
AddElement("Not Found", "Not Found", "Not Found", "Not Found", "Not Found")
    }

}
}
catch(e) {
    console.log(e)
}
