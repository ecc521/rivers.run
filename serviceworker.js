self.addEventListener('fetch', function(event) {  
console.log(event.request.url)
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
else {event.respondWith(fetch(event.request))/*Fetch from network - AND DO NOT CACHE*/}  
});
