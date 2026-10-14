// Service worker do Diário da Sarah: o app abre sem internet.
// - Páginas: rede primeiro; sem rede, usa o index.html guardado.
// - Arquivos do build (/assets/*, com hash no nome): cache primeiro.
// - API, realtime, rotas próprias e painel do PocketBase (/api, /backend, /_/): nunca
//   passam pelo cache.
//   Os registros feitos sem rede ficam na fila do próprio app (IndexedDB).

const VERSAO = 'diario-v2'
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
  if (/^\/(api|_|backend)\//.test(url.pathname)) return

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

// ---------- Notificações (Web Push) ----------
// O serviço "notificador" manda { title, body, url, tag }. A mesma tag substitui o aviso
// anterior (ex.: "hora da mamada" é trocado por "mamada atrasada", sem empilhar).
self.addEventListener('push', (event) => {
  let dados = {}
  try {
    dados = event.data ? event.data.json() : {}
  } catch (_) {
    dados = { body: event.data ? event.data.text() : '' }
  }
  const titulo = dados.title || 'Diário da Sarah'
  event.waitUntil(
    self.registration.showNotification(titulo, {
      body: dados.body || '',
      tag: dados.tag || undefined,
      renotify: !!dados.tag,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: dados.url || '/hoje' },
      lang: 'pt-BR',
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const destino = new URL(event.notification.data?.url || '/hoje', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((abertas) => {
      for (const c of abertas) {
        if (c.url.startsWith(self.location.origin) && 'focus' in c) {
          return c.focus().then((janela) => (janela && 'navigate' in janela ? janela.navigate(destino) : janela))
        }
      }
      return self.clients.openWindow(destino)
    }),
  )
})
