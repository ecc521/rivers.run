self.addEventListener('fetch', function(event) {
  console.log('Handling fetch event for', event.request.url);
  console.log(event.request.url.indexOf("rivers.run"))
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
});
