import { useEffect, useState, useRef, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import { useLocation } from '../contexts/LocationContext'
import { useChannel } from '../hooks/useChannel'
import { useScrollLock } from '../hooks/useScrollLock'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix for default marker icons in react-leaflet
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

// Custom user location marker icon (red for current user)
const userLocationIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="12" fill="#FF385C" stroke="white" stroke-width="3"/>
      <circle cx="16" cy="16" r="6" fill="white"/>
    </svg>
  `),
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16],
})

// Custom other user marker icon (blue)
const otherUserIcon = (gradient) => {
  // Extract colors from gradient for icon (simplified - using a generic blue)
  return new L.Icon({
    iconUrl: 'data:image/svg+xml;base64,' + btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
        <circle cx="14" cy="14" r="11" fill="#3B82F6" stroke="white" stroke-width="2.5"/>
        <circle cx="14" cy="14" r="5" fill="white"/>
      </svg>
    `),
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  })
}

// Component to handle map resize
function MapResizeHandler() {
  const map = useMap()
  
  useEffect(() => {
    // Ensure map resizes when container size changes
    const resizeMap = () => {
      setTimeout(() => {
        map.invalidateSize()
      }, 100)
    }
    
    // Initial resize
    resizeMap()
    
    // Listen for window resize events
    window.addEventListener('resize', resizeMap)
    
    // Also listen for orientation changes on mobile
    window.addEventListener('orientationchange', resizeMap)
    
    return () => {
      window.removeEventListener('resize', resizeMap)
      window.removeEventListener('orientationchange', resizeMap)
    }
  }, [map])
  
  return null
}

// Component to center map on user location when it changes
function MapCenterHandler({ center, skipAutoCenter }) {
  const map = useMap()
  
  useEffect(() => {
    if (center && !skipAutoCenter) {
      // Only center if the location has changed significantly (more than ~50m)
      const currentCenter = map.getCenter()
      const distance = map.distance(currentCenter, center)
      if (distance > 50) {
        map.setView(center, map.getZoom(), { animate: true, duration: 0.5 })
      }
    }
  }, [center, map, skipAutoCenter])
  
  return null
}

// Component to store map instance in a ref
function MapInstanceSetter({ mapRef }) {
  const map = useMap()
  
  useEffect(() => {
    mapRef.current = map
    return () => {
      mapRef.current = null
    }
  }, [map, mapRef])
  
  return null
}

// User Pin Overlay Component
function UserPinOverlay({ user, onClose }) {
  const formatTimeAgo = (timestamp) => {
    const now = Date.now()
    const diff = now - timestamp
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return 'Lige nu'
    if (minutes < 60) return `${minutes} min siden`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours} time${hours > 1 ? 'r' : ''} siden`
    const days = Math.floor(hours / 24)
    return `${days} dag${days > 1 ? 'e' : ''} siden`
  }

  return (
    <div 
      className="fixed inset-0 z-40 flex items-center justify-center px-6 py-8 backdrop-blur-sm overlay-backdrop" 
      onClick={onClose}
    >
      <div 
        className="w-full max-w-[calc(100%-48px)] sm:max-w-[360px] rounded-[28px] p-6 shadow-[0_24px_60px_rgba(15,23,42,0.25)]" 
        style={{ backgroundColor: 'var(--surface)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <UserAvatar user={user} />
            <div>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{user.name}</h3>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                {user.location.venue} • {formatTimeAgo(user.location.timestamp)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-transparent p-1 text-xl leading-none transition"
            style={{ color: 'var(--muted)' }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = 'var(--subtle)';
              e.target.style.color = 'var(--ink)';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = 'transparent';
              e.target.style.color = 'var(--muted)';
            }}
            aria-label="Luk"
          >
            ×
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div className="rounded-2xl border px-4 py-3" style={{ borderColor: 'var(--line)', backgroundColor: 'var(--subtle)' }}>
            <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--muted)' }}>
              Nuværende placering
            </div>
            <div className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
              {user.location.venue}
            </div>
            <div className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
              {formatTimeAgo(user.location.timestamp)}
            </div>
          </div>

          <div className="rounded-2xl border px-4 py-3" style={{ borderColor: 'var(--line)', backgroundColor: 'var(--subtle)' }}>
            <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--muted)' }}>
              Nuværende runde
            </div>
            <div className="text-lg font-semibold" style={{ color: 'var(--ink)' }}>
              {user.currentRunDrinkCount?.toLocaleString('da-DK') || '0'} drinks
            </div>
          </div>

          <div className="rounded-2xl border px-4 py-3" style={{ borderColor: 'var(--line)', backgroundColor: 'var(--subtle)' }}>
            <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--muted)' }}>
              Total drinks
            </div>
            <div className="text-lg font-semibold" style={{ color: 'var(--ink)' }}>
              {user.totalDrinks.toLocaleString('da-DK')}
            </div>
          </div>
        </div>

        <div className="mt-6">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex w-full items-center justify-center rounded-2xl border px-4 py-3 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{ 
              borderColor: 'var(--line)',
              color: 'var(--ink)',
              '--tw-ring-color': 'var(--line)',
              '--tw-ring-offset-color': 'var(--bg)'
            }}
            onMouseEnter={(e) => {
              e.target.style.borderColor = 'var(--line)';
              e.target.style.color = 'var(--ink)';
            }}
            onMouseLeave={(e) => {
              e.target.style.borderColor = 'var(--line)';
              e.target.style.color = 'var(--ink)';
            }}
          >
            Luk
          </button>
        </div>
      </div>
    </div>
  )
}

function UserAvatar({ user }) {
  const gradient = user.avatarGradient || 'from-gray-400 to-gray-600'
  const emoji = user.profileEmoji
  
  // Use emoji if available, otherwise fall back to initials
  if (emoji) {
    return (
      <div
        className={`relative inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br ${gradient} shadow-[0_14px_30px_rgba(15,23,42,0.16)] ring-2`}
        style={{ '--tw-ring-color': 'var(--surface)' }}
      >
        <span className="text-xl">{emoji}</span>
      </div>
    )
  }
  
  // Fallback to initials
  return (
    <div
      className={`relative inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br ${gradient} font-semibold text-white shadow-[0_14px_30px_rgba(15,23,42,0.16)] ring-2`}
      style={{ '--tw-ring-color': 'var(--surface)' }}
    >
      <span className="text-base">{user.initials || '??'}</span>
    </div>
  )
}

export default function MapPage() {
  const { selectedChannel } = useChannel()
  const { userLocation, otherUsers } = useLocation()
  const [selectedUser, setSelectedUser] = useState(null)
  const [skipAutoCenter, setSkipAutoCenter] = useState(false)
  const mapRef = useRef(null)
  const containerRef = useRef(null)
  const savedMapStateRef = useRef(null)
  const visibleUsers = useMemo(
    () => otherUsers.filter((user) => user.checkedIn !== false),
    [otherUsers]
  )

  // Channel filtering is handled in LocationContext, which filters otherUsers based on selectedChannel
  // Map displays only users from the active channel (or all users if default channel is selected)

  // Ensure map resizes when container size changes
  useEffect(() => {
    if (!containerRef.current) return
    
    const resizeMap = () => {
      // Delay to ensure map is ready
      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.invalidateSize()
        }
      }, 150)
    }
    
    // Use ResizeObserver to detect container size changes
    const resizeObserver = new ResizeObserver(resizeMap)
    resizeObserver.observe(containerRef.current)
    
    // Also trigger on initial mount after a delay to ensure map is initialized
    const initialTimeout = setTimeout(resizeMap, 300)
    
    return () => {
      resizeObserver.disconnect()
      clearTimeout(initialTimeout)
    }
  }, [])

  const handleCenterOnMe = () => {
    if (userLocation && mapRef.current) {
      mapRef.current.setView([userLocation.lat, userLocation.lng], 15, { 
        animate: true, 
        duration: 0.5 
      })
    }
  }

  // Lock scroll when overlay is open
  useScrollLock(!!selectedUser)

  // Store map state when overlay opens
  useEffect(() => {
    if (selectedUser && mapRef.current) {
      const center = mapRef.current.getCenter()
      const zoom = mapRef.current.getZoom()
      savedMapStateRef.current = { center, zoom }
    }
  }, [selectedUser])

  // Restore map state when overlay closes
  const handleCloseOverlay = () => {
    if (mapRef.current && savedMapStateRef.current) {
      const { center, zoom } = savedMapStateRef.current
      // Temporarily disable auto-centering
      setSkipAutoCenter(true)
      // Restore the saved map state
      mapRef.current.setView([center.lat, center.lng], zoom, { animate: false })
      // Re-enable auto-centering after a short delay
      setTimeout(() => {
        setSkipAutoCenter(false)
      }, 1000)
    }
    setSelectedUser(null)
  }

  useEffect(() => {
    if (!selectedUser) return
    const stillVisible = visibleUsers.some((user) => user.id === selectedUser.id)
    if (!stillVisible) {
      handleCloseOverlay()
    }
  }, [selectedUser, visibleUsers])

  return (
    <div 
      ref={containerRef}
      className="map-page-wrapper relative" 
      style={{ 
        height: 'calc(100dvh - var(--topbar-height) - var(--tabbar-height))'
      }}
    >
      <div className="map-container relative w-full h-full">
          <MapContainer
            center={userLocation ? [userLocation.lat, userLocation.lng] : [55.6761, 12.5683]}
            zoom={13}
            style={{ width: '100%', height: '100%', zIndex: 0 }}
            scrollWheelZoom={true}
            whenCreated={(map) => {
              mapRef.current = map
              // Ensure map resizes properly on initial load
              setTimeout(() => {
                map.invalidateSize()
              }, 100)
            }}
          >
            <MapResizeHandler />
            <MapInstanceSetter mapRef={mapRef} />
            {userLocation && (
              <>
                <MapCenterHandler 
                  center={[userLocation.lat, userLocation.lng]} 
                  skipAutoCenter={skipAutoCenter}
                />
                <Marker
                  position={[userLocation.lat, userLocation.lng]}
                  icon={userLocationIcon}
                />
              </>
            )}
            {visibleUsers.map((user) => (
              <Marker
                key={user.id}
                position={[user.location.lat, user.location.lng]}
                icon={otherUserIcon(user.avatarGradient)}
                eventHandlers={{
                  click: () => {
                    setSelectedUser(user)
                  },
                }}
              />
            ))}
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png"
              subdomains="abcd"
              maxZoom={19}
            />
          </MapContainer>
      
      {userLocation && (
        <button
          type="button"
          onClick={handleCenterOnMe}
          disabled={!!selectedUser}
          className={`center-on-me-button ${selectedUser ? 'center-on-me-button--disabled' : ''}`}
          aria-label="Center on my location"
          title="Center on my location"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2v4m0 12v4M2 12h4m12 0h4M19.07 19.07l-2.83-2.83M6.34 6.34L3.51 3.51M19.07 4.93l-2.83 2.83M6.34 17.66L3.51 20.49" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      )}
      
      {selectedUser && (
        <UserPinOverlay
          user={selectedUser}
          onClose={handleCloseOverlay}
        />
      )}
      </div>
    </div>
  )
}

