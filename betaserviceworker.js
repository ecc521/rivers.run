//Currently returns protocol, subdomain, domain name, tld, and query
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

//This cache is deleted on every page load if the user is online
var cache = await caches.open("Temporary")
var response = await cache.match(event.request)
if (response) {
return response
}
else {
//Verify List Age - I'll Give It 30 Seconds. If it is older, dump it.
if (Date.now() - Age > 30*1000) {
List = {}
List.url = []
List.values = []
Age = Date.now()
}

    
if (List.url.indexOf(event.request.url) === -1) {
    List.url.push(event.request.url)
    response = await fetch(event.request)
    List.values.push(response.clone())
    cache.put(event.request, response.clone())
    return response
}
else {
    for (var i = 0;i<150;i++) {
    await new Promise(resolve => setTimeout(resolve, 100));
    //console.log(List.values[List.url.indexOf(event.request.url)].clone())
    //console.log(List.values[List.url.indexOf(event.request.url)].clone() !== undefined)
    console.log(List.values[List.url.indexOf(event.request.url)])
    console.log(List.values[List.url.indexOf(event.request.url)] !== undefined)
    }
    
    return List.values[List.url.indexOf(event.request.url)].clone()
}
    
    

}
  
}()))
}
})



/*self.addEventListener('fetch', function(event) {  
//Only cache rivers.run resources - don't cache other resources such as USGS gage data. That will uselessly fill up cache with dynamic URL's.
if (event.request.url.indexOf("https://rivers.run") === 0) {
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
event.respondWith(
  //USGS cache is deleted on every page reload
    caches.open('USGS').then(function(cache) {
      return cache.match(event.request).then(function (response) {
        return response || fetch(event.request).then(function(response) {
          cache.put(event.request, response.clone());
          return response;
        });
      });
    })
  );
}  
})*/
