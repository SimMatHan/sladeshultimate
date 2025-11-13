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
  addDoc
} from 'firebase/firestore'
import { db } from '../firebase'

const DEFAULT_CHANNEL_NAME = 'Den Åbne Kanal'

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
  const userRef = doc(db, 'users', userId)
  const userSnap = await getDoc(userRef)
  
  if (!userSnap.exists()) {
    return []
  }
  
  const userData = userSnap.data()
  const joinedChannelIds = userData.joinedChannelIds || []
  
  if (joinedChannelIds.length === 0) {
    return []
  }
  
  // Fetch all channels the user has joined
  const channels = []
  for (const channelId of joinedChannelIds) {
    const channelRef = doc(db, 'channels', channelId)
    const channelSnap = await getDoc(channelRef)
    if (channelSnap.exists()) {
      channels.push({ id: channelSnap.id, ...channelSnap.data() })
    }
  }
  
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
