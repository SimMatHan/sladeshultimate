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
  increment,
  runTransaction,
  getDocFromServer
} from 'firebase/firestore'
import { db } from '../firebase'
import { deriveInitials, generateAvatarGradient } from '../config/firestore.schema'
import { normalizePromilleInput } from '../utils/promille'
import { NON_DRINK_CATEGORY_IDS } from '../constants/drinks'

// Single active Sladesh guard: used as an error code when a receiver is already locked
export const SLADESH_ACTIVE_ERROR = 'receiver_already_active'

const RESOLVED_SLADESH_STATUSES = new Set(['completed', 'failed', 'expired'])
const isResolvedSladeshStatus = (status = '') => RESOLVED_SLADESH_STATUSES.has(status)
const isActiveSladeshStatus = (status = '') => !isResolvedSladeshStatus(status)

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

const NON_DRINK_CATEGORY_ID_SET = new Set(NON_DRINK_CATEGORY_IDS)
const isNonDrinkCategory = (categoryId) => NON_DRINK_CATEGORY_ID_SET.has(categoryId)

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

function getDrinkStateFromSnapshot(userData = {}) {
  return {
    drinkVariations: userData.drinkVariations || {},
    allTimeDrinkVariations: userData.allTimeDrinkVariations || {},
    drinkTypes: userData.drinkTypes || {},
    totalDrinks: userData.totalDrinks || 0,
    currentRunDrinkCount: userData.currentRunDrinkCount || 0,
    lastDrinkDayStart: userData.lastDrinkDayStart || null,
    lastDrinkAt: userData.lastDrinkAt || null
  }
}

async function fetchUserSnapshot(userRef) {
  try {
    return await getDocFromServer(userRef)
  } catch (error) {
    console.warn('[userService] Falling back to cache for user', userRef.id, error)
    return await getDoc(userRef)
  }
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
    allTimeDrinkVariations: {},
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
    sladeshCompletedCount: 0,
    sladeshFailedCount: 0,
    lastSladeshSentAt: null,
    activeSladesh: null,
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
  const userSnap = await fetchUserSnapshot(userRef)

  if (!userSnap.exists()) {
    return null
  }

  const userData = userSnap.data()
  console.info('[userService] Hydrating user data from Firestore', {
    userId,
    source: userSnap.metadata?.fromCache ? 'cache' : 'server',
    currentRunDrinkCount: userData?.currentRunDrinkCount,
    totalDrinks: userData?.totalDrinks
  })
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
 * Apply a drink delta inside a transaction to keep counters and variations in sync.
 * @param {string} userId
 * @param {string} type
 * @param {string} variation
 * @param {number} delta
 * @returns {Promise<Object>} Updated drink state
 */
async function applyDrinkDelta(userId, type, variation, delta) {
  const userRef = doc(db, 'users', userId)

  const result = await runTransaction(db, async (transaction) => {
    const userSnap = await transaction.get(userRef)
    if (!userSnap.exists()) {
      throw new Error(`Bruger ${userId} blev ikke fundet`)
    }

    const now = new Date()
    const latestBoundary = getLatestDrinkDayBoundary(now)
    const baseline = getDrinkStateFromSnapshot(userSnap.data())
    const isNonDrink = isNonDrinkCategory(type)
    const drinkDayExpired = isDrinkDayExpired(userSnap.data(), now)

    let drinkVariations = drinkDayExpired ? {} : { ...baseline.drinkVariations }
    let allTimeDrinkVariations = { ...baseline.allTimeDrinkVariations }
    let drinkTypes = { ...baseline.drinkTypes }
    let totalDrinks = baseline.totalDrinks
    let currentRunDrinkCount = drinkDayExpired ? 0 : baseline.currentRunDrinkCount
    const lastDrinkDayStart =
      drinkDayExpired || !baseline.lastDrinkDayStart
        ? Timestamp.fromDate(latestBoundary)
        : baseline.lastDrinkDayStart

    const typeVariations = { ...(drinkVariations[type] || {}) }
    const currentVariationCount = typeVariations[variation] || 0

    // Avoid negative writes
    if (delta < 0 && currentVariationCount <= 0) {
      return {
        ...baseline,
        drinkVariations,
        allTimeDrinkVariations,
        drinkTypes,
        totalDrinks,
        currentRunDrinkCount,
        lastDrinkDayStart
      }
    }

    const nextVariationCount = Math.max(0, currentVariationCount + delta)
    typeVariations[variation] = nextVariationCount
    drinkVariations[type] = typeVariations

    const allTimeTypeVariations = { ...(allTimeDrinkVariations[type] || {}) }
    const currentAllTimeCount = allTimeTypeVariations[variation] || 0
    const nextAllTimeCount = Math.max(0, currentAllTimeCount + delta)
    allTimeTypeVariations[variation] = nextAllTimeCount
    allTimeDrinkVariations[type] = allTimeTypeVariations

    if (!isNonDrink) {
      totalDrinks = Math.max(0, totalDrinks + delta)
      const typeTotal = drinkTypes[type] || 0
      drinkTypes[type] = Math.max(0, typeTotal + delta)
      currentRunDrinkCount = Math.max(0, currentRunDrinkCount + delta)
    }

    const updates = {
      drinkVariations,
      allTimeDrinkVariations,
      drinkTypes,
      totalDrinks,
      currentRunDrinkCount,
      lastDrinkDayStart,
      updatedAt: serverTimestamp(),
      lastActiveAt: serverTimestamp()
    }

    if (!isNonDrink && delta > 0) {
      updates.lastDrinkAt = serverTimestamp()
    }

    transaction.update(userRef, updates)

    return {
      drinkVariations,
      allTimeDrinkVariations,
      drinkTypes,
      totalDrinks,
      currentRunDrinkCount,
      lastDrinkDayStart,
      lastDrinkAt: !isNonDrink && delta > 0 ? Timestamp.now() : baseline.lastDrinkAt
    }
  })

  console.info('[userService] Drink mutation applied', {
    userId,
    type,
    variation,
    delta,
    totalDrinks: result.totalDrinks,
    currentRunDrinkCount: result.currentRunDrinkCount
  })

  return result
}

/**
 * Add a drink to user's drink tracking (transactional)
 * @param {string} userId - User ID
 * @param {string} type - Drink type (e.g., "beer", "shot", "cocktail")
 * @param {string} variation - Drink variation (e.g., "Lager", "IPA", "Mojito")
 * @returns {Promise<Object>} Updated drink state
 */
export async function addDrink(userId, type, variation) {
  return applyDrinkDelta(userId, type, variation, 1)
}

/**
 * Remove a drink from user's drink tracking (transactional)
 * @param {string} userId - User ID
 * @param {string} type - Drink type (e.g., "beer", "shot", "cocktail")
 * @param {string} variation - Drink variation (e.g., "Lager", "IPA", "Mojito")
 * @returns {Promise<Object>} Updated drink state
 */
export async function removeDrink(userId, type, variation) {
  return applyDrinkDelta(userId, type, variation, -1)
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
 * @param {Object} [checkInData.location] - Optional location with lat/lng
 * @param {string} [checkInData.channelId] - Optional channel ID
 * @returns {Promise<string>} Document ID of the new check-in
 */
export async function addCheckIn(userId, checkInData) {
  const userRef = doc(db, 'users', userId)
  const checkInsRef = collection(db, 'users', userId, 'checkIns')
  const timestamp = serverTimestamp()
  const hasLocation =
    checkInData.location &&
    typeof checkInData.location.lat === 'number' &&
    typeof checkInData.location.lng === 'number'
  const locationPayload = hasLocation
    ? {
      lat: checkInData.location.lat,
      lng: checkInData.location.lng,
    }
    : null

  const checkInDoc = await addDoc(checkInsRef, {
    venue: checkInData.venue,
    location: locationPayload,
    channelId: checkInData.channelId || null,
    timestamp,
  })

  await updateDoc(userRef, {
    checkInStatus: true,
    lastCheckIn: timestamp,
    lastCheckInVenue: checkInData.venue,
    lastStatusCheckedAt: serverTimestamp(),
    currentLocation: locationPayload
      ? {
        ...locationPayload,
        venue: checkInData.venue,
        timestamp,
        lastActiveAt: serverTimestamp()
      }
      : null,
    activeChannelId: checkInData.channelId || null,
    updatedAt: serverTimestamp(),
    lastActiveAt: serverTimestamp()
  })

  return checkInDoc.id
}

/**
 * Add a drink log entry with optional location data
 * @param {string} userId - User ID
 * @param {Object} logData - Drink log data
 * @param {string} logData.categoryId - Drink category ID
 * @param {string} logData.variationName - Drink variation name
 * @param {Object|null} [logData.location] - Optional location { lat, lng }
 * @param {string|null} [logData.channelId] - Optional channel ID
 * @returns {Promise<void>}
 */
export async function addDrinkLogEntry(userId, logData) {
  const drinkLogsRef = collection(db, 'users', userId, 'drinkLogs')
  const hasLocation =
    logData.location &&
    typeof logData.location.lat === 'number' &&
    typeof logData.location.lng === 'number'
  const locationPayload = hasLocation
    ? {
      lat: logData.location.lat,
      lng: logData.location.lng,
    }
    : null

  await addDoc(drinkLogsRef, {
    categoryId: logData.categoryId,
    variationName: logData.variationName,
    channelId: logData.channelId || null,
    location: locationPayload,
    timestamp: serverTimestamp(),
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
 * @param {string} [sladeshData.idempotencyKey] - Optional idempotency key (defaults to challengeId)
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
    deadlineAtMs = null,
    idempotencyKey = null
  } = sladeshData
  const deadlineAt = Timestamp.fromMillis(deadlineAtMs ?? Date.now() + 10 * 60 * 1000) // 10 minutes from send time

  const challengesRef = collection(db, 'sladeshChallenges')
  const challengeRef = challengeId ? doc(challengesRef, challengeId) : doc(challengesRef)
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
    idempotencyKey: idempotencyKey || challengeRef.id,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }

  // Atomic guard: ensure receiver only gets one active Sladesh at a time
  await runTransaction(db, async (transaction) => {
    const recipientRef = doc(db, 'users', recipientId)
    const senderRef = doc(db, 'users', senderId)
    const recipientSnap = await transaction.get(recipientRef)
    const existingChallengeSnap = await transaction.get(challengeRef)

    if (!recipientSnap.exists()) {
      throw new Error('recipient_not_found')
    }

    const activeSladesh = recipientSnap.data().activeSladesh || null
    const activeStatus = (activeSladesh?.status || '').toString().toLowerCase()
    const hasActiveLock = !!activeSladesh && isActiveSladeshStatus(activeStatus)

    // Idempotency guard: if the challenge already exists, do not re-create or double-increment stats
    if (existingChallengeSnap.exists()) {
      const existingData = existingChallengeSnap.data() || {}
      const existingStatus = (existingData.status || '').toString().toLowerCase()
      const existingResolved = isResolvedSladeshStatus(existingStatus)

      if (existingResolved) {
        const error = new Error('sladesh_already_resolved')
        error.code = 'sladesh_already_resolved'
        throw error
      }

      // Ensure recipient has the active lock for this challenge (for stale clients)
      if (!activeSladesh || activeSladesh.challengeId !== challengeRef.id) {
        transaction.update(recipientRef, {
          activeSladesh: {
            challengeId: challengeRef.id,
            status: 'in_progress',
            setAt: serverTimestamp(),
            senderId,
            recipientId
          },
          updatedAt: serverTimestamp(),
          lastActiveAt: serverTimestamp()
        })
      }

      // No-op write path: we already have this challenge, return early to avoid double increments
      return challengeRef.id
    }

    if (hasActiveLock && activeSladesh.challengeId !== challengeRef.id) {
      const error = new Error(SLADESH_ACTIVE_ERROR)
      error.code = SLADESH_ACTIVE_ERROR
      throw error
    }

    transaction.set(challengeRef, payload)

    transaction.update(senderRef, {
      sladeshSent: increment(1),
      lastSladeshSentAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastActiveAt: serverTimestamp()
    })

    transaction.update(recipientRef, {
      sladeshReceived: increment(1),
      activeSladesh: {
        challengeId: challengeRef.id,
        status: 'in_progress',
        setAt: serverTimestamp(),
        senderId,
        recipientId
      },
      updatedAt: serverTimestamp(),
      lastActiveAt: serverTimestamp()
    })
  })

  return challengeRef.id
}

/**
 * Clear the receiver's activeSladesh marker when a challenge finishes.
 * Guarded by challengeId so we don't accidentally unlock a newer challenge.
 */
export async function clearActiveSladeshLock(userId, challengeId) {
  if (!userId || !challengeId) return

  const userRef = doc(db, 'users', userId)
  await runTransaction(db, async (transaction) => {
    const userSnap = await transaction.get(userRef)
    if (!userSnap.exists()) {
      return
    }

    const active = userSnap.data().activeSladesh || null
    if (!active) {
      return
    }

    if (active.challengeId && active.challengeId !== challengeId) {
      return
    }

    transaction.update(userRef, {
      activeSladesh: null,
      updatedAt: serverTimestamp(),
      lastActiveAt: serverTimestamp()
    })
  })
}

/**
 * Increment Sladesh stats for a user (completed or failed count)
 * Uses transaction to ensure idempotency - only increments if challenge status is changing from in_progress
 * @param {string} userId - User ID (receiver of the Sladesh)
 * @param {string} challengeId - Challenge ID
 * @param {string} status - 'completed' or 'failed'
 * @returns {Promise<void>}
 */
export async function incrementSladeshStats(userId, challengeId, status) {
  if (!userId || !challengeId || !status) {
    console.warn('[incrementSladeshStats] Missing required parameters', { userId, challengeId, status })
    return
  }

  if (status !== 'completed' && status !== 'failed') {
    console.warn('[incrementSladeshStats] Invalid status', status)
    return
  }

  const userRef = doc(db, 'users', userId)
  const challengeRef = doc(db, 'sladeshChallenges', challengeId)

  await runTransaction(db, async (transaction) => {
    const challengeSnap = await transaction.get(challengeRef)

    if (!challengeSnap.exists()) {
      console.warn('[incrementSladeshStats] Challenge not found', challengeId)
      return
    }

    const challengeData = challengeSnap.data()
    const currentStatus = (challengeData.status || '').toString().toLowerCase()

    // Idempotency guard: only increment if status is changing FROM in_progress/pending
    // This prevents double-counting on retries or refreshes
    if (currentStatus === status) {
      console.log('[incrementSladeshStats] Challenge already has status', status, '- skipping increment')
      return
    }

    if (currentStatus !== 'in_progress' && currentStatus !== 'pending') {
      console.log('[incrementSladeshStats] Challenge status is', currentStatus, '- skipping increment')
      return
    }

    // Increment the appropriate counter
    const fieldName = status === 'completed' ? 'sladeshCompletedCount' : 'sladeshFailedCount'

    transaction.update(userRef, {
      [fieldName]: increment(1),
      updatedAt: serverTimestamp(),
      lastActiveAt: serverTimestamp()
    })

    console.log('[incrementSladeshStats] Incremented', fieldName, 'for user', userId)
  })
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
    activeSladesh: null,
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
 * Admin: Get all users from the database
 * Returns basic user information for admin management
 * @returns {Promise<Array>} Array of user objects with essential fields
 */
export async function getAllUsers() {
  const usersRef = collection(db, 'users')
  const q = query(usersRef, orderBy('fullName'))
  const snapshot = await getDocs(q)

  return snapshot.docs.map(docSnap => {
    const data = docSnap.data()
    return {
      id: docSnap.id,
      fullName: data.fullName || 'Ukendt',
      username: data.username || data.email || 'Ukendt',
      email: data.email || '',
      sladeshSent: data.sladeshSent || 0,
      sladeshReceived: data.sladeshReceived || 0,
      sladeshCompletedCount: data.sladeshCompletedCount || 0,
      sladeshFailedCount: data.sladeshFailedCount || 0,
      totalDrinks: data.totalDrinks || 0
    }
  })
}

/**
 * Admin: Reset Sladesh state for a specific user
 * Only allows reset if user has actually used Sladesh (sent or received at least one)
 * @param {string} userId - User ID to reset
 * @throws {Error} If user hasn't used Sladesh or user not found
 * @returns {Promise<void>}
 */
export async function resetSladeshStateForUser(userId) {
  if (!userId) {
    throw new Error('User ID er påkrævet')
  }

  const userRef = doc(db, 'users', userId)
  const userSnap = await getDoc(userRef)

  if (!userSnap.exists()) {
    throw new Error(`Bruger med ID ${userId} blev ikke fundet`)
  }

  const userData = userSnap.data()
  const sladeshSent = userData.sladeshSent || 0
  const sladeshReceived = userData.sladeshReceived || 0

  // Validation: Only allow reset if user has actually used Sladesh
  if (sladeshSent === 0 && sladeshReceived === 0) {
    throw new Error('Denne bruger har ikke brugt Sladesh endnu. Kun brugere der har sendt eller modtaget mindst én Sladesh kan nulstilles.')
  }

  // Use the existing resetSladeshState function
  await resetSladeshState(userId)
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
