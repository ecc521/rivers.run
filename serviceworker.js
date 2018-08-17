self.addEventListener('activate', function(event) {
caches.delete('RiversOffline');
});

self.addEventListener('fetch', function(event) {
    var Request = fetch(event.request)
    
    Request.then(function(response) {
          cache.put(event.request, response.clone());
          return response;
    });
  
    Request.catch(function() {
      return caches.match(event.request);
    })
                               
                               
  
});

/*self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.open('RiversOffline').then(function(cache) {
      return cache.match(event.request).then(function (response) {
        return response || fetch(event.request).then(function(response) {
          cache.put(event.request, response.clone());
          return response;
        });
      });
    })
  );
});*/
