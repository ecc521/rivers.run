function GetId(Id) {
    return document.getElementById(Id)
}
function ReloadAllCache() {
    "use strict";

    localStorage.setItem("TimeStamp", Date.now())
    
    navigator.serviceWorker.getRegistrations().then(function(registrations) {
 for(let registration of registrations) {
  registration.unregister()
} })
    caches.delete('RiversOffline').then(function(event) {
    window.location.reload(true)
    })
    .catch(function(event) {
    window.location.reload(true)
    })
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

if (window.innerWidth<700) {
    GetId("Rivers").style.setProperty('--textsize', '16px')
    if (window.innerWidth<560) {
    GetId("Rivers").style.setProperty('--textsize', '14px')
    }
}
if (window.innerWidth<560 && window.innerHeight>window.innerWidth) {
    if (window.innerWidth<300) {
    GetId("RotateMobile").innerHTML = "<span style=\"background-color: orange\"><strong>Rotating your display to Landscape mode is recommended.</strong></span>"
    GetId("RotateMobile").hidden = ""
    }
    GetId("Rivers").style.setProperty('--textsize', '12px')

}
window.addEventListener("resize", function() {setTimeout(RotateHandler, 100)})

                        
function RotateHandler() {
if (window.innerWidth<560 && window.innerHeight>window.innerWidth) {
    if (window.innerWidth < 300) {
    GetId("RotateMobile").innerHTML = "<span style=\"background-color: orange\"><strong>Rotating your display to Landscape mode is recommended.</strong></span>"
    GetId("RotateMobile").hidden = ""
    }

    GetId("Rivers").style.setProperty('--textsize', '12px')

}
else {
    if (window.innerWidth > window.innerHeight) {
    GetId("RotateMobile").hidden = true
    }
    GetId("Rivers").style.setProperty('--textsize', '18px')
    if (window.innerWidth<700) {
    GetId("Rivers").style.setProperty('--textsize', '16px')
    if (window.innerWidth<560) {
    GetId("Rivers").style.setProperty('--textsize', '14px')
    }
    if (window.innerWidth<400) {
    GetId("Rivers").style.setProperty('--textsize', '12px')
    }
}
}
};



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
    AddElement(Obj.Name, Obj.Section, Obj.Difficulty, Obj.Quality + "/10", Obj.WriteupLength, Obj.Writeup)
}
}

//RiverArray is defined because of the other JavaScript file that was loaded.
CreateList(RiverArray)
//That will be the initial list with everything in it.

GetId("SearchBox").addEventListener("keydown", function() {setTimeout(SortListGen, 20)})
function SortListGen() {
    var Text = (GetId("SearchBox").value).toLowerCase()
    var array = []
    var array2 = []
    var array3 = []
    var array4 = []
    for (var i = 0;i<RiverArray.length;i++) {
        var Obj = RiverArray[i]
        
        if (Obj.Name.toLowerCase().indexOf(Text) !== -1) {
            array.push(Obj)
        }
        else {
            
        if (Obj.Section.toLowerCase().indexOf(Text) !== -1) {
            array2.push(Obj)
        }
        else {
        if (Obj.Difficulty.toLowerCase().indexOf(Text) !== -1) {
            array3.push(Obj)
        }   
        else {
        if (Obj.Writeup.toLowerCase().indexOf(Text) !== -1) {
            array4.push(Obj)
        }   
        }
        }
            
        } 
    }
    for (var i = 0; i<array2.length;i++) {
        array.push(array2[i])
    }
    for (var i = 0; i<array3.length;i++) {
        array.push(array3[i])
    }
    for (var i = 0; i<array4.length;i++) {
        array.push(array4[i])
    }
    CreateList(array)
    
    if (array.length === 0) {
AddElement("Not Found", "Not Found", "Not Found", "Not Found", "Not Found")
    }

}
