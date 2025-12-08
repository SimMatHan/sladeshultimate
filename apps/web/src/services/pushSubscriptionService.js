import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  getDocs,
  serverTimestamp
} from 'firebase/firestore'
import { db } from '../firebase'

const SUB_COLLECTION = 'pushSubscriptions'

const toHex = (buffer) => Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, '0')).join('')

async function hashEndpoint(endpoint = '') {
  if (!endpoint) return 'missing-endpoint'
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    const encoder = new TextEncoder()
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', encoder.encode(endpoint))
    return toHex(hashBuffer)
  }
  // Fallback when SubtleCrypto is unavailable
  const base64 =
    typeof btoa === 'function'
      ? btoa(endpoint)
      : typeof Buffer !== 'undefined'
        ? Buffer.from(endpoint).toString('base64')
        : endpoint
  return base64.replace(/[^a-z0-9]/gi, '').slice(0, 64) || 'fallback-hash'
}

async function getSubscriptionDocRef(userId, subscription) {
  if (!userId) throw new Error('userId is required for push subscription storage')
  if (!subscription?.endpoint) throw new Error('subscription endpoint mangler')
  const hash = await hashEndpoint(subscription.endpoint)
  return doc(collection(doc(db, 'users', userId), SUB_COLLECTION), hash)
}

function normalizeSubscription(subscription) {
  if (!subscription) return null
  if (typeof subscription.toJSON === 'function') {
    return subscription.toJSON()
  }
  const { endpoint, expirationTime } = subscription
  const keys = subscription.keys || subscription.keys?.toJSON?.() || null
  return { endpoint, expirationTime, keys }
}

export async function upsertPushSubscription(userId, subscription, metadata = {}) {
  const normalized = normalizeSubscription(subscription)
  if (!normalized) throw new Error('Subscription missing')
  const docRef = await getSubscriptionDocRef(userId, normalized)
  const snapshot = await getDoc(docRef)
  const now = serverTimestamp()
  const payload = {
    endpoint: normalized.endpoint,
    keys: normalized.keys,
    expirationTime: normalized.expirationTime || null,
    metadata,
    updatedAt: now,
    lastUsedAt: now
  }
  if (!snapshot.exists()) {
    payload.createdAt = now
  }
  await setDoc(docRef, payload, { merge: true })
  return docRef.id
}

export async function removePushSubscription(userId, subscription) {
  const normalized = normalizeSubscription(subscription)
  if (!normalized) return
  const docRef = await getSubscriptionDocRef(userId, normalized)
  await deleteDoc(docRef)
}

export async function listPushSubscriptions(userId) {
  if (!userId) return []
  const subsRef = collection(doc(db, 'users', userId), SUB_COLLECTION)
  const snapshot = await getDocs(subsRef)
  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data()
  }))
}

export async function getFirstPushSubscription(userId) {
  if (!userId) return null
  const subsRef = collection(doc(db, 'users', userId), SUB_COLLECTION)
  const snapshot = await getDocs(subsRef)
  if (snapshot.empty) return null
  const firstDoc = snapshot.docs[0]
  return {
    id: firstDoc.id,
    ...firstDoc.data()
  }
}

