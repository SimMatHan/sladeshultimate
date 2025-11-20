import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  increment,
  serverTimestamp
} from 'firebase/firestore'
import { db } from '../firebase'

const STATS_DOC_ID = 'global'

/**
 * Get current stats document
 * @returns {Promise<Object>} Stats document data
 */
export async function getStats() {
  const statsRef = doc(db, 'stats', STATS_DOC_ID)
  const statsSnap = await getDoc(statsRef)
  
  if (!statsSnap.exists()) {
    // Initialize stats if they don't exist
    return await initializeStats()
  }
  
  return statsSnap.data()
}

/**
 * Initialize stats document with default values
 * @returns {Promise<Object>} Initialized stats data
 */
async function initializeStats() {
  const statsRef = doc(db, 'stats', STATS_DOC_ID)
  
  const initialStats = {
    totalUsers: 0,
    totalDrinks: 0,
    totalCheckIns: 0,
    totalSladesh: 0,
    drinkTypes: {
      beer: 0,
      cider: 0,
      shot: 0,
      cocktail: 0,
      wine: 0,
      spritz: 0,
      soda: 0,
      other: 0
    },
    drinkVariations: {},
    lastUpdated: serverTimestamp()
  }
  
  await setDoc(statsRef, initialStats)
  return initialStats
}

/**
 * Update stats with provided updates
 * @param {Object} updates - Fields to update
 * @returns {Promise<void>}
 */
export async function updateStats(updates) {
  const statsRef = doc(db, 'stats', STATS_DOC_ID)
  
  // Ensure stats document exists
  const statsSnap = await getDoc(statsRef)
  if (!statsSnap.exists()) {
    await initializeStats()
  }
  
  await updateDoc(statsRef, {
    ...updates,
    lastUpdated: serverTimestamp()
  })
}

/**
 * Increment total user count
 * @returns {Promise<void>}
 */
export async function incrementUserCount() {
  const statsRef = doc(db, 'stats', STATS_DOC_ID)
  
  // Ensure stats document exists
  const statsSnap = await getDoc(statsRef)
  if (!statsSnap.exists()) {
    await initializeStats()
  }
  
  await updateDoc(statsRef, {
    totalUsers: increment(1),
    lastUpdated: serverTimestamp()
  })
}

/**
 * Increment or decrement drink count for a specific drink type and variation
 * @param {string} drinkType - Drink type (e.g., "beer", "shot")
 * @param {string} variation - Drink variation (e.g., "Lager", "IPA", "Mojito")
 * @param {number} delta - Amount to change (default: 1, use -1 to decrement)
 * @returns {Promise<void>}
 */
export async function incrementDrinkCount(drinkType, variation = null, delta = 1) {
  const statsRef = doc(db, 'stats', STATS_DOC_ID)
  
  // Ensure stats document exists
  const statsSnap = await getDoc(statsRef)
  if (!statsSnap.exists()) {
    await initializeStats()
  }
  
  const statsData = statsSnap.data() || {}
  const updates = {
    totalDrinks: increment(delta),
    [`drinkTypes.${drinkType}`]: increment(delta),
    lastUpdated: serverTimestamp()
  }
  
  // If variation is provided, also track it
  if (variation) {
    const variationPath = `drinkVariations.${drinkType}.${variation}`
    const currentVariationCount = statsData.drinkVariations?.[drinkType]?.[variation] || 0
    const newCount = currentVariationCount + delta
    
    // Use increment if the path exists and won't go below 0
    if (currentVariationCount > 0 || delta > 0) {
      if (delta < 0 && newCount < 0) {
        // Prevent going below 0 - set to 0 instead
        const drinkVariations = statsData.drinkVariations || {}
        const typeVariations = drinkVariations[drinkType] || {}
        typeVariations[variation] = 0
        drinkVariations[drinkType] = typeVariations
        updates.drinkVariations = drinkVariations
      } else {
        updates[variationPath] = increment(delta)
      }
    } else {
      // Initialize the nested structure if it doesn't exist (only for positive delta)
      if (delta > 0) {
        const drinkVariations = statsData.drinkVariations || {}
        const typeVariations = drinkVariations[drinkType] || {}
        typeVariations[variation] = 1
        drinkVariations[drinkType] = typeVariations
        updates.drinkVariations = drinkVariations
      }
    }
  }
  
  await updateDoc(statsRef, updates)
}

/**
 * Increment total check-in count
 * @returns {Promise<void>}
 */
export async function incrementCheckInCount() {
  const statsRef = doc(db, 'stats', STATS_DOC_ID)
  
  // Ensure stats document exists
  const statsSnap = await getDoc(statsRef)
  if (!statsSnap.exists()) {
    await initializeStats()
  }
  
  await updateDoc(statsRef, {
    totalCheckIns: increment(1),
    lastUpdated: serverTimestamp()
  })
}

/**
 * Increment total sladesh count
 * @returns {Promise<void>}
 */
export async function incrementSladeshCount() {
  const statsRef = doc(db, 'stats', STATS_DOC_ID)
  
  // Ensure stats document exists
  const statsSnap = await getDoc(statsRef)
  if (!statsSnap.exists()) {
    await initializeStats()
  }
  
  await updateDoc(statsRef, {
    totalSladesh: increment(1),
    lastUpdated: serverTimestamp()
  })
}

/**
 * Decrement total user count (when user is deleted)
 * @returns {Promise<void>}
 */
export async function decrementUserCount() {
  const statsRef = doc(db, 'stats', STATS_DOC_ID)
  
  const statsSnap = await getDoc(statsRef)
  if (!statsSnap.exists()) {
    return // Stats don't exist, nothing to decrement
  }
  
  await updateDoc(statsRef, {
    totalUsers: increment(-1),
    lastUpdated: serverTimestamp()
  })
}
