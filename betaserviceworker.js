//Currently returns protocol, subdomain, domain name, tld, and query
function URL(a){var b={};a=a.trim(),b.url=a,b.query=a.slice(a.indexOf("?")+1),b.query===a&&(b.query=void 0),0===a.indexOf("https://")?(b.protocol="https://",a=a.slice(8)):0===a.indexOf("http://")?(b.protocol="http://",a=a.slice(7)):b.protocol=void 0;var c=Math.min(a.indexOf("/"),a.indexOf("?"));return-1===c&&(c=Math.max(a.indexOf("/"),a.indexOf("?"))),c=-1===c?a:a.slice(0,c),b.domain=c,b.tld=c.slice(c.lastIndexOf(".")),c=c.slice(0,c.lastIndexOf(".")),b.rootdomain=c.slice(c.lastIndexOf(".")+1)+b.tld,b.subdomain=c.slice(0,c.lastIndexOf(".")+1),b}

var List = []

self.addEventListener('fetch', function(event) {
if (URL(event.request.url).rootdomain === "rivers.run") {
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
console.log(List)
if (List.indexOf(event.request) === -1) {
    List.push(event.request)
    console.log(event.request)
}
//This cache is deleted on every page load if the user is online
var cache = await caches.open("Temporary")
var response = await thiscache.match(event.request)
if (response) {
return response
}
else {
response = await fetch(event.request)
cache.put(event.request, response.clone())
return response
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
