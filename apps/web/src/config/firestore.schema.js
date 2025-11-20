/**
 * Firestore Database Schema Definitions
 * 
 * This file documents the structure of all Firestore collections and their fields.
 * Use this as a reference when working with Firestore data.
 */

/**
 * User Document Schema
 * Collection: users
 * Document ID: Firebase Auth UID
 */
export const USER_SCHEMA = {
  // Basic Info
  uid: 'string',              // Firebase Auth UID (same as doc ID)
  email: 'string',
  fullName: 'string',         // Full name for searchability (e.g., "Sara Holm")
  displayName: 'string',      // Display name (can be same as fullName or nickname)
  initials: 'string',         // Derived from fullName (e.g., "SH")
  avatarGradient: 'string',   // e.g., "from-rose-400 to-orange-500"
  
  // Activity Tracking
  totalDrinks: 'number',      // Lifetime aggregated count (never resets)
  drinkTypes: 'object',       // Lifetime cumulative { "beer": 10, "shot": 5, "cocktail": 3 } (never resets)
  drinkVariations: 'object',  // Per-run variations { "beer": { "Lager": 5, "IPA": 3 }, "cocktail": { "Mojito": 2 } } (resets at 10:00)
  currentRunDrinkCount: 'number', // Per-run counter (resets at 10:00)
  lastDrinkAt: 'timestamp | null', // Last drink timestamp for recent drinks ordering
  checkInStatus: 'boolean',   // Current check-in state
  lastCheckIn: 'timestamp',   // Last check-in timestamp
  lastCheckInVenue: 'string', // Venue name from last check-in
  
  // Sladesh Activity
  sladeshSent: 'number',      // Count of sladesh sent
  sladeshReceived: 'number',  // Count of sladesh received
  
  // Channels
  joinedChannelIds: 'array',    // Array of channel IDs the user has joined
  activeChannelId: 'string | null', // Currently selected channel used for filtering
  
  // Location
  currentLocation: {
    lat: 'number',
    lng: 'number',
    venue: 'string',
    timestamp: 'timestamp'
  },
  
  // Metadata
  createdAt: 'timestamp',
  updatedAt: 'timestamp',
  lastActiveAt: 'timestamp'
}

/**
 * Check-In Document Schema
 * Subcollection: users/{userId}/checkIns
 */
export const CHECKIN_SCHEMA = {
  venue: 'string',
  location: {
    lat: 'number',
    lng: 'number'
  },
  timestamp: 'timestamp',
  channelId: 'string | null' // Channel ID where this check-in occurred (required for filtering)
}

/**
 * Sladesh Document Schema
 * Subcollection: users/{userId}/sladesh
 */
export const SLADESH_SCHEMA = {
  type: 'string',           // "sent" or "received"
  recipientId: 'string | null', // If sent
  senderId: 'string | null',    // If received
  venue: 'string',
  location: {
    lat: 'number',
    lng: 'number'
  },
  timestamp: 'timestamp',
  channelId: 'string | null' // Channel ID where this sladesh activity occurred (required for filtering)
}

/**
 * Channel Document Schema
 * Collection: channels
 * Document ID: auto-generated channel ID
 * 
 * Minimal model: channels act as filters for content.
 * Default channel "Den Åbne Kanal" shows global/unfiltered view.
 */
export const CHANNEL_SCHEMA = {
  // Basic Info
  name: 'string',           // Channel name (e.g., "Den Åbne Kanal")
  isDefault: 'boolean',     // true for the default channel, false for others
  createdAt: 'timestamp'    // When the channel was created
}

/**
 * Channel Comment Document Schema
 * Subcollection: channels/{channelId}/comments
 */
export const CHANNEL_COMMENT_SCHEMA = {
  userId: 'string',
  userName: 'string',
  content: 'string',
  timestamp: 'timestamp',
  editedAt: 'timestamp | null'
}

/**
 * Channel Notification Document Schema
 * Subcollection: channels/{channelId}/notifications
 */
export const CHANNEL_NOTIFICATION_SCHEMA = {
  type: 'string',          // "checkin", "drink", "sladesh", "comment"
  userId: 'string',
  userName: 'string',
  message: 'string',
  timestamp: 'timestamp',
  readBy: 'array'          // Array of user IDs who have read it
}

/**
 * Stats Document Schema
 * Collection: stats
 * Document ID: "global" (or separate docs for different stat types)
 */
export const STATS_SCHEMA = {
  // Global Stats
  totalUsers: 'number',
  totalDrinks: 'number',
  totalCheckIns: 'number',
  totalSladesh: 'number',
  
  // Drink Types Breakdown
  drinkTypes: {
    'beer': 'number',
    'shot': 'number',
    'cocktail': 'number',
    'wine': 'number',
    // ... other types
  },
  
  // Drink Variations Breakdown (nested by type)
  drinkVariations: {
    'beer': {
      'Lager': 'number',
      'IPA': 'number',
      // ... other beer variations
    },
    'cocktail': {
      'Mojito': 'number',
      'Gin & Tonic': 'number',
      // ... other cocktail variations
    },
    // ... other types with their variations
  },
  
  // Time-based (optional - can be computed)
  lastUpdated: 'timestamp'
}

/**
 * Helper function to derive initials from full name
 * @param {string} fullName - Full name (e.g., "Sara Holm")
 * @returns {string} Initials (e.g., "SH")
 */
export function deriveInitials(fullName) {
  if (!fullName) return ''
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase()
  }
  return parts
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase()
}

/**
 * Helper function to generate a default avatar gradient
 * @param {string} userId - User ID for consistent gradient generation
 * @returns {string} Tailwind gradient class
 */
export function generateAvatarGradient(userId) {
  const gradients = [
    'from-rose-400 to-orange-500',
    'from-sky-400 to-indigo-500',
    'from-purple-400 to-fuchsia-500',
    'from-emerald-400 to-teal-500',
    'from-amber-400 to-orange-500',
    'from-violet-400 to-purple-500',
    'from-pink-400 to-rose-500',
    'from-cyan-400 to-blue-500'
  ]
  
  // Simple hash to get consistent gradient for user
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash)
  }
  
  return gradients[Math.abs(hash) % gradients.length]
}
