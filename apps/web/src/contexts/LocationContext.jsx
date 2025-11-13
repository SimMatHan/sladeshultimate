import { createContext, useContext, useState, useEffect, useCallback } from 'react'

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
      avatarGradient: 'from-rose-400 to-orange-500',
      location: {
        lat: baseLat + (Math.random() - 0.5) * variation,
        lng: baseLng + (Math.random() - 0.5) * variation,
        timestamp: Date.now() - 300000, // 5 minutes ago
        venue: 'HQ Bar',
      },
      recentActivities: [
        { type: 'drink', label: 'Sladesh shot', timestamp: 'I dag • 20:14', venue: 'HQ Bar' },
        { type: 'checkin', label: 'Checked in', timestamp: 'I dag • 19:30', venue: 'HQ Bar' },
        { type: 'drink', label: 'Passion spritz', timestamp: 'I går • 23:02', venue: 'Bar Nexus' },
      ],
      totalDrinks: 148,
    },
    {
      id: 'mads-larsen',
      name: 'Mads Larsen',
      initials: 'ML',
      avatarGradient: 'from-sky-400 to-indigo-500',
      location: {
        lat: baseLat + (Math.random() - 0.5) * variation,
        lng: baseLng + (Math.random() - 0.5) * variation,
        timestamp: Date.now() - 600000, // 10 minutes ago
        venue: 'Ølbaren',
      },
      recentActivities: [
        { type: 'drink', label: 'Pilsner', timestamp: 'I dag • 19:45', venue: 'Ølbaren' },
        { type: 'checkin', label: 'Checked in', timestamp: 'I dag • 19:00', venue: 'Ølbaren' },
        { type: 'drink', label: 'Mosaik IPA', timestamp: 'I går • 22:10', venue: 'Taproom' },
      ],
      totalDrinks: 131,
    },
    {
      id: 'camilla-beck',
      name: 'Camilla Beck',
      initials: 'CB',
      avatarGradient: 'from-purple-400 to-fuchsia-500',
      location: {
        lat: baseLat + (Math.random() - 0.5) * variation,
        lng: baseLng + (Math.random() - 0.5) * variation,
        timestamp: Date.now() - 900000, // 15 minutes ago
        venue: 'Bar Nexus',
      },
      recentActivities: [
        { type: 'drink', label: 'Raspberry sour', timestamp: 'I dag • 18:55', venue: 'Bar Nexus' },
        { type: 'checkin', label: 'Checked in', timestamp: 'I dag • 18:30', venue: 'Bar Nexus' },
        { type: 'sladesh', label: 'Sent sladesh', timestamp: 'I går • 23:40', venue: 'Bar Nexus' },
      ],
      totalDrinks: 118,
    },
    {
      id: 'jonas-mikkelsen',
      name: 'Jonas Mikkelsen',
      initials: 'JM',
      avatarGradient: 'from-emerald-400 to-teal-500',
      location: {
        lat: baseLat + (Math.random() - 0.5) * variation,
        lng: baseLng + (Math.random() - 0.5) * variation,
        timestamp: Date.now() - 1200000, // 20 minutes ago
        venue: 'Stuen',
      },
      recentActivities: [
        { type: 'drink', label: 'Gin & tonic', timestamp: 'I dag • 19:05', venue: 'Stuen' },
        { type: 'checkin', label: 'Checked in', timestamp: 'I dag • 18:45', venue: 'Stuen' },
        { type: 'drink', label: 'Classic pilsner', timestamp: 'I går • 22:47', venue: 'Taproom' },
      ],
      totalDrinks: 104,
    },
  ]
}

export function LocationProvider({ children }) {
  const [userLocation, setUserLocation] = useState(null)
  const [locationHistory, setLocationHistory] = useState([])
  const [otherUsers, setOtherUsers] = useState(() => generateMockUsers())

  // Initialize with a default location
  useEffect(() => {
    const initialLocation = mockLocationService.getCurrentLocation()
    setUserLocation(initialLocation)
    setLocationHistory([initialLocation])
  }, [])

  // Function to update location (called when user interacts)
  // This is called when:
  // - User checks in (Home.jsx)
  // - User tracks a beverage (Home.jsx)
  // - User sends a sladesh (Sladesh.jsx)
  // - User makes a comment (TODO: implement when comments feature is added)
  const updateLocation = useCallback(() => {
    const newLocation = mockLocationService.getCurrentLocation()
    setUserLocation(newLocation)
    setLocationHistory((prev) => [...prev, newLocation].slice(-50)) // Keep last 50 locations
  }, [])

  const value = {
    userLocation,
    locationHistory,
    updateLocation,
    otherUsers,
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

