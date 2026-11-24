const CACHE = 'floating-island-offline-v1';
const ROOT = self.registration.scope;
const indexURL = new URL('index.html', ROOT).href;
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

async function rangeResponse(request, response) {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(request.headers.get('range') || '');
  const blob = await response.blob();
  const size = blob.size;
  const invalid = () => new Response(null, {status: 416, headers: {'Content-Range': `bytes */${size}`, 'Accept-Ranges': 'bytes'}});
  if (!match || (!match[1] && !match[2]) || !size) return invalid();
  let start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  let end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) return invalid();
  const headers = new Headers();
  headers.set('Content-Type', response.headers.get('Content-Type') || 'application/octet-stream');
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
  headers.set('Content-Length', String(end - start + 1));
  return new Response(blob.slice(start, end + 1), {status: 206, headers});
}
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || !request.url.startsWith(ROOT)) return;
  if (new URL(request.url).searchParams.has('offline-refresh')) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const url = new URL(request.url);
    url.search = ''; url.hash = '';
    const key = request.mode === 'navigate' && (url.href === ROOT || url.href === indexURL) ? indexURL : url.href;
    const cached = await cache.match(key);
    if (request.mode === 'navigate') {
      try {
        const online = await fetch(request);
        if (online.ok || !cached) return online;
      } catch { /* Continue with the copy prepared for offline viewing. */ }
    }
    if (cached) {
      if (request.headers.has('range')) return rangeResponse(request, cached);
      return cached;
    }
    try { return await fetch(request); }
    catch { return new Response('Offline resource unavailable', {status: 503}); }
  })());
});
