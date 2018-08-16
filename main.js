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
    GetId("ReloadAllText").innerHTML = "You are viewing the offline version of this site from " + ((Date.now() - localStorage.getItem("TimeStamp"))/1000) + " seconds ago."
}
else {
    if (localStorage.getItem("TimeStamp") === null) {
    localStorage.setItem("TimeStamp", Date.now())
    }
}

if (screen.width<560 && screen.height>screen.width) {
    GetId("RotateMobile").innerHTML = "<strong>Rotating your screen to landscape mode reccomended for optimal viewing experience</strong>"
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
AddElement("River Name", "Section", "Difficulty", "Quality", "Letters in Writeup")
}



RiverArray = []//Global - For a reason


function CreateInitialList(RiverArray) {
ClearList()

for (var i=0;i<RiverArray.length;i++) {
    var Obj = RiverArray[i]
    AddElement(Obj.Name, Obj.Section, Obj.Difficulty, Obj.Quality, Obj.WriteupLength, Obj.Writeup)
}

}





//Time to load the files... Oh no. This could be BAD.
(async function LoadFiles() {        
        //Use this to return the URL to fetch
        function URLCreate(File_ID) {
            var API_KEY = "AIzaSyD-MaLfNzz1BiUvdKKfowXbmW_v8E-9xSc"
            return 'https://www.googleapis.com/drive/v3/files/' + File_ID + '/export?mimeType=text%2Fplain&key=' + API_KEY       
        }
        
        //Now we need to fetch the file ID file and split by newline. After this, what we will do is iterate through and fetch every resource.
        
        var FetchList = await (await fetch(URLCreate("19B237gWAoRLOzz5Hh4AO6nD1yxVWxL1LmTLgYkg8JrQ"))).text()
        FetchList = FetchList.split("\n")
        for (var i = 0;i<FetchList.length;i++) {
            fetch(URLCreate(FetchList[i])).then(function(Event) {
                Event = Event.text()
                Event.then(function(Event) {
                var Text = Event
                Event = Event.split("\n",5)
                var NewRiver = {}                    
                NewRiver.Name = Event[0]
                NewRiver.Section = Event[1]
                NewRiver.Difficulty = Event[2]
                NewRiver.Quality = Event[3]
                NewRiver.Writeup = (NewRiver.Name).slice(0,-1) + " Writeup:<br><br>" + Text.slice(Text.indexOf(Event[4])).split("\n").join("<br>")
                NewRiver.WriteupLength = Text.slice(Text.indexOf(Event[4])).length
                RiverArray.push(NewRiver)
                CreateInitialList(RiverArray)
                })
            }).catch(function(Error) {
                console.log(Error)
                GetId("Errors").innerHTML += Error + "<br>"
            })
        }
            
        
        
        
        
}())
