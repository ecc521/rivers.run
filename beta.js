window.addEventListener("resize", function() {setTimeout(SortListGen, 100)})


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
    if (e === "Quality") {
        A(e)
    }
    else {
     span = document.createElement("Span")
var Text;
switch (e) {
    case 1:
        Text = "1Star";
        break;
    case 2:
        Text = "2Stars";
        break;
    case 3:
        Text = "3Stars";
        break;
    case 4:
        Text = "4Stars";
        break;
    case 5:
        Text = "5Stars";
        break;
    default:
        Text = "Error"
}
if (Text === "Error") {
   A("Invalid Value") 
}
else {
var px = Math.floor(window.innerWidth/25)
if (px<14) {
    Text = "12" + Text
}
else if (px<16){
    Text = "14" + Text
}
else if (px<18) {
    Text = "16" + Text
}
else {
    Text = "18" + Text
}
var div = document.createElement(div)
div.className = "img-" + Text
span.appendChild(div)
li.appendChild(span)
}
    }
    
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
AddElement("River Name", "Section", "Difficulty", "Quality", "Length (Miles)")
}


function CreateList(array) {
ClearList()
for (var i=0;i<array.length;i++) {
    var Obj = array[i]
    AddElement(Obj.Name, Obj.Section, Obj.Difficulty, parseInt(Obj.Quality), Obj.Length, Obj.Writeup)
}
}

//RiverArray is defined because of the other JavaScript file that was loaded.
CreateList(RiverArray)
//That will be the initial list with everything in it.

GetId("SearchBox").addEventListener("keydown", function() {setTimeout(SortListGen, 20)})
function SortListGen() {
    var Text = ((GetId("SearchBox").value).toLowerCase()).trim()
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
console.log("If there are 3 warnings below this for pre-loading non-used images, please note that they total to around 1KB and are intentionally pre-loaded in case of major screen resizes.")
