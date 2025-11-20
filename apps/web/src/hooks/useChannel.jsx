import { useState, useEffect, useCallback, useMemo } from 'react'
import { getUserChannels, setActiveChannel } from '../services/channelService'
import { useAuth } from './useAuth'

/**
 * Custom hook for managing channel selection
 * Loads user's channels from Firestore and keeps activeChannelId in sync.
 */
export function useChannel() {
  const { currentUser } = useAuth()
  const [channels, setChannels] = useState([])
  const [activeChannelId, setActiveChannelId] = useState(null)
  const [loading, setLoading] = useState(true)

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

  return {
    selectedChannel,
    activeChannelId,
    setSelectedChannel: setSelectedChannelId,
    channels,
    loading,
    refreshChannels
  }
}

