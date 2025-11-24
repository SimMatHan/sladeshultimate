import { 
  collection, 
  getDocs,
  query,
  orderBy,
  limit,
  where
} from 'firebase/firestore'
import { db } from '../firebase'
import { ensureFreshCheckInStatus } from './userService'

// Simple in-memory cache per channel
const cache = new Map()
const CACHE_TTL_MS = 30000 // 30 seconds

/**
 * Fetch leaderboard data from Firestore
 * Aggregates user data including total drinks, weekly averages, streaks, etc.
 * @param {string} [channelId] - Optional channel ID to filter by
 * @returns {Promise<Array>} Array of leaderboard profile objects
 */
export async function fetchLeaderboardProfiles(channelId = null) {
  // Check cache first
  const cacheKey = channelId || 'default'
  const cached = cache.get(cacheKey)
  const now = Date.now()
  
  if (cached && (now - cached.timestamp) < CACHE_TTL_MS) {
    return cached.data
  }
  try {
    const usersRef = collection(db, 'users')
    
    // Build query - order by totalDrinks descending
    // If channelId is provided, filter by activeChannelId
    let q
    if (channelId) {
      q = query(
        usersRef,
        where('activeChannelId', '==', channelId),
        orderBy('totalDrinks', 'desc'),
        limit(50) // Limit to top 50 users
      )
    } else {
      // Default channel: show all users
      q = query(
        usersRef,
        orderBy('totalDrinks', 'desc'),
        limit(50) // Limit to top 50 users
      )
    }
    
    const querySnapshot = await getDocs(q)
    
    const profiles = []
    
    for (const docSnap of querySnapshot.docs) {
      let userData = docSnap.data()
      
      try {
        userData = await ensureFreshCheckInStatus(docSnap.id, userData)
      } catch (statusError) {
        console.warn(`Unable to refresh check-in status for user ${docSnap.id}:`, statusError)
      }

      if (!userData.checkInStatus) {
        continue
      }
      
      // Skip users with no drinks
      if (!userData.totalDrinks || userData.totalDrinks === 0) {
        continue
      }
      
      // Calculate weekly average (simplified - assumes drinks tracked over time)
      // In a real implementation, you'd calculate this from drink timestamps
      const weeklyAverage = userData.weeklyAverage || Math.floor((userData.totalDrinks || 0) / 4)
      
      // Calculate streak days (simplified - would need to track consecutive days)
      const streakDays = userData.streakDays || 0
      
      // Build drink breakdown from drinkTypes
      const drinkBreakdown = []
      if (userData.drinkTypes) {
        Object.entries(userData.drinkTypes).forEach(([type, count]) => {
          drinkBreakdown.push({
            id: `${docSnap.id}-${type}`,
            label: formatDrinkTypeLabel(type),
            count: count || 0
          })
        })
      }
      
      // Get recent drinks - drinks subcollection removed, using lastDrinkAt from user document
      // For now, return empty array - can be enhanced to use lastDrinkAt for sorting/display
      const recentDrinks = []
      
      // Determine top drink
      let topDrink = 'N/A'
      if (userData.drinkVariations && Object.keys(userData.drinkVariations).length > 0) {
        let maxCount = 0
        Object.entries(userData.drinkVariations).forEach(([type, variations]) => {
          if (variations && typeof variations === 'object') {
            Object.entries(variations).forEach(([label, count]) => {
              if (count > maxCount) {
                maxCount = count
                topDrink = label
              }
            })
          }
        })
      }
      
      profiles.push({
        id: docSnap.id,
        name: userData.fullName || userData.displayName || 'Unknown',
        initials: userData.initials || '??',
        profileEmoji: userData.profileEmoji || '🍹',
        profileGradient: userData.profileGradient || 'from-rose-400 to-orange-500',
        avatarGradient: userData.avatarGradient || userData.profileGradient || 'from-gray-400 to-gray-600',
        totalDrinks: userData.totalDrinks || 0,
        currentRunDrinkCount: userData.currentRunDrinkCount || 0,
        weeklyAverage: weeklyAverage,
        streakDays: streakDays,
        topDrink: topDrink,
        favoriteSpot: userData.lastCheckInVenue || 'Unknown',
        drinkBreakdown: drinkBreakdown,
        recentDrinks: recentDrinks
      })
    }
    
    // Cache the results
    cache.set(cacheKey, { data: profiles, timestamp: now })
    
    return profiles
  } catch (error) {
    console.error('Error fetching leaderboard profiles:', error)
    return []
  }
}

/**
 * Clear the leaderboard cache for a specific channel or all channels
 * @param {string} [channelId] - Optional channel ID to clear cache for. If not provided, clears all cache.
 */
export function clearLeaderboardCache(channelId = null) {
  if (channelId) {
    const cacheKey = channelId || 'default'
    cache.delete(cacheKey)
  } else {
    cache.clear()
  }
}

/**
 * Fetch recent drinks for a specific user
 * Note: Drinks subcollection removed - using lastDrinkAt from user document
 * @param {string} userId - User ID
 * @param {number} limitCount - Maximum number of recent drinks to fetch (not used, kept for compatibility)
 * @returns {Promise<Array>} Array of recent drink objects (currently empty array)
 */
export async function fetchUserRecentDrinks(userId, limitCount = 3) {
  // Drinks subcollection removed - individual drink documents no longer exist
  // Can be enhanced to use lastDrinkAt from user document for basic recent drink tracking
  // For now, return empty array to maintain API compatibility
  return []
}

/**
 * Format drink type label for display
 * @param {string} type - Drink type (e.g., "beer", "shot")
 * @returns {string} Formatted label
 */
function formatDrinkTypeLabel(type) {
  const labels = {
    beer: 'Beer',
    cider: 'Cider',
    wine: 'Wine',
    cocktail: 'Cocktails',
    shot: 'Shots',
    spritz: 'Spritz',
    soda: 'Soda',
    other: 'Other'
  }
  return labels[type] || type.charAt(0).toUpperCase() + type.slice(1)
}

/**
 * Format timestamp to Danish format
 * @param {Date} date - Date object
 * @returns {string} Formatted timestamp string
 */
function formatTimestamp(date) {
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  
  if (diffMins < 1) {
    return 'Lige nu'
  } else if (diffMins < 60) {
    return `${diffMins} min siden`
  } else if (diffHours < 24) {
    return diffDays === 0 ? `I dag • ${date.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })}` : `I går • ${date.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })}`
  } else if (diffDays === 1) {
    return `I går • ${date.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })}`
  } else {
    return date.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })
  }
}

