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
  Timestamp
} from 'firebase/firestore'
import { db } from '../firebase'
import { deriveInitials, generateAvatarGradient } from '../config/firestore.schema'

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
    throw new Error('uid, email, and fullName are required to create a user')
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
    checkInStatus: false,
    sladeshSent: 0,
    sladeshReceived: 0,
    joinedChannelIds: [],
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
  
  return { id: userSnap.id, ...userSnap.data() }
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
 * Add a drink to user's drinks subcollection
 * Also updates the user's total drinks count and drink types
 * @param {string} userId - User ID
 * @param {Object} drinkData - Drink data
 * @param {string} drinkData.type - Drink type (e.g., "beer", "shot")
 * @param {string} drinkData.label - Display name
 * @param {string} drinkData.venue - Venue name
 * @param {Object} drinkData.location - Location with lat/lng
 * @param {string} [drinkData.channelId] - Optional channel ID
 * @returns {Promise<string>} Document ID of the new drink
 */
export async function addDrink(userId, drinkData) {
  const drinksRef = collection(db, 'users', userId, 'drinks')
  
  const drinkDoc = {
    type: drinkData.type,
    label: drinkData.label,
    venue: drinkData.venue,
    location: drinkData.location,
    timestamp: serverTimestamp(),
    channelId: drinkData.channelId || null
  }
  
  const docRef = await addDoc(drinksRef, drinkDoc)
  
  // Update user's aggregated stats
  const userRef = doc(db, 'users', userId)
  const userSnap = await getDoc(userRef)
  const userData = userSnap.data()
  
  const newTotal = (userData.totalDrinks || 0) + 1
  const newDrinkTypes = { ...(userData.drinkTypes || {}) }
  newDrinkTypes[drinkData.type] = (newDrinkTypes[drinkData.type] || 0) + 1
  
  // Also track drink variations in user document
  const newDrinkVariations = { ...(userData.drinkVariations || {}) }
  if (!newDrinkVariations[drinkData.type]) {
    newDrinkVariations[drinkData.type] = {}
  }
  const typeVariations = { ...newDrinkVariations[drinkData.type] }
  typeVariations[drinkData.label] = (typeVariations[drinkData.label] || 0) + 1
  newDrinkVariations[drinkData.type] = typeVariations
  
  await updateDoc(userRef, {
    totalDrinks: newTotal,
    drinkTypes: newDrinkTypes,
    drinkVariations: newDrinkVariations,
    updatedAt: serverTimestamp(),
    lastActiveAt: serverTimestamp()
  })
  
  return docRef.id
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
  const checkInsRef = collection(db, 'users', userId, 'checkIns')
  
  const checkInDoc = {
    venue: checkInData.venue,
    location: checkInData.location,
    timestamp: serverTimestamp(),
    channelId: checkInData.channelId || null
  }
  
  const docRef = await addDoc(checkInsRef, checkInDoc)
  
  // Update user's check-in status and location
  const userRef = doc(db, 'users', userId)
  await updateDoc(userRef, {
    checkInStatus: true,
    lastCheckIn: serverTimestamp(),
    lastCheckInVenue: checkInData.venue,
    currentLocation: {
      ...checkInData.location,
      venue: checkInData.venue,
      timestamp: Timestamp.now()
    },
    updatedAt: serverTimestamp(),
    lastActiveAt: serverTimestamp()
  })
  
  return docRef.id
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
  const sladeshRef = collection(db, 'users', userId, 'sladesh')
  
  const sladeshDoc = {
    type: sladeshData.type,
    recipientId: sladeshData.recipientId || null,
    senderId: sladeshData.senderId || null,
    venue: sladeshData.venue,
    location: sladeshData.location,
    timestamp: serverTimestamp(),
    channelId: sladeshData.channelId || null
  }
  
  const docRef = await addDoc(sladeshRef, sladeshDoc)
  
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
  } else if (sladeshData.type === 'received') {
    updates.sladeshReceived = (userData.sladeshReceived || 0) + 1
  }
  
  await updateDoc(userRef, updates)
  
  return docRef.id
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
