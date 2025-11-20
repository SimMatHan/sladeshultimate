import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  getDoc, 
  getDocs,
  query,
  where,
  serverTimestamp,
  addDoc,
  arrayUnion
} from 'firebase/firestore'
import { db } from '../firebase'

const DEFAULT_CHANNEL_NAME = 'Den Åbne Kanal'

function getUserRef(userId) {
  if (!userId) {
    throw new Error('User ID is required')
  }
  return doc(db, 'users', userId)
}

/**
 * Get the default channel (where isDefault === true)
 * @returns {Promise<Object|null>} Default channel document or null if not found
 */
export async function getDefaultChannel() {
  const channelsRef = collection(db, 'channels')
  const q = query(channelsRef, where('isDefault', '==', true), where('name', '==', DEFAULT_CHANNEL_NAME))
  const querySnapshot = await getDocs(q)
  
  if (querySnapshot.empty) {
    return null
  }
  
  const doc = querySnapshot.docs[0]
  return { id: doc.id, ...doc.data() }
}

/**
 * Ensure the default channel exists, create it if it doesn't
 * @returns {Promise<Object>} Default channel document
 */
export async function ensureDefaultChannelExists() {
  let defaultChannel = await getDefaultChannel()
  
  if (!defaultChannel) {
    // Create default channel
    const channelsRef = collection(db, 'channels')
    const channelDoc = {
      name: DEFAULT_CHANNEL_NAME,
      isDefault: true,
      createdAt: serverTimestamp()
    }
    
    const docRef = await addDoc(channelsRef, channelDoc)
    defaultChannel = { id: docRef.id, ...channelDoc }
  }
  
  return defaultChannel
}

async function ensureUserDefaultChannel(userRef, userData) {
  const defaultChannel = await ensureDefaultChannelExists()
  const joinedIds = Array.isArray(userData.joinedChannelIds) ? [...userData.joinedChannelIds] : []
  let activeChannelId = userData.activeChannelId || null
  const updates = {}

  if (!joinedIds.includes(defaultChannel.id)) {
    joinedIds.push(defaultChannel.id)
    updates.joinedChannelIds = joinedIds
  }

  if (!activeChannelId) {
    activeChannelId = defaultChannel.id
    updates.activeChannelId = activeChannelId
  }

  if (Object.keys(updates).length > 0) {
    await updateDoc(userRef, updates)
  }

  return {
    defaultChannel,
    joinedChannelIds: updates.joinedChannelIds || joinedIds,
    activeChannelId
  }
}

async function fetchChannelsByIds(ids = []) {
  if (!ids.length) {
    return []
  }

  const results = await Promise.all(
    ids.map(async (channelId) => {
      const channelSnap = await getDoc(doc(db, 'channels', channelId))
      return channelSnap.exists() ? { id: channelSnap.id, ...channelSnap.data() } : null
    })
  )

  return results.filter(Boolean)
}

async function findChannelByCode(joinCode) {
  if (!joinCode) return null
  const channelsRef = collection(db, 'channels')
  const codeUpper = joinCode.trim().toUpperCase()
  const attempts = [codeUpper]
  if (codeUpper !== joinCode.trim()) {
    attempts.push(joinCode.trim())
  }

  for (const code of attempts) {
    const q = query(channelsRef, where('code', '==', code))
    const snap = await getDocs(q)
    if (!snap.empty) {
      const docSnap = snap.docs[0]
      return { id: docSnap.id, ...docSnap.data() }
    }
  }
  return null
}

/**
 * Fetch user's channels along with active channel Id.
 * Ensures the user is part of the default channel.
 * @param {string} userId
 * @returns {Promise<{channels: Array, activeChannelId: string | null}>}
 */
export async function getUserChannels(userId) {
  const userRef = await getUserRef(userId)
  const userSnap = await getDoc(userRef)

  if (!userSnap.exists()) {
    throw new Error('User not found')
  }

  const userData = userSnap.data()
  const { defaultChannel, joinedChannelIds, activeChannelId } = await ensureUserDefaultChannel(
    userRef,
    userData
  )

  const uniqueIds = Array.from(new Set(joinedChannelIds.filter(Boolean)))
  const channels = await fetchChannelsByIds(uniqueIds)

  // Guarantee default channel appears even if doc was deleted later
  if (!channels.find((channel) => channel.id === defaultChannel.id)) {
    channels.unshift(defaultChannel)
  }

  const result = {
    channels,
    activeChannelId: activeChannelId || defaultChannel.id
  }

  console.log('[channelService:getUserChannels]', {
    userId,
    email: userData.email || null,
    rawJoinedChannelIds: userData.joinedChannelIds || [],
    ensuredJoinedChannelIds: uniqueIds,
    activeChannelId: result.activeChannelId,
    channels: channels.map(channel => ({ id: channel.id, name: channel.name, isDefault: !!channel.isDefault }))
  })

  return result
}

/**
 * Ensure the "Ballade" channel exists, create it if it doesn't
 * @returns {Promise<Object>} Ballade channel document
 */
export async function ensureBalladeChannelExists() {
  const channelsRef = collection(db, 'channels')
  const q = query(channelsRef, where('name', '==', 'Ballade'))
  const querySnapshot = await getDocs(q)
  
  if (querySnapshot.empty) {
    // Create Ballade channel
    const channelDoc = {
      name: 'Ballade',
      isDefault: false,
      createdAt: serverTimestamp()
    }
    
    const docRef = await addDoc(channelsRef, channelDoc)
    return { id: docRef.id, ...channelDoc }
  }
  
  const doc = querySnapshot.docs[0]
  return { id: doc.id, ...doc.data() }
}

/**
 * Get all channels that a user has joined
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of channel documents
 */
export async function getChannelsForUser(userId) {
  const { channels } = await getUserChannels(userId)
  return channels
}

/**
 * Create a new channel
 * @param {Object} channelData - Channel data
 * @param {string} channelData.name - Channel name
 * @param {boolean} [channelData.isDefault] - Whether this is the default channel (default: false)
 * @returns {Promise<string>} Channel document ID
 */
export async function createChannel({ name, isDefault = false }) {
  if (!name || !name.trim()) {
    throw new Error('Channel name is required')
  }

  // Only one default channel should exist
  if (isDefault) {
    const existingDefault = await getDefaultChannel()
    if (existingDefault) {
      throw new Error('A default channel already exists')
    }
  }

  const channelsRef = collection(db, 'channels')
  const channelDoc = {
    name: name.trim(),
    isDefault: isDefault || false,
    createdAt: serverTimestamp()
  }
  
  const docRef = await addDoc(channelsRef, channelDoc)
  return docRef.id
}

/**
 * Get channel document by ID
 * @param {string} channelId - Channel ID
 * @returns {Promise<Object|null>} Channel document data or null if not found
 */
export async function getChannel(channelId) {
  const channelRef = doc(db, 'channels', channelId)
  const channelSnap = await getDoc(channelRef)
  
  if (!channelSnap.exists()) {
    return null
  }
  
  return { id: channelSnap.id, ...channelSnap.data() }
}

/**
 * Add a user to a channel
 * Updates user's joinedChannelIds array
 * @param {string} userId - User ID
 * @param {string} channelId - Channel ID
 * @returns {Promise<void>}
 */
export async function joinChannel(userId, channelId) {
  const channelRef = doc(db, 'channels', channelId)
  const channelSnap = await getDoc(channelRef)
  
  if (!channelSnap.exists()) {
    throw new Error('Channel not found')
  }
  
  // Update user's joinedChannelIds array
  const userRef = doc(db, 'users', userId)
  const userSnap = await getDoc(userRef)
  
  if (!userSnap.exists()) {
    throw new Error('User not found')
  }
  
  const userData = userSnap.data()
  const joinedChannelIds = userData.joinedChannelIds || []
  
  if (!joinedChannelIds.includes(channelId)) {
    await updateDoc(userRef, {
      joinedChannelIds: [...joinedChannelIds, channelId]
    })
  }
}

/**
 * Remove a user from a channel
 * Updates user's joinedChannelIds array
 * @param {string} userId - User ID
 * @param {string} channelId - Channel ID
 * @returns {Promise<void>}
 */
export async function leaveChannel(userId, channelId) {
  const userRef = doc(db, 'users', userId)
  const userSnap = await getDoc(userRef)
  
  if (!userSnap.exists()) {
    throw new Error('User not found')
  }
  
  const userData = userSnap.data()
  const joinedChannelIds = (userData.joinedChannelIds || []).filter(id => id !== channelId)
  
  await updateDoc(userRef, {
    joinedChannelIds
  })
}

/**
 * Set the active channel for a user
 * @param {string} userId
 * @param {string} channelId
 * @returns {Promise<void>}
 */
export async function setActiveChannel(userId, channelId) {
  if (!channelId) {
    throw new Error('Channel ID is required')
  }

  const userRef = await getUserRef(userId)
  const userSnap = await getDoc(userRef)

  if (!userSnap.exists()) {
    throw new Error('User not found')
  }

  const joinedIds = userSnap.data().joinedChannelIds || []
  if (!joinedIds.includes(channelId)) {
    throw new Error('User is not a member of this channel')
  }

  await updateDoc(userRef, {
    activeChannelId: channelId,
    updatedAt: serverTimestamp(),
    lastActiveAt: serverTimestamp()
  })
}

/**
 * Join a channel using its join code.
 * @param {string} userId
 * @param {string} joinCode
 * @returns {Promise<{channels: Array, activeChannelId: string | null}>}
 */
export async function joinChannelByCode(userId, joinCode) {
  const sanitized = joinCode?.trim()
  if (!sanitized) {
    throw new Error('A join code is required')
  }

  const channel = await findChannelByCode(sanitized)
  if (!channel) {
    throw new Error('No channel found with that code')
  }

  const userRef = await getUserRef(userId)
  const userSnap = await getDoc(userRef)
  if (!userSnap.exists()) {
    throw new Error('User not found')
  }

  const userData = userSnap.data()
  const joinedIds = Array.isArray(userData.joinedChannelIds) ? userData.joinedChannelIds : []
  if (joinedIds.includes(channel.id)) {
    throw new Error('You are already a member of that channel')
  }

  const updates = {
    joinedChannelIds: arrayUnion(channel.id),
    updatedAt: serverTimestamp(),
    lastActiveAt: serverTimestamp()
  }

  if (!userData.activeChannelId) {
    updates.activeChannelId = channel.id
  }

  await updateDoc(userRef, updates)

  const updatedSnap = await getDoc(userRef)
  const updatedData = updatedSnap.data()
  const confirmedJoinedIds = Array.isArray(updatedData.joinedChannelIds) ? updatedData.joinedChannelIds : []

  if (!confirmedJoinedIds.includes(channel.id)) {
    throw new Error('Channel join did not persist. Please try again.')
  }

  console.log('[channelService:joinChannelByCode]', {
    userId,
    email: updatedData.email || null,
    channelJoined: { id: channel.id, name: channel.name },
    joinedChannelIds: confirmedJoinedIds
  })

  const membership = await getUserChannels(userId)

  return {
    ...membership,
    joinedChannel: channel
  }
}

/**
 * Fetch checked-in members for a channel.
 * Default channel returns all checked-in users; otherwise filter by membership.
 * @param {string | null} channelId
 * @param {boolean} isDefaultChannel
 * @returns {Promise<Array>} Array of checked-in user summaries
 */
export async function getCheckedInChannelMembers(channelId, isDefaultChannel = false) {
  const usersRef = collection(db, 'users')
  const constraints = [where('checkInStatus', '==', true)]

  if (!isDefaultChannel && channelId) {
    constraints.push(where('joinedChannelIds', 'array-contains', channelId))
  }

  const q = query(usersRef, ...constraints)
  const snapshot = await getDocs(q)

  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data()
    return {
      id: docSnap.id,
      name: data.fullName || data.displayName || 'Ukendt',
      initials: data.initials || '',
      avatarGradient: data.avatarGradient || 'from-slate-400 to-indigo-500',
      checkInStatus: true,
      currentLocation: data.currentLocation || null
    }
  })
}

/**
 * Add a comment to a channel
 * @param {string} channelId - Channel ID
 * @param {Object} commentData - Comment data
 * @param {string} commentData.userId - User ID
 * @param {string} commentData.userName - User name (for display)
 * @param {string} commentData.content - Comment content
 * @returns {Promise<string>} Comment document ID
 */
export async function addComment(channelId, { userId, userName, content }) {
  if (!userId || !userName || !content) {
    throw new Error('userId, userName, and content are required to add a comment')
  }
  
  const commentsRef = collection(db, 'channels', channelId, 'comments')
  
  const commentDoc = {
    userId,
    userName,
    content,
    timestamp: serverTimestamp(),
    editedAt: null
  }
  
  const docRef = await addDoc(commentsRef, commentDoc)
  return docRef.id
}
