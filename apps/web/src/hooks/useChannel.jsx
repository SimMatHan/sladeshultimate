import { useState, useEffect, useCallback } from 'react'
import { ensureDefaultChannelExists, getChannelsForUser, ensureBalladeChannelExists } from '../services/channelService'
import { useAuth } from './useAuth'

const STORAGE_KEY = 'selectedChannelId'

/**
 * Custom hook for managing channel selection
 * Loads/saves selectedChannelId from localStorage
 * Defaults to default channel if no selection
 * Returns selected channel, setter, available channels, and loading state
 */
export function useChannel() {
  const { currentUser } = useAuth()
  const [selectedChannelId, setSelectedChannelIdState] = useState(null)
  const [selectedChannel, setSelectedChannel] = useState(null)
  const [channels, setChannels] = useState([])
  const [loading, setLoading] = useState(true)

  // Load selected channel ID from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    setSelectedChannelIdState(stored)
  }, [])

  // Fetch default channel and user's channels
  useEffect(() => {
    let isMounted = true

    async function loadChannels() {
      if (!currentUser) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)

        // Ensure default channel exists (creates it if it doesn't)
        const defaultChannel = await ensureDefaultChannelExists()

        // Ensure Ballade channel exists
        const balladeChannel = await ensureBalladeChannelExists()

        // Get user's channels
        const userChannels = await getChannelsForUser(currentUser.uid)
        
        if (!isMounted) return

        // Start with default channel and Ballade (always available)
        const allChannels = [defaultChannel]
        if (balladeChannel && !allChannels.find(ch => ch.id === balladeChannel.id)) {
          allChannels.push(balladeChannel)
        }
        
        // Add other user channels
        userChannels.forEach(ch => {
          if (ch.id !== defaultChannel.id && ch.id !== balladeChannel?.id) {
            allChannels.push(ch)
          }
        })
        
        setChannels(allChannels)

        // Determine selected channel
        const storedId = localStorage.getItem(STORAGE_KEY)
        let channelToSelect = defaultChannel

        if (storedId) {
          const storedChannel = allChannels.find(ch => ch.id === storedId)
          if (storedChannel) {
            channelToSelect = storedChannel
          }
        }

        setSelectedChannel(channelToSelect)
        setSelectedChannelIdState(channelToSelect.id)
        
        // Ensure localStorage is set
        if (!storedId || storedId !== channelToSelect.id) {
          localStorage.setItem(STORAGE_KEY, channelToSelect.id)
        }
      } catch (error) {
        console.error('Error loading channels:', error)
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    loadChannels()

    return () => {
      isMounted = false
    }
  }, [currentUser])

  // Set selected channel
  const setSelectedChannelId = useCallback((channelId) => {
    if (!channelId) return

    const channel = channels.find(ch => ch.id === channelId)
    if (!channel) {
      console.error('Channel not found:', channelId)
      return
    }

    setSelectedChannel(channel)
    setSelectedChannelIdState(channelId)
    localStorage.setItem(STORAGE_KEY, channelId)
  }, [channels])

  return {
    selectedChannel,
    setSelectedChannel: setSelectedChannelId,
    channels,
    loading
  }
}

