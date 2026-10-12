const CACHE_NAME = 'hotel-pdc-v3';
const urlsToCache = [
  './',
  './index.html',
  './icona.jpg',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .catch(err => console.warn('Cache install warning:', err))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Rimozione vecchia cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Strategia Network-First per il PDF: garantisce che i nuovi file HOTEL_PDC.pdf
  // vengano scaricati subito quando aggiornati, mantenendo il fallback offline
  if (url.pathname.endsWith('.pdf') || url.pathname.includes('HOTEL_PDC')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' })
        .then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
              cache.put('./HOTEL_PDC.pdf', responseClone.clone());
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // In caso di assenza di rete, usa il file PDF salvato in cache
          return caches.match('./HOTEL_PDC.pdf').then(cachedResponse => {
            if (cachedResponse) return cachedResponse;
            return caches.match(event.request);
          });
        })
    );
    return;
  }

  // Per tutte le altre risorse statiche: Cache-First con fallback su Network
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        });
      })
      .catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      })
  );
});
