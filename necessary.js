function GetId(Id) {
    return document.getElementById(Id)
}
function ReloadAllCache() {
    "use strict";

    localStorage.setItem("TimeStamp", Date.now())
    
    caches.delete('RiversOffline').then(function(event) {
    window.location.reload(true)
    })
    .catch(function(event) {
    window.location.reload(true)
    })
}
function UpdateTime () {
if (localStorage.getItem("TimeStamp") !== null && Date.now()-localStorage.getItem("TimeStamp") > 600000) {
var Minutes = Math.floor(Math.floor((Date.now() - localStorage.getItem("TimeStamp"))/1000)/60)
var Hours = Math.floor(Minutes/60)
Minutes = Minutes%60 
var Days = Math.floor(Hours/24)
Hours = Hours%24
var TimeStr = ""
if (Days !== 0) {
    if (Days === 1) {
        TimeStr = TimeStr + Days + " day "
    }
    else {
        TimeStr = TimeStr + Days + " days "
    }
}
if (Hours !== 0) {
    if (Hours === 1) {
        TimeStr = TimeStr + Hours + " hour "
    }
    else {
        TimeStr = TimeStr + Hours + " hours "
    }
}
if (Minutes !== 0) {
    if (Minutes === 1) {
        TimeStr = TimeStr + Minutes + " minute "
    }
    else {
        TimeStr = TimeStr + Minutes + " minutes "
    }
}
GetId("ReloadAllText").innerHTML = "You're viewing a cached version of this site from " + TimeStr + " ago."    
}
}
if (localStorage.getItem("TimeStamp") !== null && Date.now()-localStorage.getItem("TimeStamp") > 600000) {
    UpdateTime()
    setInterval(UpdateTime, 60000)
    GetId("ReloadAll").hidden= ""
    if (navigator.onLine) {
    GetId("ReloadAllButton").style = "display: inline"
    }
    window.addEventListener("offline", function() {GetId("ReloadAllButton").style = "display: none"})
    window.addEventListener("offline", function() {GetId("ReloadAllButton").style = "display: inline"})
    GetId("ReloadAllButton").addEventListener("click", ReloadAllCache)
    GetId("ReloadAllButton").value = "Update Now"
    UpdateTime()
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
window.addEventListener("resize", function() {setTimeout(SortListGen, 100)})

                        
function RotateHandler() {
if (window.innerWidth<560 && window.innerHeight>window.innerWidth) {
    if (window.innerWidth < 300) {
    GetId("RotateMobile").innerHTML = "<span style=\"background-color: orange\"><strong>Rotating your display to Landscape mode is recommended.</strong></span>"
    GetId("RotateMobile").hidden = ""
    }

    document.documentElement.style.setProperty('--textsize', '14px')
    if (window.innerWidth<400) {
    document.documentElement.style.setProperty('--textsize', '12px')
    }
    if (window.innerWidth > 300) {
    GetId("RotateMobile").hidden = true
    }
}
else {
    if (window.innerWidth > window.innerHeight) {
    GetId("RotateMobile").hidden = true
    }
    if (window.innerWidth > 300) {
    GetId("RotateMobile").hidden = true
    }
    document.documentElement.style.setProperty('--textsize', '18px')
    if (window.innerWidth<700) {
    document.documentElement.style.setProperty('--textsize', '16px')
    if (window.innerWidth<560) {
    document.documentElement.style.setProperty('--textsize', '14px')
    }
    if (window.innerWidth<400) {
    document.documentElement.style.setProperty('--textsize', '12px')
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
