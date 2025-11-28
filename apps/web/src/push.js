import { initServiceWorkerUpdates } from './utils/serviceWorkerUpdates'
import { upsertPushSubscription, removePushSubscription } from './services/pushSubscriptionService'

/**
 * Frontend env requirements:
 * - VITE_VAPID_PUBLIC_KEY: the Web Push public key (same pair as backend vars)
 * - VITE_API_BASE: base URL for the Vercel API (e.g. https://sladeshultimate-api.vercel.app)
 */
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY
const API_BASE = import.meta.env.VITE_API_BASE

const STORAGE_KEYS = {
  cachedSubscription: 'sladesh:pushSubscription',
  promptShown: 'sladesh:notificationsPromptShown'
}

const PUSH_UNSUPPORTED = {
  serviceWorker: typeof window === 'undefined' || !('serviceWorker' in navigator),
  pushManager: typeof window === 'undefined' || !('PushManager' in window),
  notification: typeof Notification === 'undefined'
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

const hasLocalStorage = () => {
  try {
    const testKey = '__sla_push_test'
    localStorage.setItem(testKey, '1')
    localStorage.removeItem(testKey)
    return true
  } catch {
    return false
  }
}

const getServiceWorkerRegistration = async () => {
  const registration = await initServiceWorkerUpdates()
  if (registration) return registration
  if (!('serviceWorker' in navigator)) return null
  return navigator.serviceWorker.ready.catch(() => null)
}

const getStoredJSON = (key) => {
  if (!hasLocalStorage()) return null
  try {
    const value = localStorage.getItem(key)
    return value ? JSON.parse(value) : null
  } catch {
    return null
  }
}

const setStoredJSON = (key, value) => {
  if (!hasLocalStorage()) return
  try {
    if (value === null) {
      localStorage.removeItem(key)
    } else {
      localStorage.setItem(key, JSON.stringify(value))
    }
  } catch {
    // Ignore storage failures (private browsing, etc.)
  }
}

export const isPushSupported = () =>
  !PUSH_UNSUPPORTED.serviceWorker && !PUSH_UNSUPPORTED.pushManager && !PUSH_UNSUPPORTED.notification

export const getNotificationPermission = () => {
  if (PUSH_UNSUPPORTED.notification) return 'unsupported'
  return Notification.permission
}

export const hasShownPermissionPrompt = () => {
  if (!hasLocalStorage()) return false
  return localStorage.getItem(STORAGE_KEYS.promptShown) === '1'
}

export const markPermissionPromptShown = () => {
  if (!hasLocalStorage()) return
  try {
    localStorage.setItem(STORAGE_KEYS.promptShown, '1')
  } catch {
    // ignore
  }
}

export const resetPermissionPromptFlag = () => {
  if (!hasLocalStorage()) return
  try {
    localStorage.removeItem(STORAGE_KEYS.promptShown)
  } catch {
    // ignore
  }
}

export const getCachedSubscription = () => getStoredJSON(STORAGE_KEYS.cachedSubscription)

export const setCachedSubscription = (subscription) =>
  setStoredJSON(STORAGE_KEYS.cachedSubscription, subscription)

export const clearCachedSubscription = () => setStoredJSON(STORAGE_KEYS.cachedSubscription, null)

export const areNotificationsEnabled = () => {
  if (!hasLocalStorage()) return true // Default to enabled if localStorage unavailable
  try {
    const stored = localStorage.getItem('notificationsEnabled')
    return stored !== null ? stored === 'true' : true // Default to true if not set
  } catch {
    return true // Default to enabled on error
  }
}

const ensureEnvConfigured = () => {
  if (!VAPID_PUBLIC_KEY) {
    throw new Error('VITE_VAPID_PUBLIC_KEY is missing. Add it to .env.local')
  }
}

const subscribeWithRegistration = async (registration) => {
  ensureEnvConfigured()
  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
  })
}

export const requestBrowserPermission = async () => {
  if (PUSH_UNSUPPORTED.notification) {
    return 'unsupported'
  }
  return Notification.requestPermission()
}

export async function ensurePushSubscription({ currentUser, forceRefresh = false } = {}) {
  if (!isPushSupported()) {
    return { ok: false, reason: 'unsupported' }
  }

  const permission = getNotificationPermission()
  if (permission !== 'granted') {
    return { ok: false, reason: permission }
  }

  const registration = await getServiceWorkerRegistration()
  if (!registration) {
    return { ok: false, reason: 'registration_failed' }
  }

  let existingSubscription = await registration.pushManager.getSubscription()

  if (!existingSubscription || forceRefresh) {
    try {
      if (existingSubscription) {
        await existingSubscription.unsubscribe().catch(() => {})
      }
      existingSubscription = await subscribeWithRegistration(registration)
    } catch (error) {
      console.error('[push] Failed to create subscription', error)
      return { ok: false, reason: 'subscribe_failed', error }
    }
  }

  // Persist locally for quick debug access
  setCachedSubscription(existingSubscription)

  // Persist in Firestore for fan-out triggers
  if (currentUser?.uid) {
    try {
      await upsertPushSubscription(currentUser.uid, existingSubscription, {
        userAgent: navigator.userAgent,
        platform: navigator.platform || 'unknown'
      })
    } catch (error) {
      console.error('[push] Failed to save subscription in Firestore', error)
      return { ok: false, reason: 'firestore_failed', error }
    }
  }

  return { ok: true, subscription: existingSubscription }
}

export async function removeSubscriptionForCurrentUser(currentUser) {
  if (!currentUser?.uid) return

  const registration = await getServiceWorkerRegistration()
  const subscription = await registration?.pushManager?.getSubscription()
  if (subscription) {
    try {
      await subscription.unsubscribe()
    } catch {
      // ignore
    }
  }
  clearCachedSubscription()
  try {
    await removePushSubscription(currentUser.uid, subscription)
  } catch (error) {
    console.warn('[push] Failed to remove subscription doc', error)
  }
}

export async function sendTestNotification(subscriptionOverride) {
  if (!API_BASE) {
    throw new Error('VITE_API_BASE must point to the Vercel API origin')
  }

  const subscription = subscriptionOverride || getCachedSubscription()
  if (!subscription) {
    throw new Error('Ingen lokal push-subscription fundet')
  }

  const res = await fetch(`${API_BASE}/api/sendPush`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'test',
      subscription,
      data: { url: '/' }
    })
  })

  const payload = await res.json().catch(() => ({}))
  if (!res.ok || payload.ok === false) {
    const error = payload.error || res.statusText || 'Ukendt API-fejl'
    throw new Error(error)
  }
  return payload
}