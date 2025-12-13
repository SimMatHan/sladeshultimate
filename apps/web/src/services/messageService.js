import {
  collection,
  doc,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  onSnapshot,
  where,
  Timestamp,
  serverTimestamp,
  getDoc,
  updateDoc,
  increment
} from 'firebase/firestore'
import { db } from '../firebase'
import { getUser } from './userService'
import { getLatestResetBoundary, getNextResetBoundary } from './userService'

const MESSAGES_PER_PERIOD = 3

function calculateQuotaFromUserData(userData = {}, now = new Date()) {
  const lastReset = normalizeToDate(userData.lastMessagePeriodReset)
  const latestBoundary = getLatestResetBoundary(now)
  const resetNeeded = !lastReset || lastReset.getTime() < latestBoundary.getTime()
  const used = resetNeeded ? 0 : userData.messageCount || 0
  const remaining = Math.max(0, MESSAGES_PER_PERIOD - used)

  return {
    used,
    limit: MESSAGES_PER_PERIOD,
    remaining,
    canSend: remaining > 0
  }
}

/**
 * Normalize date value to Date object
 */
function normalizeToDate(value) {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value.toDate === 'function') {
    return value.toDate()
  }
  if (typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000)
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/**
 * Ensure message quota is reset if period has expired
 * @param {string} userId - User ID
 * @param {Object} userData - User data from Firestore
 * @returns {Promise<Object>} Updated user data with reset quota if needed
 */
async function ensureMessageQuotaReset(userId, userData, now = new Date()) {
  const lastReset = normalizeToDate(userData.lastMessagePeriodReset)
  const latestBoundary = getLatestResetBoundary(now)
  
  // If no reset timestamp or it's before the latest boundary, reset is needed
  if (!lastReset || lastReset.getTime() < latestBoundary.getTime()) {
    const userRef = doc(db, 'users', userId)
    const boundaryTimestamp = Timestamp.fromDate(latestBoundary)
    
    await updateDoc(userRef, {
      messageCount: 0,
      lastMessagePeriodReset: boundaryTimestamp,
      updatedAt: serverTimestamp(),
      lastActiveAt: serverTimestamp()
    })
    
    return {
      ...userData,
      messageCount: 0,
      lastMessagePeriodReset: boundaryTimestamp
    }
  }
  
  return userData
}

/**
 * Get message quota status for a user
 * @param {string} userId - User ID
 * @returns {Promise<{used: number, limit: number, remaining: number, canSend: boolean}>}
 */
export async function getMessageQuota(userId) {
  const userData = await getUser(userId)
  if (!userData) {
    throw new Error('Bruger blev ikke fundet')
  }
  
  const updatedUserData = await ensureMessageQuotaReset(userId, userData)
  return calculateQuotaFromUserData(updatedUserData)
}

/**
 * Send a message to a channel
 * @param {string} channelId - Channel ID
 * @param {string} userId - User ID
 * @param {string} userName - User name for display
 * @param {string} content - Message content
 * @returns {Promise<string>} Message document ID
 */
export async function sendMessage(channelId, userId, userName, content) {
  if (!channelId || !userId || !userName || !content || !content.trim()) {
    throw new Error('channelId, userId, userName og content skal udfyldes for at sende en besked')
  }
  
  // Check quota before sending
  const quota = await getMessageQuota(userId)
  if (!quota.canSend) {
    throw new Error(`Du har brugt alle ${MESSAGES_PER_PERIOD} beskeder for denne periode. Prøv igen efter ${getNextResetBoundary(new Date()).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })}`)
  }
  
  // Get user data to ensure quota is reset if needed
  const userData = await getUser(userId)
  await ensureMessageQuotaReset(userId, userData)
  
  // Create message in Firestore
  const messagesRef = collection(db, 'channels', channelId, 'messages')
  const messageDoc = {
    userId,
    userName,
    content: content.trim(),
    channelId,
    timestamp: serverTimestamp(),
    editedAt: null
  }
  
  const messageRef = await addDoc(messagesRef, messageDoc)
  
  // Increment message count atomically using Firestore increment
  // This avoids race conditions and ensures the count is always accurate
  const userRef = doc(db, 'users', userId)
  await updateDoc(userRef, {
    messageCount: increment(1),
    updatedAt: serverTimestamp(),
    lastActiveAt: serverTimestamp()
  })
  
  return messageRef.id
}

/**
 * Get messages for a channel
 * @param {string} channelId - Channel ID
 * @param {number} limitCount - Maximum number of messages to retrieve (default: 50)
 * @returns {Promise<Array>} Array of message documents
 */
export async function getMessages(channelId, limitCount = 50) {
  if (!channelId) {
    throw new Error('channelId er påkrævet')
  }
  
  const messagesRef = collection(db, 'channels', channelId, 'messages')
  const q = query(
    messagesRef,
    orderBy('timestamp', 'desc'),
    limit(limitCount)
  )
  
  const querySnapshot = await getDocs(q)
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })).reverse() // Reverse to show oldest first (chronological order)
}

/**
 * Subscribe to real-time message updates for a channel
 * @param {string} channelId - Channel ID
 * @param {Function} callback - Callback function that receives messages array
 * @returns {Function} Unsubscribe function
 */
export function subscribeToMessages(channelId, callback) {
  if (!channelId) {
    console.error('channelId er påkrævet for message subscription')
    return () => {}
  }
  
  const messagesRef = collection(db, 'channels', channelId, 'messages')
  const q = query(
    messagesRef,
    orderBy('timestamp', 'desc'),
    limit(100) // Limit to last 100 messages for performance
  )
  
  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const messages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).reverse() // Reverse to show oldest first
      callback(messages)
    },
    (error) => {
      console.error('Error subscribing to messages:', error)
      callback([])
    }
  )
  
  return unsubscribe
}

export function subscribeToMessageQuota(userId, callback) {
  if (!userId) {
    return () => {}
  }

  const userRef = doc(db, 'users', userId)
  const unsubscribe = onSnapshot(
    userRef,
    (snapshot) => {
      if (!snapshot.exists()) return
      const quota = calculateQuotaFromUserData(snapshot.data())
      callback(quota)
    },
    (error) => {
      console.error('Error subscribing to message quota:', error)
    }
  )

  return unsubscribe
}

/**
 * Mark messages as seen for a channel
 * @param {string} userId - User ID
 * @param {string} channelId - Channel ID
 * @returns {Promise<void>}
 */
export async function markMessagesAsSeen(userId, channelId) {
  if (!userId || !channelId) {
    throw new Error('userId og channelId er påkrævet')
  }
  
  const userRef = doc(db, 'users', userId)
  const userSnap = await getDoc(userRef)
  
  if (!userSnap.exists()) {
    throw new Error('Bruger blev ikke fundet')
  }
  
  const userData = userSnap.data()
  const lastMessageViewedAt = userData.lastMessageViewedAt || {}
  
  // Update the timestamp for this channel
  await updateDoc(userRef, {
    lastMessageViewedAt: {
      ...lastMessageViewedAt,
      [channelId]: serverTimestamp()
    },
    updatedAt: serverTimestamp(),
    lastActiveAt: serverTimestamp()
  })
}

/**
 * Get unread message count for a channel
 * @param {string} channelId - Channel ID
 * @param {string} userId - User ID
 * @returns {Promise<number>} Number of unread messages
 */
export async function getUnreadMessageCount(channelId, userId) {
  if (!channelId || !userId) {
    return 0
  }
  
  try {
    // Get user's last viewed timestamp for this channel
    const userData = await getUser(userId)
    if (!userData) {
      return 0
    }
    
    const lastMessageViewedAt = userData.lastMessageViewedAt || {}
    const lastViewed = normalizeToDate(lastMessageViewedAt[channelId])
    
    // If never viewed, count all messages
    if (!lastViewed) {
      const messages = await getMessages(channelId, 1000)
      return messages.length
    }
    
    // Count messages after last viewed timestamp
    const messagesRef = collection(db, 'channels', channelId, 'messages')
    const lastViewedTimestamp = Timestamp.fromDate(lastViewed)
    const q = query(
      messagesRef,
      where('timestamp', '>', lastViewedTimestamp),
      orderBy('timestamp', 'desc')
    )
    
    const snapshot = await getDocs(q)
    return snapshot.size
  } catch (error) {
    console.error('Error getting unread message count:', error)
    return 0
  }
}
