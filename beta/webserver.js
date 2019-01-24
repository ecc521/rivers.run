const fs = require("fs")
const http = require('http');
const https = require('https');
const fetch = require("node-fetch")




function parseusgsdata(usgsdata) {
    
    let usgsarray = {}
    //Iterate through all known conditions
    usgsdata.value.timeSeries.forEach(function(event){
        let obj2 = {}
        obj2.values = event.values[0].value //The values - ex. Gauge Height Array
      
        if (obj2.values.length === 0) {
          console.log("Empty Array. Skipping")
          return;
        }
      
        obj2.units = event.variable.variableDescription //Units of values
        
        let sitecode = event.sourceInfo.siteCode[0].value
        //See if the site is already in the array.
        //If the site code is not in the array, add it. 
        if (!usgsarray[sitecode]) {
            let obj3 = {}
            obj3.name = event.sourceInfo.siteName
            usgsarray[sitecode] = obj3
        }
      
        let variablecode = event.variable.variableCode[0].value

        //Convert celcius to farenheight
        if (variablecode === "00010" && obj2.units === "Temperature, water, degrees Celsius") {
          for (let i=0;i<obj2.values.length;i++) {
            obj2.values[i].value = obj2.values[i].value * 1.8 + 32
          }
          
          obj2.units = "Temperature, water, degrees Fahrenheit"
        }
      
         
        //Add the values onto the site code object
        usgsarray[sitecode][variablecode] = obj2
    })
    
    return usgsarray
}

async function getriverarray() {
    let response = await fetch("https://rivers.run/riverarray.js")
    let text = await response.text()
    let toparse = text.slice(13) //Cut off riverarray = 
    let riverarray = JSON.parse(toparse)    
    
    return riverarray
}

function getusgssitenumbers(riverarray) {
    
    let sitenumbers = []
    for (let i=0;i<riverarray.length;i++) {
        let val = riverarray[i].usgs
        //Check for accuracy
        if (val && val.length > 7 && val.length < 16) {
            sitenumbers.push(val)
        }
    }
    
    return sitenumbers
}

function getusgsjsonurl(sitenumbers) {
    let url = "https://waterservices.usgs.gov/nwis/iv/?format=json&sites=" + sitenumbers.join(",") +  "&startDT=" + new Date(Date.now()-1000*86400).toISOString()  + "&parameterCd=00060,00065,00010,00045&siteStatus=all"  
    
    return url
}


//Get riverarray.js
let maincode = async function() {
    
    //Load riverarray
    let riverarray = await getriverarray()
    //Get the possibly valid usgs site numbers
    let sitenumbers = getusgssitenumbers(riverarray)
    //Get the url to the usgs json data
    let url = getusgsjsonurl(sitenumbers)        
    //Load the JSON data from usgs
    let response = await fetch(url)
    //Create the usgs object
    let usgsdata = await response.json()
    //Turn the usgs object into something we can use
    let usgsarray = parseusgsdata(usgsdata)

    
    
}




//Otherwise, nodejs simply ends the process without waiting for the async function
maincode().then(function(value) {console.log("USGS Ready!")})



//Use multiply certificates for full client support. Order as follows
//secp521r1, secp384r1, prime256v1, rsa3072

//ag98e789vq3vp7u9dbzjknbzy76vhff77ekmncisofijwhnfnvkis873hntmglop0s0xinaewfjabgihauyu3

const hostname = "0.0.0.0"
const httpport = 80
const httpsport = 443

const httpsoptions = {
    key:fs.readFileSync("key.pem"),
    cert:fs.readFileSync("cert.pem"),
    passphrase:"ag98e789vq3vp7u9dbzjknbzy76vhff77ekmncisofijwhnfnvkis873hntmglop0s0xinaewfjabgihauyu3"
}

function httpsrequest(request, response) {
    response.statusCode = 200;
    response.setHeader('Content-Type', 'text/plain');
    response.end('Hello World\n');
}

function httprequest(req,res) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('Hello World\n');
}



const httpsserver = https.createServer(httpsoptions, httpsrequest);

httpsserver.listen(httpsport, hostname, () => {
  console.log(`Server running at https://${hostname}:${httpsport}/`);
});
    


const httpserver = http.createServer(httprequest);

httpserver.listen(httpport, hostname, () => {
  console.log(`Server running at http://${hostname}:${httpport}/`);
});
    
    