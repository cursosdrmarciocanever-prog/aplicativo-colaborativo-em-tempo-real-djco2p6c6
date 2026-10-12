// Service worker do Diário da Sarah: o app abre sem internet.
// - Páginas: rede primeiro; sem rede, usa o index.html guardado.
// - Arquivos do build (/assets/*, com hash no nome): cache primeiro.
// - API, realtime e painel do PocketBase (/api, /_/): nunca passam pelo cache.
//   Os registros feitos sem rede ficam na fila do próprio app (IndexedDB).

const VERSAO = 'diario-v1'
const ESSENCIAIS = ['/', '/index.html', '/manifest.webmanifest', '/icons/icon-192.png']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ESSENCIAIS)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== VERSAO).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_/')) return

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          const copia = resp.clone()
          caches.open(VERSAO).then((c) => c.put('/index.html', copia))
          return resp
        })
        .catch(() => caches.match('/index.html')),
    )
    return
  }

  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(req).then(
        (salvo) =>
          salvo ||
          fetch(req).then((resp) => {
            if (resp.ok) {
              const copia = resp.clone()
              caches.open(VERSAO).then((c) => c.put(req, copia))
            }
            return resp
          }),
      ),
    )
  }
})
