/**
 * Service Worker for Music Sets PWA
 * Caches shell assets for fast loading and offline presentation.
 */

const CACHE_NAME = 'sso-cache-v15';

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/theme.css',
  './css/main.css',
  './css/venn.css',
  './js/app.js',
  './js/core/models.js',
  './js/core/set-engine.js',
  './js/core/graph-engine.js',
  './js/core/track-resolver.js',
  './js/providers/provider-interface.js',
  './js/providers/provider-registry.js',
  './js/providers/spotify/spotify-auth.js',
  './js/providers/spotify/spotify-api.js',
  './js/providers/spotify/spotify-provider.js',
  './js/providers/ytmusic/ytmusic-auth.js',
  './js/providers/ytmusic/ytmusic-api.js',
  './js/providers/ytmusic/ytmusic-provider.js',
  './js/components/sso-toast.js',
  './js/components/sso-header.js',
  './js/components/sso-auth-bar.js',
  './js/components/sso-source-search.js',
  './js/components/sso-visual-builder.js',
  './js/components/sso-venn-diagram.js',
  './js/components/sso-track-preview.js',
  './js/components/sso-export-modal.js',
  './js/components/sso-app.js',
  './js/utils/svg-icons.js',
  './js/utils/pkce.js',
  './js/utils/storage.js',
  './assets/icons/icon.svg',
  './callback/index.html',
  './callback.html',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Do not cache external API calls (e.g. Spotify API, Accounts OAuth)
  if (url.origin.includes('spotify.com') || url.origin.includes('google') || url.origin.includes('scdn.co')) {
    return;
  }

  // Network-first with cache fallback for static app assets
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
