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

const RESET_BOUNDARY_HOURS = [0, 12]
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
  const targetHour = zonedHour >= RESET_BOUNDARY_HOURS[1]
    ? RESET_BOUNDARY_HOURS[1]
    : RESET_BOUNDARY_HOURS[0]
  boundary.setUTCHours(targetHour, 0, 0, 0)
  return shiftDateByOffset(boundary, -offsetMs)
}

export function getNextResetBoundary(now = new Date()) {
  const offsetMs = getTimeZoneOffsetMs(now)
  const zoned = shiftDateByOffset(now, offsetMs)
  const boundary = new Date(zoned)
  const zonedHour = boundary.getUTCHours()
  const targetHour = zonedHour < RESET_BOUNDARY_HOURS[1]
    ? RESET_BOUNDARY_HOURS[1]
    : 24
  boundary.setUTCHours(targetHour, 0, 0, 0)
  return shiftDateByOffset(boundary, -offsetMs)
}

export function getSladeshCooldownState(userData = {}, now = new Date()) {
  const lastSentAt = normalizeToDate(userData.lastSladeshSentAt)
  const blockStart = getLatestResetBoundary(now)
  const blockEnd = getNextResetBoundary(now)
  const blocked =
    !!lastSentAt &&
    lastSentAt.getTime() >= blockStart.getTime() &&
    lastSentAt.getTime() < blockEnd.getTime()

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
    // Clear location when check-in expires (at 00:00 and 12:00)
    updates.currentLocation = null
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

/**
 * Create a new user document in Firestore
 * Called automatically when a user signs up
 * @param {Object} userData - User data from signup
 * @param {string} userData.uid - Firebase Auth UID
 * @param {string} userData.email - User email
 * @param {string} userData.fullName - User's full name (required)
 * @param {string} [userData.displayName] - Optional display name (defaults to fullName)
 * @returns {Promise<void>}
 */
export async function createUser({ uid, email, fullName, displayName = null }) {
  if (!uid || !email || !fullName) {
    throw new Error('uid, email og fullName skal udfyldes for at oprette en bruger')
  }

  const userRef = doc(db, 'users', uid)
  const now = serverTimestamp()
  const initials = deriveInitials(fullName)
  const avatarGradient = generateAvatarGradient(uid)

  const userDoc = {
    uid,
    email,
    fullName,
    displayName: displayName || fullName,
    initials,
    avatarGradient,
    totalDrinks: 0,
    drinkTypes: {},
    drinkVariations: {},
    currentRunDrinkCount: 0,
    currentRunDrinkTypes: {},
    lastDrinkDayStart: null,
    lastDrinkAt: null,
    checkInStatus: false,
    lastCheckIn: null,
    lastStatusCheckedAt: now,
    sladeshSent: 0,
    sladeshReceived: 0,
    lastSladeshSentAt: null,
    joinedChannelIds: [],
    activeChannelId: null,
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
  const updates = {
    totalDrinks: increment(1),
    [`drinkTypes.${type}`]: increment(1),
    currentRunDrinkCount: increment(1),
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
      timestamp: Timestamp.now()
    },
    updatedAt: serverTimestamp(),
    lastActiveAt: serverTimestamp()
  })

  return "check-in-optimized" // Return dummy ID or void since it's unused
}

/**
 * Add a sladesh activity to user's sladesh subcollection
 * Updates user's sladesh counts
 * @param {string} userId - User ID
 * @param {Object} sladeshData - Sladesh data
 * @param {string} sladeshData.type - "sent" or "received"
 * @param {string} [sladeshData.recipientId] - If type is "sent"
 * @param {string} [sladeshData.senderId] - If type is "received"
 * @param {string} sladeshData.venue - Venue name
 * @param {Object} sladeshData.location - Location with lat/lng
 * @param {string} [sladeshData.channelId] - Optional channel ID
 * @returns {Promise<string>} Document ID of the new sladesh
 */
export async function addSladesh(userId, sladeshData) {
  // Update user's sladesh counts
  const userRef = doc(db, 'users', userId)
  const userSnap = await getDoc(userRef)
  const userData = userSnap.data()

  const updates = {
    updatedAt: serverTimestamp(),
    lastActiveAt: serverTimestamp()
  }

  if (sladeshData.type === 'sent') {
    updates.sladeshSent = (userData.sladeshSent || 0) + 1
    updates.lastSladeshSentAt = serverTimestamp()
  } else if (sladeshData.type === 'received') {
    updates.sladeshReceived = (userData.sladeshReceived || 0) + 1
  }

  await updateDoc(userRef, updates)

  return "sladesh-optimized"
}

/**
 * Update user's current location
 * @param {string} userId - User ID
 * @param {Object} locationData - Location data
 * @param {number} locationData.lat - Latitude
 * @param {number} locationData.lng - Longitude
 * @param {string} locationData.venue - Venue name
 * @returns {Promise<void>}
 */
export async function updateUserLocation(userId, locationData) {
  const userRef = doc(db, 'users', userId)
  await updateDoc(userRef, {
    currentLocation: {
      lat: locationData.lat,
      lng: locationData.lng,
      venue: locationData.venue,
      timestamp: serverTimestamp()
    },
    updatedAt: serverTimestamp(),
    lastActiveAt: serverTimestamp()
  })
}

/**
 * DEV ONLY: Reset all drink-related fields for a user
 * Resets totalDrinks, currentRunDrinkCount, drinkTypes, and drinkVariations
 * Does not affect auth or other user fields
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
export async function resetDrinks(userId) {
  const userRef = doc(db, 'users', userId)
  await updateDoc(userRef, {
    totalDrinks: 0,
    currentRunDrinkCount: 0,
    drinkTypes: {},
    drinkVariations: {},
    updatedAt: serverTimestamp(),
    lastActiveAt: serverTimestamp()
  })
}

/**
 * Reset only the current run's drink count and variations
 * Preserves totalDrinks (lifetime count)
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
export async function resetCurrentRun(userId) {
  const userRef = doc(db, 'users', userId)
  await updateDoc(userRef, {
    currentRunDrinkCount: 0,
    drinkVariations: {},
    currentLocation: null,
    updatedAt: serverTimestamp(),
    lastActiveAt: serverTimestamp()
  })
}
