const cacheName = __BOARD_CACHE_NAME__;
const files = __BOARD_BUILD_FILES__.map((path) => new URL(path, self.registration.scope).href);
const shell = files[0];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(cacheName).then((cache) =>
    cache.addAll(files.map((url) => new Request(url, { cache: 'reload' })))));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith('sprint-board-shell:') && name !== cacheName)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  if (request.mode === 'navigate' && request.url.startsWith(self.registration.scope) && new URL(request.url).pathname === new URL(shell).pathname) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request, { signal: AbortSignal.timeout(3500) });
        if (response.ok) return response;
        return (await caches.open(cacheName)).match(shell).then((cached) => cached ?? response);
      } catch {
        return (await caches.open(cacheName)).match(shell).then((cached) => cached ?? Response.error());
      }
    })());
  } else if (files.includes(request.url)) {
    event.respondWith((async () => {
      // Bundled assets have one representation per URL, including for CORS requests.
      return (await (await caches.open(cacheName)).match(request.url, { ignoreVary: true })) ?? fetch(request);
    })());
  }
});
