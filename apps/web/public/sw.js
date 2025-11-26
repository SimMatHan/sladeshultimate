/* Web Push service worker: keep logic minimal for maintainability */

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('message', (event) => {
  if (event?.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

const DEFAULT_ICON = '/icon-192.png'

function parsePushEvent(event) {
  if (!event.data) {
    return {}
  }
  try {
    return event.data.json()
  } catch (error) {
    console.warn('[sw] Failed to parse push payload, falling back to text', error)
    return { title: 'SladeshUltimate', body: event.data.text() }
  }
}

self.addEventListener('push', (event) => {
  const payload = parsePushEvent(event)
  const title = payload.title || 'SladeshUltimate'
  const data = payload.data || {}
  const url = data.url || payload.url || '/'

  const options = {
    body: payload.body || 'Ny besked i Sladesh',
    icon: data.icon || DEFAULT_ICON,
    badge: data.badge || DEFAULT_ICON,
    tag: payload.tag || `sladesh_${data.type || 'generic'}`,
    data: {
      ...data,
      url
    },
    renotify: data.renotify || false,
    requireInteraction: !!data.requireInteraction
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification?.data?.url || '/'

  event.waitUntil(
    (async () => {
      const normalizedTarget = new URL(targetUrl, self.location.origin)
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of allClients) {
        if (
          typeof client.url === 'string' &&
          client.url.startsWith(`${normalizedTarget.origin}${normalizedTarget.pathname}`) &&
          'focus' in client
        ) {
          return client.focus()
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(normalizedTarget.href)
      }
      return null
    })()
  )
})