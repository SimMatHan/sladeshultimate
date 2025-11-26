import { 
  collection, 
  getDocs,
  getDoc,
  doc,
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
 * @param {string} [currentUserId] - Optional current user ID to ensure they're always included
 * @returns {Promise<Array>} Array of leaderboard profile objects
 */
export async function fetchLeaderboardProfiles(channelId = null, currentUserId = null) {
  console.log('[leaderboard] fetchLeaderboardProfiles called', { channelId, currentUserId })
  
  // Check cache first (but invalidate if currentUserId is provided to ensure fresh data)
  const cacheKey = channelId || 'default'
  const cached = cache.get(cacheKey)
  const now = Date.now()
  
  // Only use cache if no currentUserId is provided (to ensure current user is always fresh)
  if (cached && (now - cached.timestamp) < CACHE_TTL_MS && !currentUserId) {
    return cached.data
  }

  if (!channelId) {
    console.log('[leaderboard] No channelId provided, returning empty array')
    cache.set(cacheKey, { data: [], timestamp: now })
    return []
  }
  try {
    const usersRef = collection(db, 'users')
    
    // Build query - filter by channel membership only
    // We'll sort by currentRunDrinkCount in JavaScript after filtering by checkInStatus
    const q = query(
      usersRef,
      where('joinedChannelIds', 'array-contains', channelId),
      limit(100) // Get more users since we'll filter by checkInStatus
    )
    
    console.log('[leaderboard] Executing Firestore query for channelId:', channelId)
    const querySnapshot = await getDocs(q)
    console.log('[leaderboard] Query returned', querySnapshot.docs.length, 'users before filtering')
    
    const profiles = []
    const profileIds = new Set() // Track which user IDs we've already added
    
    // Track users before and after filtering for debugging
    const usersBeforeFilter = []
    
    for (const docSnap of querySnapshot.docs) {
      const userId = docSnap.id
      const isCurrentUser = currentUserId && userId === currentUserId
      let userData = docSnap.data()
      
      // Track user data before filtering
      usersBeforeFilter.push({
        userId,
        isCurrentUser,
        currentRunDrinkCount: userData.currentRunDrinkCount || 0,
        checkInStatus: userData.checkInStatus || false
      })
      
      try {
        userData = await ensureFreshCheckInStatus(userId, userData)
      } catch (statusError) {
        console.warn(`Unable to refresh check-in status for user ${userId}:`, statusError)
      }

      // For "Nuværende runde" filtre: Only show checked-in users (except current user who always shows)
      // Current user should always be included, bypass all filters
      // Other users: skip if not checked in
      if (!isCurrentUser && !userData.checkInStatus) {
        console.log(`[leaderboard] Skipping user ${userId} - not checked in`)
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
      let topDrink = 'Ukendt'
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
        id: userId,
        username: userData.username || userData.fullName || userData.displayName || 'Ukendt',
        name: userData.fullName || userData.displayName || 'Ukendt',
        initials: userData.initials || '??',
        profileEmoji: userData.profileEmoji || '🍹',
        profileGradient: userData.profileGradient || 'from-rose-400 to-orange-500',
        avatarGradient: userData.avatarGradient || userData.profileGradient || 'from-gray-400 to-gray-600',
        totalDrinks: userData.totalDrinks || 0,
        currentRunDrinkCount: userData.currentRunDrinkCount || 0,
        weeklyAverage: weeklyAverage,
        streakDays: streakDays,
        topDrink: topDrink,
        favoriteSpot: userData.lastCheckInVenue || 'Ukendt',
        drinkBreakdown: drinkBreakdown,
        recentDrinks: recentDrinks
      })
      profileIds.add(userId)
    }
    
    console.log('[leaderboard] Users before filtering:', usersBeforeFilter.map(u => ({
      userId: u.userId,
      isCurrentUser: u.isCurrentUser,
      currentRunDrinkCount: u.currentRunDrinkCount,
      checkInStatus: u.checkInStatus
    })))
    console.log('[leaderboard] Users after filtering:', profiles.length, 'users')
    console.log('[leaderboard] Profile IDs:', Array.from(profileIds))
    
    // If current user is provided and not already in results, fetch them separately
    if (currentUserId && !profileIds.has(currentUserId)) {
      try {
        const userRef = doc(db, 'users', currentUserId)
        const userSnap = await getDoc(userRef)
        
        if (userSnap.exists()) {
          let userData = userSnap.data()
          
          // Check if user is a member of the channel
          const joinedChannelIds = userData.joinedChannelIds || []
          console.log(`[leaderboard] Current user ${currentUserId} joinedChannelIds:`, joinedChannelIds, 'channelId:', channelId)
          if (joinedChannelIds.includes(channelId)) {
            console.log(`[leaderboard] Current user is member of channel, adding to leaderboard`)
            try {
              userData = await ensureFreshCheckInStatus(currentUserId, userData)
              console.log(`[leaderboard] Current user checkInStatus:`, userData.checkInStatus, 'currentRunDrinkCount:', userData.currentRunDrinkCount)
            } catch (statusError) {
              console.warn(`Unable to refresh check-in status for current user ${currentUserId}:`, statusError)
            }
            
            // Calculate weekly average
            const weeklyAverage = userData.weeklyAverage || Math.floor((userData.totalDrinks || 0) / 4)
            
            // Calculate streak days
            const streakDays = userData.streakDays || 0
            
            // Build drink breakdown from drinkTypes
            const drinkBreakdown = []
            if (userData.drinkTypes) {
              Object.entries(userData.drinkTypes).forEach(([type, count]) => {
                drinkBreakdown.push({
                  id: `${currentUserId}-${type}`,
                  label: formatDrinkTypeLabel(type),
                  count: count || 0
                })
              })
            }
            
            // Get recent drinks
            const recentDrinks = []
            
            // Determine top drink
            let topDrink = 'Ukendt'
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
              id: currentUserId,
              username: userData.username || userData.fullName || userData.displayName || 'Ukendt',
              name: userData.fullName || userData.displayName || 'Ukendt',
              initials: userData.initials || '??',
              profileEmoji: userData.profileEmoji || '🍹',
              profileGradient: userData.profileGradient || 'from-rose-400 to-orange-500',
              avatarGradient: userData.avatarGradient || userData.profileGradient || 'from-gray-400 to-gray-600',
              totalDrinks: userData.totalDrinks || 0,
              currentRunDrinkCount: userData.currentRunDrinkCount || 0,
              weeklyAverage: weeklyAverage,
              streakDays: streakDays,
              topDrink: topDrink,
              favoriteSpot: userData.lastCheckInVenue || 'Ukendt',
              drinkBreakdown: drinkBreakdown,
              recentDrinks: recentDrinks
            })
          }
        }
      } catch (currentUserError) {
        console.warn(`Unable to fetch current user ${currentUserId} for leaderboard:`, currentUserError)
      }
    }
    
    // Sort profiles by currentRunDrinkCount descending (will be re-sorted in component based on sortMode)
    profiles.sort((a, b) => (b.currentRunDrinkCount || 0) - (a.currentRunDrinkCount || 0))
    
    // Cache the results
    cache.set(cacheKey, { data: profiles, timestamp: now })
    
    console.log('[leaderboard] Final profiles count:', profiles.length)
    console.log('[leaderboard] Final profiles:', profiles.map(p => ({
      id: p.id,
      name: p.name,
      currentRunDrinkCount: p.currentRunDrinkCount,
      isCurrentUser: p.id === currentUserId
    })))
    
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

