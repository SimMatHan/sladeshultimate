import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { getUserChannels, setActiveChannel } from '../services/channelService'
import { useAuth } from './useAuth'
import { db } from '../firebase'

/**
 * Custom hook for managing channel selection
 * Loads user's channels from Firestore and keeps activeChannelId in sync.
 */
export function useChannel() {
  const { currentUser } = useAuth()
  const [channels, setChannels] = useState([])
  const [activeChannelId, setActiveChannelId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [switching, setSwitching] = useState(false)
  const hasSeenInitialSnapshotRef = useRef(false)

  const refreshChannels = useCallback(async () => {
    if (!currentUser) {
      setChannels([])
      setActiveChannelId(null)
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const { channels: nextChannels, activeChannelId: nextActiveChannelId } = await getUserChannels(currentUser.uid)
      setChannels(nextChannels)
      setActiveChannelId(nextActiveChannelId)
    } catch (error) {
      console.error('Error loading channels:', error)
    } finally {
      setLoading(false)
    }
  }, [currentUser])

  useEffect(() => {
    refreshChannels()
  }, [refreshChannels])

  // Stay in sync with activeChannelId changes (e.g., when switching from TopBar)
  useEffect(() => {
    if (!currentUser) return undefined

    const userRef = doc(db, 'users', currentUser.uid)
    const unsubscribe = onSnapshot(userRef, (snap) => {
      if (!snap.exists()) return
      const nextActiveId = snap.data()?.activeChannelId || null
      setActiveChannelId((prev) => (prev === nextActiveId ? prev : nextActiveId))
      if (!hasSeenInitialSnapshotRef.current) {
        hasSeenInitialSnapshotRef.current = true
        setLoading(false)
      }
    })

    return () => {
      unsubscribe()
    }
  }, [currentUser])

  const selectedChannel = useMemo(
    () => channels.find(ch => ch.id === activeChannelId) || null,
    [channels, activeChannelId]
  )

  // Set selected channel
  const setSelectedChannelId = useCallback(async (channelId) => {
    if (!channelId) return
    if (!currentUser) return

    const channel = channels.find(ch => ch.id === channelId)
    if (!channel) {
      console.error('Channel not found:', channelId)
      return
    }

    setActiveChannelId(channelId)

    try {
      await setActiveChannel(currentUser.uid, channelId)
    } catch (error) {
      console.error('Failed to set active channel:', error)
      refreshChannels()
    }
  }, [channels, currentUser, refreshChannels])

  const switchChannel = useCallback(async (channelId) => {
    if (!channelId) return
    if (!currentUser) return
    if (channelId === activeChannelId) return

    setSwitching(true)
    try {
      await setActiveChannel(currentUser.uid, channelId)
      await refreshChannels()
    } catch (error) {
      console.error('Failed to switch channel:', error)
      await refreshChannels()
    } finally {
      setSwitching(false)
    }
  }, [activeChannelId, currentUser, refreshChannels])

  return {
    selectedChannel,
    activeChannelId,
    setSelectedChannel: setSelectedChannelId,
    channels,
    loading,
    refreshChannels,
    isChannelSwitching: switching,
    switchChannel
  }
}
