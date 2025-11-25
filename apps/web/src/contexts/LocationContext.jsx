import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { USE_MOCK_DATA } from '../config/env'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import { useChannel } from '../hooks/useChannel'

const LocationContext = createContext(null)

// Mock location service - simulates getting user location
// In production, this would use the browser's Geolocation API
const mockLocationService = {
  // Generate a mock location around Copenhagen with slight random variation
  getCurrentLocation: () => {
    // Base location: Copenhagen city center
    const baseLat = 55.6761
    const baseLng = 12.5683
    
    // Add small random variation (simulating movement within ~500m radius)
    const variation = 0.005 // ~500m
    const lat = baseLat + (Math.random() - 0.5) * variation
    const lng = baseLng + (Math.random() - 0.5) * variation
    
    return {
      lat,
      lng,
      timestamp: Date.now(),
    }
  },
}

// Mock other users with locations and activities
const generateMockUsers = () => {
  const baseLat = 55.6761
  const baseLng = 12.5683
  const variation = 0.01 // ~1km radius for other users
  
  return [
    {
      id: 'sara-holm',
      name: 'Sara Holm',
      initials: 'SH',
      profileEmoji: '🍹',
      avatarGradient: 'from-rose-400 to-orange-500',
      checkedIn: true,
      location: {
        lat: baseLat + (Math.random() - 0.5) * variation,
        lng: baseLng + (Math.random() - 0.5) * variation,
        timestamp: Date.now() - 300000, // 5 minutes ago
        venue: 'HQ Bar',
      },
      recentActivities: [
        { type: 'drink', label: 'Sladesh shot', timestamp: 'I dag • 20:14', venue: 'HQ Bar' },
        { type: 'checkin', label: 'Checket ind', timestamp: 'I dag • 19:30', venue: 'HQ Bar' },
        { type: 'drink', label: 'Passion spritz', timestamp: 'I går • 23:02', venue: 'Bar Nexus' },
      ],
      totalDrinks: 148,
      currentRunDrinkCount: 12,
    },
    {
      id: 'mads-larsen',
      name: 'Mads Larsen',
      initials: 'ML',
      profileEmoji: '🍺',
      avatarGradient: 'from-sky-400 to-indigo-500',
      checkedIn: true,
      location: {
        lat: baseLat + (Math.random() - 0.5) * variation,
        lng: baseLng + (Math.random() - 0.5) * variation,
        timestamp: Date.now() - 600000, // 10 minutes ago
        venue: 'Ølbaren',
      },
      recentActivities: [
        { type: 'drink', label: 'Pilsner', timestamp: 'I dag • 19:45', venue: 'Ølbaren' },
        { type: 'checkin', label: 'Checket ind', timestamp: 'I dag • 19:00', venue: 'Ølbaren' },
        { type: 'drink', label: 'Mosaik IPA', timestamp: 'I går • 22:10', venue: 'Taproom' },
      ],
      totalDrinks: 131,
      currentRunDrinkCount: 8,
    },
    {
      id: 'camilla-beck',
      name: 'Camilla Beck',
      initials: 'CB',
      profileEmoji: '🍸',
      avatarGradient: 'from-purple-400 to-fuchsia-500',
      checkedIn: true,
      location: {
        lat: baseLat + (Math.random() - 0.5) * variation,
        lng: baseLng + (Math.random() - 0.5) * variation,
        timestamp: Date.now() - 900000, // 15 minutes ago
        venue: 'Bar Nexus',
      },
      recentActivities: [
        { type: 'drink', label: 'Raspberry sour', timestamp: 'I dag • 18:55', venue: 'Bar Nexus' },
        { type: 'checkin', label: 'Checket ind', timestamp: 'I dag • 18:30', venue: 'Bar Nexus' },
        { type: 'sladesh', label: 'Sent sladesh', timestamp: 'I går • 23:40', venue: 'Bar Nexus' },
      ],
      totalDrinks: 118,
      currentRunDrinkCount: 15,
    },
    {
      id: 'jonas-mikkelsen',
      name: 'Jonas Mikkelsen',
      initials: 'JM',
      profileEmoji: '🥃',
      avatarGradient: 'from-emerald-400 to-teal-500',
      checkedIn: true,
      location: {
        lat: baseLat + (Math.random() - 0.5) * variation,
        lng: baseLng + (Math.random() - 0.5) * variation,
        timestamp: Date.now() - 1200000, // 20 minutes ago
        venue: 'Stuen',
      },
      recentActivities: [
        { type: 'drink', label: 'Gin & tonic', timestamp: 'I dag • 19:05', venue: 'Stuen' },
        { type: 'checkin', label: 'Checket ind', timestamp: 'I dag • 18:45', venue: 'Stuen' },
        { type: 'drink', label: 'Classic pilsner', timestamp: 'I går • 22:47', venue: 'Taproom' },
      ],
      totalDrinks: 104,
      currentRunDrinkCount: 5,
    },
  ]
}

export function LocationProvider({ children }) {
  const { selectedChannel } = useChannel()
  const [userLocation, setUserLocation] = useState(null)
  const [locationHistory, setLocationHistory] = useState([])
  const [otherUsers, setOtherUsers] = useState(() => USE_MOCK_DATA ? generateMockUsers() : [])
  const [locationError, setLocationError] = useState(null)

  // Initialize location based on environment
  useEffect(() => {
    if (USE_MOCK_DATA) {
      // Use mock location service in development
      const initialLocation = mockLocationService.getCurrentLocation()
      setUserLocation(initialLocation)
      setLocationHistory([initialLocation])
    } else {
      // Use browser's Geolocation API in production
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const location = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              timestamp: Date.now(),
            }
            setUserLocation(location)
            setLocationHistory([location])
            setLocationError(null)
          },
          (error) => {
            console.error('Geolocation error:', error)
            setLocationError(error.message)
            // Fallback to a default location (Copenhagen) if geolocation fails
            const fallbackLocation = {
              lat: 55.6761,
              lng: 12.5683,
              timestamp: Date.now(),
            }
            setUserLocation(fallbackLocation)
            setLocationHistory([fallbackLocation])
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          }
        )
      } else {
        console.warn('Geolocation is not supported by this browser')
        setLocationError('Geolokation understøttes ikke')
        // Fallback to default location
        const fallbackLocation = {
          lat: 55.6761,
          lng: 12.5683,
          timestamp: Date.now(),
        }
        setUserLocation(fallbackLocation)
        setLocationHistory([fallbackLocation])
      }
    }
  }, [])

  // Fetch other users' locations from Firestore (production mode only)
  useEffect(() => {
    if (USE_MOCK_DATA) return

    const fetchOtherUsers = async () => {
      try {
        const usersRef = collection(db, 'users')
        
        // Build query with channel filter if channel is selected and not default
        const channelId = selectedChannel && !selectedChannel.isDefault ? selectedChannel.id : null
        let q = query(usersRef)
        
        // If channelId is provided, filter by activeChannelId
        if (channelId) {
          q = query(usersRef, where('activeChannelId', '==', channelId))
        }
        
        const querySnapshot = await getDocs(q)
        const users = []
        
        querySnapshot.forEach((docSnap) => {
          const userData = docSnap.data()
          if (!userData.checkInStatus) {
            return
          }
          // Filter for users with valid currentLocation
          if (userData.currentLocation && 
              userData.currentLocation.lat && 
              userData.currentLocation.lng) {
            users.push({
              id: docSnap.id,
              name: userData.fullName || userData.displayName || 'Ukendt',
              initials: userData.initials || '??',
              profileEmoji: userData.profileEmoji || null,
              avatarGradient: userData.avatarGradient || 'from-gray-400 to-gray-600',
              checkedIn: true,
              location: {
                lat: userData.currentLocation.lat,
                lng: userData.currentLocation.lng,
                timestamp: userData.currentLocation.timestamp?.toMillis() || Date.now(),
                venue: userData.currentLocation.venue || userData.lastCheckInVenue || 'Ukendt',
              },
              recentActivities: [], // Would need to fetch from subcollections
              totalDrinks: userData.totalDrinks || 0,
              currentRunDrinkCount: userData.currentRunDrinkCount || 0,
            })
          }
        })
        
        setOtherUsers(users)
      } catch (error) {
        console.error('Error fetching other users:', error)
        // Keep existing users or empty array on error
      }
    }

    fetchOtherUsers()
    
    // Set up periodic refresh (every 30 seconds)
    const interval = setInterval(fetchOtherUsers, 30000)
    return () => clearInterval(interval)
  }, [selectedChannel])

  // Function to update location (called when user interacts)
  // This is called when:
  // - User checks in (Home.jsx)
  // - User tracks a beverage (Home.jsx)
  // - User sends a sladesh (Sladesh.jsx)
  // - User makes a comment (TODO: implement when comments feature is added)
  const updateLocation = useCallback(() => {
    if (USE_MOCK_DATA) {
      // Use mock location service in development
      const newLocation = mockLocationService.getCurrentLocation()
      setUserLocation(newLocation)
      setLocationHistory((prev) => [...prev, newLocation].slice(-50)) // Keep last 50 locations
    } else {
      // Use browser's Geolocation API in production
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const newLocation = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              timestamp: Date.now(),
            }
            setUserLocation(newLocation)
            setLocationHistory((prev) => [...prev, newLocation].slice(-50))
            setLocationError(null)
          },
          (error) => {
            console.error('Geolocation error:', error)
            setLocationError(error.message)
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          }
        )
      }
    }
  }, [])

  const value = {
    userLocation,
    locationHistory,
    updateLocation,
    otherUsers,
    locationError,
  }

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  )
}

export function useLocation() {
  const context = useContext(LocationContext)
  if (!context) {
    throw new Error('useLocation must be used within a LocationProvider')
  }
  return context
}

