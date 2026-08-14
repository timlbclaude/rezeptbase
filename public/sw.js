/* Rezeptbase Service Worker — Offline-Hülle.
   Navigationen: Netz zuerst, Cache als Fallback.
   Statische Assets: Cache zuerst, im Hintergrund aktualisieren.
   Supabase-Daten (nur GET /rest/v1/): Netz zuerst, Cache als Offline-Fallback —
   damit funktionieren einmal geladene Rezepte und der Kochmodus auch ohne Netz. */

const CACHE = 'rezeptbase-v2'
const DATA_CACHE = 'rezeptbase-data-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(['./', './manifest.webmanifest', './icon.svg'])).catch(() => {})
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE && k !== DATA_CACHE).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  // Supabase: Nur Daten-Lesezugriffe cachen (nie Auth, nie Functions)
  if (url.hostname.endsWith('.supabase.co')) {
    if (url.pathname.startsWith('/rest/v1/')) {
      event.respondWith(
        fetch(request)
          .then((res) => {
            if (res.ok) {
              const copy = res.clone()
              caches.open(DATA_CACHE).then((c) => c.put(request, copy))
            }
            return res
          })
          .catch(() => caches.match(request, { cacheName: DATA_CACHE }))
      )
    }
    return
  }

  // Navigationen: Netz zuerst, sonst Cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(request, copy))
          return res
        })
        .catch(() => caches.match(request).then((r) => r || caches.match('./')))
    )
    return
  }

  // Assets: Cache zuerst, parallel aktualisieren
  const cacheable = url.origin === self.location.origin
    || url.hostname === 'fonts.googleapis.com'
    || url.hostname === 'fonts.gstatic.com'
  if (!cacheable) return

  event.respondWith(
    caches.match(request).then((cached) => {
      const fresh = fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(request, copy))
          }
          return res
        })
        .catch(() => cached)
      return cached || fresh
    })
  )
})
