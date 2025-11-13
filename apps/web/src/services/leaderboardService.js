import { 
  collection, 
  getDocs,
  query,
  orderBy,
  limit,
  where
} from 'firebase/firestore'
import { db } from '../firebase'

/**
 * Fetch leaderboard data from Firestore
 * Aggregates user data including total drinks, weekly averages, streaks, etc.
 * @param {string} [channelId] - Optional channel ID to filter by
 * @returns {Promise<Array>} Array of leaderboard profile objects
 */
export async function fetchLeaderboardProfiles(channelId = null) {
  try {
    const usersRef = collection(db, 'users')
    
    // Build query - order by totalDrinks descending
    let q = query(
      usersRef,
      orderBy('totalDrinks', 'desc'),
      limit(50) // Limit to top 50 users
    )
    
    // If channelId is provided, we would filter by channel
    // Note: This requires users to have a channelId field or a subcollection
    // For now, we'll fetch all users and filter client-side if needed
    
    const querySnapshot = await getDocs(q)
    
    const profiles = []
    
    for (const docSnap of querySnapshot.docs) {
      const userData = docSnap.data()
      
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
      
      // Get recent drinks (would need to query drinks subcollection)
      // For now, return empty array - this would need to be fetched separately
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
        avatarGradient: userData.avatarGradient || 'from-gray-400 to-gray-600',
        totalDrinks: userData.totalDrinks || 0,
        weeklyAverage: weeklyAverage,
        streakDays: streakDays,
        topDrink: topDrink,
        favoriteSpot: userData.lastCheckInVenue || 'Unknown',
        drinkBreakdown: drinkBreakdown,
        recentDrinks: recentDrinks
      })
    }
    
    return profiles
  } catch (error) {
    console.error('Error fetching leaderboard profiles:', error)
    return []
  }
}

/**
 * Fetch recent drinks for a specific user
 * @param {string} userId - User ID
 * @param {number} limitCount - Maximum number of recent drinks to fetch
 * @returns {Promise<Array>} Array of recent drink objects
 */
export async function fetchUserRecentDrinks(userId, limitCount = 3) {
  try {
    const drinksRef = collection(db, 'users', userId, 'drinks')
    const q = query(
      drinksRef,
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    )
    
    const querySnapshot = await getDocs(q)
    
    return querySnapshot.docs.map(docSnap => {
      const data = docSnap.data()
      const timestamp = data.timestamp?.toDate() || new Date()
      
      return {
        id: docSnap.id,
        label: data.label || 'Unknown drink',
        timestamp: formatTimestamp(timestamp)
      }
    })
  } catch (error) {
    console.error(`Error fetching recent drinks for user ${userId}:`, error)
    return []
  }
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

