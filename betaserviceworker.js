//Currently returns protocol, subdomain, domain name, tld, and query. I've have a better version to put in soon.
function URL(a){var b={};a=a.trim(),b.url=a,b.query=a.slice(a.indexOf("?")+1),b.query===a&&(b.query=void 0),0===a.indexOf("https://")?(b.protocol="https://",a=a.slice(8)):0===a.indexOf("http://")?(b.protocol="http://",a=a.slice(7)):b.protocol=void 0;var c=Math.min(a.indexOf("/"),a.indexOf("?"));return-1===c&&(c=Math.max(a.indexOf("/"),a.indexOf("?"))),c=-1===c?a:a.slice(0,c),b.domain=c,b.tld=c.slice(c.lastIndexOf(".")),c=c.slice(0,c.lastIndexOf(".")),b.rootdomain=c.slice(c.lastIndexOf(".")+1)+b.tld,b.subdomain=c.slice(0,c.lastIndexOf(".")+1),b}
    
    
var List = {}
List.url = []
List.values = []
var Age = Date.now()

self.addEventListener('fetch', function(event) {
if (URL(event.request.url).rootdomain === "rivers.run" || URL(event.request.url).domain === "ecc521.github.io") {
event.respondWith(
    caches.open('rivers.run').then(function(cache) {
      return cache.match(event.request).then(function (response) {
        return response || fetch(event.request).then(function(response) {
          cache.put(event.request, response.clone());
          return response;
        });
      });
    })
  );
}  
else {
  
event.respondWith((async function() {
//Verify List Age - I'll Give It 30 Seconds. If it is older, dump it.
if (Date.now() - Age > 30*1000) {
List = {}
List.url = []
List.values = []
Age = Date.now()
}

if (List.url.indexOf(event.request.url) === -1) {
    List.url.push(event.request.url)
    //This cache is deleted on every page load if the user is online
    var cache = await caches.open("Temporary")
    var response = await cache.match(event.request)
    if (!response) {
    console.log("Loading from network")
    response = await fetch(event.request)
    }
    else {
    console.log("Loaded from cache")
    }
    List.values.push(response.clone())
    cache.put(event.request, response.clone())
    //not sure that does anything.... but why not...
    return response
}
else {
    for (var i = 0;i<150;i++) {
    await new Promise(resolve => setTimeout(resolve, 100));
    if (List.values[List.url.indexOf(event.request.url)] !== undefined) {
    console.log("Loaded from list")
    break;
    }
    }
    
    return List.values[List.url.indexOf(event.request.url)].clone()
}}()))}})
