import {
  collection,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  addDoc,
  Timestamp,
  increment
} from 'firebase/firestore'
import { db } from '../firebase'
import { deriveInitials, generateAvatarGradient } from '../config/firestore.schema'
import { normalizePromilleInput } from '../utils/promille'

const RESET_BOUNDARY_HOUR = 12 // Check-in/message window resets at local 12:00
const RESET_TIMEZONE = 'Europe/Copenhagen'
const DRINK_DAY_START_HOUR = 10
const TIMEZONE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: RESET_TIMEZONE,
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
})

function normalizeToDate(value) {
  // DEFENSIVE: Explicitly handle null, undefined, empty string, empty object
  // This prevents corrupt data from being treated as valid timestamps
  if (!value || value === '' || (typeof value === 'object' && Object.keys(value).length === 0 && !(value instanceof Date))) {
    return null
  }
  if (value instanceof Date) {
    // Validate the date is not Invalid Date
    return Number.isNaN(value.getTime()) ? null : value
  }
  if (typeof value.toDate === 'function') {
    const date = value.toDate()
    return Number.isNaN(date.getTime()) ? null : date
  }
  if (typeof value.seconds === 'number') {
    const date = new Date(value.seconds * 1000)
    return Number.isNaN(date.getTime()) ? null : date
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function getTimeZoneOffsetMs(date) {
  const parts = TIMEZONE_FORMATTER.formatToParts(date)
  const extracted = {}
  parts.forEach(part => {
    if (part.type !== 'literal') {
      extracted[part.type] = part.value
    }
  })
  const zonedUtc = Date.UTC(
    Number(extracted.year),
    Number(extracted.month) - 1,
    Number(extracted.day),
    Number(extracted.hour),
    Number(extracted.minute),
    Number(extracted.second)
  )
  return zonedUtc - date.getTime()
}

function shiftDateByOffset(date, offsetMs) {
  return new Date(date.getTime() + offsetMs)
}

export function getLatestResetBoundary(now = new Date()) {
  const offsetMs = getTimeZoneOffsetMs(now)
  const zoned = shiftDateByOffset(now, offsetMs)
  const boundary = new Date(zoned)
  const zonedHour = boundary.getUTCHours()

  // SLADESH BLOCKS: Two 12-hour blocks per day
  // Block 1: 00:00 - 12:00 (midnight to noon)
  // Block 2: 12:00 - 24:00 (noon to midnight)
  // This allows users to send one Sladesh in each block

  if (zonedHour >= 12) {
    // Currently in the 12:00-24:00 block, so latest boundary is 12:00 today
    boundary.setUTCHours(12, 0, 0, 0)
  } else {
    // Currently in the 00:00-12:00 block, so latest boundary is 00:00 today
    boundary.setUTCHours(0, 0, 0, 0)
  }

  return shiftDateByOffset(boundary, -offsetMs)
}

export function getNextResetBoundary(now = new Date()) {
  const offsetMs = getTimeZoneOffsetMs(now)
  const zoned = shiftDateByOffset(now, offsetMs)
  const boundary = new Date(zoned)
  const zonedHour = boundary.getUTCHours()

  // SLADESH BLOCKS: Two 12-hour blocks per day
  // Block 1: 00:00 - 12:00 (midnight to noon)
  // Block 2: 12:00 - 24:00 (noon to midnight)

  if (zonedHour >= 12) {
    // Currently in the 12:00-24:00 block, next boundary is 00:00 tomorrow
    boundary.setUTCDate(boundary.getUTCDate() + 1)
    boundary.setUTCHours(0, 0, 0, 0)
  } else {
    // Currently in the 00:00-12:00 block, next boundary is 12:00 today
    boundary.setUTCHours(12, 0, 0, 0)
  }

  return shiftDateByOffset(boundary, -offsetMs)
}

export function getSladeshCooldownState(userData = {}, now = new Date()) {
  const lastSentAt = normalizeToDate(userData.lastSladeshSentAt)
  const blockStart = getLatestResetBoundary(now)
  const blockEnd = getNextResetBoundary(now)

  // DEBUG: Log the raw value to help identify corrupt data
  if (userData.lastSladeshSentAt !== null && userData.lastSladeshSentAt !== undefined) {
    console.log('[getSladeshCooldownState] Raw lastSladeshSentAt:', userData.lastSladeshSentAt)
    console.log('[getSladeshCooldownState] Normalized lastSentAt:', lastSentAt)
  }

  // DEFENSIVE: Only block if we have a valid, non-null date
  // This ensures corrupt data (empty objects, invalid timestamps) doesn't incorrectly block users
  // A user should ONLY be blocked if they have a valid timestamp within the current 12-hour block
  if (!lastSentAt || !(lastSentAt instanceof Date) || Number.isNaN(lastSentAt.getTime())) {
    return {
      blocked: false,
      canSend: true,
      lastSentAt: null,
      blockStartedAt: blockStart,
      blockEndsAt: blockEnd
    }
  }

  // Check if the valid timestamp falls within the current block
  const blocked =
    lastSentAt.getTime() >= blockStart.getTime() &&
    lastSentAt.getTime() < blockEnd.getTime()

  console.log('[getSladeshCooldownState] Cooldown check:', {
    blocked,
    lastSentAt: lastSentAt.toISOString(),
    blockStart: blockStart.toISOString(),
    blockEnd: blockEnd.toISOString()
  })

  return {
    blocked,
    canSend: !blocked,
    lastSentAt,
    blockStartedAt: blockStart,
    blockEndsAt: blockEnd
  }
}

export function getLatestDrinkDayBoundary(now = new Date()) {
  const offsetMs = getTimeZoneOffsetMs(now)
  const zoned = shiftDateByOffset(now, offsetMs)
  const boundary = new Date(zoned)
  const zonedHour = boundary.getUTCHours()
  // If at or after 10:00 today, use 10:00 today; otherwise 10:00 yesterday
  boundary.setUTCHours(DRINK_DAY_START_HOUR, 0, 0, 0)
  if (zonedHour < DRINK_DAY_START_HOUR) {
    boundary.setUTCDate(boundary.getUTCDate() - 1)
  }
  return shiftDateByOffset(boundary, -offsetMs)
}

export function getNextDrinkDayBoundary(now = new Date()) {
  const offsetMs = getTimeZoneOffsetMs(now)
  const zoned = shiftDateByOffset(now, offsetMs)
  const boundary = new Date(zoned)
  const zonedHour = boundary.getUTCHours()
  // If before 10:00 today, next boundary is 10:00 today; otherwise 10:00 tomorrow
  boundary.setUTCHours(DRINK_DAY_START_HOUR, 0, 0, 0)
  if (zonedHour >= DRINK_DAY_START_HOUR) {
    boundary.setUTCDate(boundary.getUTCDate() + 1)
  }
  return shiftDateByOffset(boundary, -offsetMs)
}

function isCheckInExpired(userData, now = new Date()) {
  const isCheckedIn = !!userData.checkInStatus
  if (!isCheckedIn) {
    return false
  }
  const lastCheckInDate = normalizeToDate(userData.lastCheckIn)
  if (!lastCheckInDate) {
    return true
  }
  const latestBoundary = getLatestResetBoundary(now)
  return lastCheckInDate < latestBoundary
}

async function refreshCheckInStatus(userRef, userData, now = new Date()) {
  const expired = isCheckInExpired(userData, now)
  const missingStatusTimestamp = !normalizeToDate(userData.lastStatusCheckedAt)

  if (!expired && !missingStatusTimestamp) {
    return userData
  }

  const clientNow = Timestamp.now()
  const updates = {
    lastStatusCheckedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastActiveAt: serverTimestamp()
  }

  if (expired) {
    updates.checkInStatus = false
    // Clear location when check-in expires (aligned to the noon reset boundary)
    updates.currentLocation = null
  }

  // Also reset message quota if period has expired (same boundaries as check-in)
  const lastMessageReset = normalizeToDate(userData.lastMessagePeriodReset)
  const latestBoundary = getLatestResetBoundary(now)
  if (!lastMessageReset || lastMessageReset.getTime() < latestBoundary.getTime()) {
    updates.messageCount = 0
    updates.lastMessagePeriodReset = Timestamp.fromDate(latestBoundary)
  }

  await updateDoc(userRef, updates)

  const nextData = {
    ...userData,
    lastStatusCheckedAt: clientNow,
    updatedAt: clientNow,
    lastActiveAt: clientNow
  }

  if (expired) {
    nextData.checkInStatus = false
    // Clear location when check-in expires
    nextData.currentLocation = null
  }

  // Update message quota in returned data if it was reset
  if (!lastMessageReset || lastMessageReset.getTime() < latestBoundary.getTime()) {
    nextData.messageCount = 0
    nextData.lastMessagePeriodReset = Timestamp.fromDate(latestBoundary)
  }

  return nextData
}

export async function ensureFreshCheckInStatus(userId, userData, now = new Date()) {
  const userRef = doc(db, 'users', userId)
  return refreshCheckInStatus(userRef, userData, now)
}

function isDrinkDayExpired(userData, now = new Date()) {
  const lastDrinkDayStart = normalizeToDate(userData.lastDrinkDayStart)
  if (!lastDrinkDayStart) {
    return true // Treat as expired if never initialized
  }
  const latestBoundary = getLatestDrinkDayBoundary(now)
  return lastDrinkDayStart.getTime() < latestBoundary.getTime()
}

async function refreshDrinkDayStatus(userRef, userData, now = new Date()) {
  const expired = isDrinkDayExpired(userData, now)

  if (!expired) {
    return userData
  }

  const latestBoundary = getLatestDrinkDayBoundary(now)
  const clientNow = Timestamp.now()
  const boundaryTimestamp = Timestamp.fromDate(latestBoundary)

  // Reset only per-run fields (drinkVariations and currentRunDrinkCount)
  // Do NOT reset totalDrinks or drinkTypes (these stay cumulative)
  const updates = {
    currentRunDrinkCount: 0,
    drinkVariations: {},
    lastDrinkDayStart: boundaryTimestamp,
    updatedAt: serverTimestamp(),
    lastActiveAt: serverTimestamp()
  }

  await updateDoc(userRef, updates)

  const nextData = {
    ...userData,
    currentRunDrinkCount: 0,
    drinkVariations: {},
    lastDrinkDayStart: boundaryTimestamp,
    updatedAt: clientNow,
    lastActiveAt: clientNow
  }

  return nextData
}

// Reset the current drink run manually (used by UI reset action)
export async function resetCurrentRun(userId, now = new Date()) {
  const userRef = doc(db, 'users', userId)
  const boundary = Timestamp.fromDate(getLatestDrinkDayBoundary(now))
  await updateDoc(userRef, {
    currentRunDrinkCount: 0,
    drinkVariations: {},
    lastDrinkDayStart: boundary,
    totalRunResets: increment(1),
    updatedAt: serverTimestamp(),
    lastActiveAt: serverTimestamp()
  })
}

function normalizeUsername(username = '') {
  return username.trim().toLowerCase()
}

/**
 * Create a new user document in Firestore
 * Called automatically when a user signs up
 * @param {Object} userData - User data from signup
 * @param {string} userData.uid - Firebase Auth UID
 * @param {string} userData.email - User email
 * @param {string} userData.fullName - User's full name (required)
 * @param {string} userData.username - User's unique username (required)
 * @param {string} [userData.displayName] - Optional display name (defaults to fullName)
 * @param {Object} [userData.promilleSettings] - Optional promille counter inputs
 * @returns {Promise<void>}
 */
export async function createUser({ uid, email, fullName, username, displayName = null, promilleSettings = null }) {
  if (!uid || !email || !fullName || !username) {
    throw new Error('uid, email, fullName og username skal udfyldes for at oprette en bruger')
  }

  const userRef = doc(db, 'users', uid)
  const now = serverTimestamp()
  const initials = deriveInitials(fullName)
  const avatarGradient = generateAvatarGradient(uid)
  const normalizedUsername = normalizeUsername(username)
  const promille = normalizePromilleInput(promilleSettings || {})

  const userDoc = {
    uid,
    email,
    fullName,
    username: normalizedUsername,
    displayName: displayName || fullName,
    initials,
    avatarGradient,
    onboardingCompleted: false,
    totalDrinks: 0,
    drinkTypes: {},
    drinkVariations: {},
    currentRunDrinkCount: 0,
    currentRunDrinkTypes: {},
    achievements: {},
    totalRunResets: 0,
    lastDrinkDayStart: null,
    lastDrinkAt: null,
    checkInStatus: false,
    lastCheckIn: null,
    lastStatusCheckedAt: now,
    sladeshSent: 0,
    sladeshReceived: 0,
    lastSladeshSentAt: null,
    messageCount: 0,
    lastMessagePeriodReset: null,
    lastMessageViewedAt: {},
    joinedChannelIds: [],
    activeChannelId: null,
    // Promille data saved for the optional counter experience
    promille,
    createdAt: now,
    updatedAt: now,
    lastActiveAt: now
  }

  await setDoc(userRef, userDoc)
  return userDoc
}

/**
 * Update user document
 * @param {string} userId - User ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<void>}
 */
export async function updateUser(userId, updates) {
  const userRef = doc(db, 'users', userId)

  // If fullName is being updated, also update initials
  if (updates.fullName) {
    updates.initials = deriveInitials(updates.fullName)
  }
  if (typeof updates.username === 'string') {
    updates.username = normalizeUsername(updates.username)
  }

  await updateDoc(userRef, {
    ...updates,
    updatedAt: serverTimestamp(),
    lastActiveAt: serverTimestamp()
  })
}

/**
 * Get user document by ID
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} User document data or null if not found
 */
export async function getUser(userId) {
  const userRef = doc(db, 'users', userId)
  const userSnap = await getDoc(userRef)

  if (!userSnap.exists()) {
    return null
  }

  const userData = userSnap.data()
  const checkInRefreshed = await refreshCheckInStatus(userRef, userData)
  const drinkDayRefreshed = await refreshDrinkDayStatus(userRef, checkInRefreshed)
  return { id: userSnap.id, ...drinkDayRefreshed }
}

/**
 * Search users by full name
 * Note: Requires Firestore index on users.fullName
 * @param {string} searchTerm - Search term (searches names starting with term)
 * @param {number} maxResults - Maximum number of results (default: 20)
 * @returns {Promise<Array>} Array of user documents
 */
export async function searchUsersByName(searchTerm, maxResults = 20) {
  if (!searchTerm || searchTerm.trim().length === 0) {
    return []
  }

  const searchLower = searchTerm.toLowerCase().trim()
  const usersRef = collection(db, 'users')

  // Note: This is a simple prefix search. For more advanced search,
  // consider using Algolia or implementing a searchable field with lowercase version
  const q = query(
    usersRef,
    where('fullName', '>=', searchTerm),
    where('fullName', '<=', searchTerm + '\uf8ff'),
    orderBy('fullName'),
    limit(maxResults)
  )

  const querySnapshot = await getDocs(q)
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

/**
 * Add a drink to user's drink tracking
 * Updates user's total drinks count, drink types, and drink variations using Firestore increment
 * @param {string} userId - User ID
 * @param {string} type - Drink type (e.g., "beer", "shot", "cocktail")
 * @param {string} variation - Drink variation (e.g., "Lager", "IPA", "Mojito")
 * @returns {Promise<void>}
 */
export async function addDrink(userId, type, variation) {
  const userRef = doc(db, 'users', userId)

  // Refresh drink day status before adding (checks if new day started and resets per-run fields)
  const userSnap = await getDoc(userRef)
  if (!userSnap.exists()) {
    throw new Error(`Bruger ${userId} blev ikke fundet`)
  }

  const userData = userSnap.data()
  const refreshedData = await refreshDrinkDayStatus(userRef, userData)

  // Read current drinkVariations to handle nested path initialization
  const currentDrinkVariations = refreshedData.drinkVariations || {}

  // Build updates using increment for atomic operations
  // DATA FLOW: currentRunDrinkCount is computed here using Firestore increment
  // This ensures atomic updates and prevents race conditions
  // The value is stored in the user document and read by Leaderboard via real-time subscriptions
  // This fixes the "stuck at 0" bug by ensuring the count is always updated atomically
  const updates = {
    totalDrinks: increment(1),
    [`drinkTypes.${type}`]: increment(1),
    currentRunDrinkCount: increment(1), // This is the source of truth for currentRunDrinkCount
    lastDrinkAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastActiveAt: serverTimestamp()
  }

  // Handle nested drinkVariations path
  // Firestore increment will create nested paths if parent structure exists
  // Ensure parent structure exists first if needed
  const typeVariations = currentDrinkVariations[type] || {}

  // If the type doesn't exist in drinkVariations, initialize it
  if (!currentDrinkVariations.hasOwnProperty(type)) {
    // Initialize the type structure first
    const newDrinkVariations = { ...currentDrinkVariations }
    newDrinkVariations[type] = { [variation]: 1 }
    updates.drinkVariations = newDrinkVariations
  } else {
    // Type exists, can use increment on the nested path
    // Firestore will create the variation key if it doesn't exist
    updates[`drinkVariations.${type}.${variation}`] = increment(1)
  }

  await updateDoc(userRef, updates)
}

/**
 * Remove a drink from user's drink tracking
 * Decrements user's total drinks count, drink types, and drink variations using Firestore increment
 * @param {string} userId - User ID
 * @param {string} type - Drink type (e.g., "beer", "shot", "cocktail")
 * @param {string} variation - Drink variation (e.g., "Lager", "IPA", "Mojito")
 * @returns {Promise<void>}
 */
export async function removeDrink(userId, type, variation) {
  const userRef = doc(db, 'users', userId)

  // Refresh drink day status first
  const userSnap = await getDoc(userRef)
  if (!userSnap.exists()) {
    throw new Error(`Bruger ${userId} blev ikke fundet`)
  }

  const userData = userSnap.data()
  const refreshedData = await refreshDrinkDayStatus(userRef, userData)

  // Check current value of drinkVariations[type][variation]
  const drinkVariations = refreshedData.drinkVariations || {}
  const typeVariations = drinkVariations[type] || {}
  const currentVariationCount = typeVariations[variation] || 0

  // If value is 0 or doesn't exist, do nothing (never write negative values)
  if (currentVariationCount <= 0) {
    return
  }

  // Use increment(-1) for all fields
  const updates = {
    totalDrinks: increment(-1),
    [`drinkTypes.${type}`]: increment(-1),
    [`drinkVariations.${type}.${variation}`]: increment(-1),
    currentRunDrinkCount: increment(-1),
    updatedAt: serverTimestamp(),
    lastActiveAt: serverTimestamp()
  }

  // Note: Do NOT update lastDrinkAt when removing (keep most recent timestamp)

  await updateDoc(userRef, updates)
}

export async function recordAchievementUnlock(userId, achievementId, hasUnlockedBefore = false) {
  if (!userId || !achievementId) {
    throw new Error('recordAchievementUnlock requires userId and achievementId')
  }

  const userRef = doc(db, 'users', userId)
  const updates = {
    updatedAt: serverTimestamp(),
    lastActiveAt: serverTimestamp()
  }

  if (hasUnlockedBefore) {
    updates[`achievements.${achievementId}.count`] = increment(1)
    updates[`achievements.${achievementId}.lastUnlockedAt`] = serverTimestamp()
  } else {
    updates[`achievements.${achievementId}`] = {
      count: 1,
      firstUnlockedAt: serverTimestamp(),
      lastUnlockedAt: serverTimestamp()
    }
  }

  await updateDoc(userRef, updates)
}

/**
 * Add a check-in to user's checkIns subcollection
 * Updates user's check-in status and location
 * @param {string} userId - User ID
 * @param {Object} checkInData - Check-in data
 * @param {string} checkInData.venue - Venue name
 * @param {Object} checkInData.location - Location with lat/lng
 * @param {string} [checkInData.channelId] - Optional channel ID
 * @returns {Promise<string>} Document ID of the new check-in
 */
export async function addCheckIn(userId, checkInData) {
  // Update user's check-in status and location
  const userRef = doc(db, 'users', userId)
  await updateDoc(userRef, {
    checkInStatus: true,
    lastCheckIn: serverTimestamp(),
    lastCheckInVenue: checkInData.venue,
    lastStatusCheckedAt: serverTimestamp(),
    currentLocation: {
      ...checkInData.location,
      venue: checkInData.venue,
      lastActiveAt: serverTimestamp()
    }
  })
}

/**
 * Add a Sladesh challenge
 * Creates a challenge document and updates sender/receiver stats
 * @param {string} senderId - Sender user ID
 * @param {Object} sladeshData - Sladesh data
 * @param {string} sladeshData.type - Type (should be "sent")
 * @param {string} sladeshData.recipientId - Recipient user ID
 * @param {string} sladeshData.venue - Venue name
 * @param {Object} sladeshData.location - Location with lat/lng
 * @param {string} [sladeshData.channelId] - Optional channel ID
 * @param {string} [sladeshData.challengeId] - Optional fixed document ID (for optimistic UI)
 * @param {number} [sladeshData.deadlineAtMs] - Optional deadline timestamp in ms
 * @returns {Promise<string>} Document ID of the new challenge
 */
export async function addSladesh(senderId, sladeshData) {
  const {
    recipientId,
    venue,
    location,
    channelId,
    senderName = null,
    recipientName = null,
    challengeId = null,
    deadlineAtMs = null
  } = sladeshData
  const deadlineAt = Timestamp.fromMillis(deadlineAtMs ?? Date.now() + 10 * 60 * 1000) // 10 minutes from send time

  // Create challenge document
  const challengesRef = collection(db, 'sladeshChallenges')
  const payload = {
    senderId,
    senderName: senderName || null,
    recipientId,
    recipientName: recipientName || null,
    venue,
    location,
    channelId: channelId || null,
    deadlineAt,
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }

  let challengeDoc
  if (challengeId) {
    const docRef = doc(challengesRef, challengeId)
    await setDoc(docRef, payload)
    challengeDoc = docRef
  } else {
    challengeDoc = await addDoc(challengesRef, payload)
  }

  // Update sender stats
  const senderRef = doc(db, 'users', senderId)
  await updateDoc(senderRef, {
    sladeshSent: increment(1),
    lastSladeshSentAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastActiveAt: serverTimestamp()
  })

  // Update recipient stats
  const recipientRef = doc(db, 'users', recipientId)
  await updateDoc(recipientRef, {
    sladeshReceived: increment(1),
    updatedAt: serverTimestamp()
  })

  return challengeDoc.id
}

/**
 * Admin/dev: Reset Sladesh state for a user
 * - Clears counters and lastSladeshSentAt
 * - Marks any pending/in-progress challenges (as sender or receiver) as failed
 */
export async function resetSladeshState(userId) {
  const userRef = doc(db, 'users', userId)
  await updateDoc(userRef, {
    sladeshSent: 0,
    sladeshReceived: 0,
    lastSladeshSentAt: null,
    updatedAt: serverTimestamp(),
    lastActiveAt: serverTimestamp()
  })

  const challengesRef = collection(db, 'sladeshChallenges')
  const qRecipient = query(challengesRef, where('recipientId', '==', userId))
  const qSender = query(challengesRef, where('senderId', '==', userId))

  const [recipientSnap, senderSnap] = await Promise.all([getDocs(qRecipient), getDocs(qSender)])
  const updates = [...recipientSnap.docs, ...senderSnap.docs]
  const now = serverTimestamp()

  await Promise.all(
    updates.map((docSnap) => {
      const data = docSnap.data() || {}
      const status = (data.status || '').toString().toLowerCase()
      if (status === 'completed' || status === 'failed') return Promise.resolve()
      return updateDoc(doc(db, 'sladeshChallenges', docSnap.id), {
        status: 'failed',
        updatedAt: now
      })
    })
  )
}

/**
 * Update user's location
 * @param {string} userId - User ID
 * @param {Object} locationData - Location data with lat, lng, and venue
 * @returns {Promise<void>}
 */
export async function updateUserLocation(userId, locationData) {
  const userRef = doc(db, 'users', userId)
  await updateDoc(userRef, {
    currentLocation: {
      lat: locationData.lat,
      lng: locationData.lng,
      venue: locationData.venue,
      lastActiveAt: serverTimestamp()
    },
    updatedAt: serverTimestamp(),
    lastActiveAt: serverTimestamp()
  })
}

/**
 * DEV ONLY: Reset all achievement counts for a user
 * Removes all achievement data from the user document
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
export async function resetAchievements(userId) {
  const userRef = doc(db, 'users', userId)
  await updateDoc(userRef, {
    achievements: {},
    updatedAt: serverTimestamp(),
    lastActiveAt: serverTimestamp()
  })
}

/**
 * DEV ONLY: Clean up corrupt lastSladeshSentAt values
 * Sets lastSladeshSentAt to null for users where it's invalid
 * This fixes the bug where users are incorrectly blocked from sending Sladesh
 * @param {string} userId - User ID
 * @returns {Promise<{cleaned: boolean, oldValue: any}>}
 */
export async function cleanupSladeshTimestamp(userId) {
  const userRef = doc(db, 'users', userId)
  const userSnap = await getDoc(userRef)

  if (!userSnap.exists()) {
    throw new Error(`User ${userId} not found`)
  }

  const userData = userSnap.data()
  const lastSentAt = normalizeToDate(userData.lastSladeshSentAt)

  // If normalizeToDate returns null but the field exists and is not null, clean it up
  if (!lastSentAt && userData.lastSladeshSentAt !== null && userData.lastSladeshSentAt !== undefined) {
    console.log(`[cleanupSladeshTimestamp] Cleaning up corrupt lastSladeshSentAt for user ${userId}:`, userData.lastSladeshSentAt)
    await updateDoc(userRef, {
      lastSladeshSentAt: null,
      updatedAt: serverTimestamp()
    })
    return { cleaned: true, oldValue: userData.lastSladeshSentAt }
  }

  return { cleaned: false, oldValue: userData.lastSladeshSentAt }
}
