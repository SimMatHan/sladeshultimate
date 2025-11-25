const SW_URL = '/sw.js'

let registrationPromise
let hasReloadedForUpdate = false
let controllerChangeListenerAttached = false

const attachUpdateHandlers = (registration) => {
  if (!registration) return

  const listenForInstallation = (worker) => {
    if (!worker) return

    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) {
        worker.postMessage({ type: 'SKIP_WAITING' })
      }
    })
  }

  if (registration.installing) listenForInstallation(registration.installing)
  if (registration.waiting && navigator.serviceWorker.controller) {
    registration.waiting.postMessage({ type: 'SKIP_WAITING' })
  }

  registration.addEventListener('updatefound', () => listenForInstallation(registration.installing))

  if (!controllerChangeListenerAttached) {
    controllerChangeListenerAttached = true
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hasReloadedForUpdate) return
      hasReloadedForUpdate = true
      window.location.reload()
    })
  }
}

const registerServiceWorker = async () => {
  const registration = await navigator.serviceWorker.register(SW_URL)
  attachUpdateHandlers(registration)
  await navigator.serviceWorker.ready.catch(() => {})
  return registration
}

export const initServiceWorkerUpdates = () => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return Promise.resolve(null)
  }
  if (!registrationPromise) {
    registrationPromise = registerServiceWorker().catch((error) => {
      console.error('[PWA] Service worker registration failed', error)
      registrationPromise = null
      return null
    })
  }
  return registrationPromise
}

