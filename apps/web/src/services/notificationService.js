import {
  collection,
  doc,
  getDocs,
  query,
  orderBy,
  onSnapshot,
  deleteDoc,
  writeBatch,
  Timestamp
} from 'firebase/firestore'
import { db } from '../firebase'

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
 * Format timestamp to relative time string
 */
function formatTime(timestamp) {
  if (!timestamp) return ""
  const date = normalizeToDate(timestamp)
  if (!date) return ""
  
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "Lige nu"
  if (diffMins < 60) return `For ${diffMins} min siden`
  if (diffHours < 24) return `For ${diffHours} time${diffHours > 1 ? "r" : ""} siden`
  if (diffDays === 1) return "I går"
  if (diffDays < 7) return `For ${diffDays} dage siden`
  return date.toLocaleDateString("da-DK", { day: "numeric", month: "short" })
}

/**
 * Get icon for notification type
 */
function getNotificationIcon(type) {
  const icons = {
    check_in: "👋",
    drink_milestone: "🍹",
    usage_reminder: "⏰",
    new_message: "💬"
  }
  return icons[type] || "🔔"
}

/**
 * Transform Firestore notification document to UI format
 */
function transformNotification(doc) {
  const data = doc.data()
  return {
    id: doc.id,
    title: data.title || "Notifikation",
    body: data.body || "",
    meta: formatTime(data.timestamp),
    icon: getNotificationIcon(data.type),
    badge: data.read === false ? "Ny" : null,
    type: data.type,
    channelId: data.channelId,
    timestamp: data.timestamp,
    read: data.read || false,
    data: data.data || {}
  }
}

/**
 * Get all notifications for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of notification documents
 */
export async function getNotifications(userId) {
  if (!userId) {
    throw new Error('userId er påkrævet')
  }
  
  const notificationsRef = collection(db, 'notifications', userId, 'items')
  const q = query(
    notificationsRef,
    orderBy('timestamp', 'desc')
  )
  
  const querySnapshot = await getDocs(q)
  return querySnapshot.docs.map(doc => transformNotification(doc))
}

/**
 * Subscribe to real-time notification updates for a user
 * @param {string} userId - User ID
 * @param {Function} callback - Callback function that receives notifications array
 * @returns {Function} Unsubscribe function
 */
export function subscribeToNotifications(userId, callback) {
  if (!userId) {
    console.error('userId er påkrævet for notification subscription')
    return () => {}
  }
  
  const notificationsRef = collection(db, 'notifications', userId, 'items')
  const q = query(
    notificationsRef,
    orderBy('timestamp', 'desc')
  )
  
  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const notifications = snapshot.docs.map(doc => transformNotification(doc))
      callback(notifications)
    },
    (error) => {
      console.error('Error subscribing to notifications:', error)
      callback([])
    }
  )
  
  return unsubscribe
}

/**
 * Get unread notification count for a user (across all channels)
 * @param {string} userId - User ID
 * @returns {Promise<number>} Number of unread notifications
 */
export async function getUnreadNotificationCount(userId) {
  if (!userId) {
    return 0
  }
  
  try {
    const notificationsRef = collection(db, 'notifications', userId, 'items')
    const q = query(
      notificationsRef,
      orderBy('timestamp', 'desc')
    )
    
    const snapshot = await getDocs(q)
    let unreadCount = 0
    
    snapshot.forEach(doc => {
      const data = doc.data()
      if (data.read === false || data.read === undefined) {
        unreadCount++
      }
    })
    
    return unreadCount
  } catch (error) {
    console.error('Error getting unread notification count:', error)
    return 0
  }
}

/**
 * Delete all notifications for a user
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
export async function deleteAllNotifications(userId) {
  if (!userId) {
    throw new Error('userId er påkrævet')
  }
  
  try {
    const notificationsRef = collection(db, 'notifications', userId, 'items')
    
    // Delete in batches of 500 (Firestore batch limit)
    let hasMore = true
    while (hasMore) {
      const snapshot = await getDocs(notificationsRef)
      
      if (snapshot.empty) {
        hasMore = false
        break
      }
      
      const batch = writeBatch(db)
      let batchCount = 0
      
      snapshot.forEach((doc) => {
        if (batchCount < 500) {
          batch.delete(doc.ref)
          batchCount++
        }
      })
      
      if (batchCount > 0) {
        await batch.commit()
      }
      
      // If we processed fewer than 500, we're done
      if (batchCount < 500) {
        hasMore = false
      }
    }
  } catch (error) {
    console.error('Error deleting all notifications:', error)
    throw error
  }
}

