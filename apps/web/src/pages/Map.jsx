import { useEffect, useState, useRef, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import { useNavigate } from 'react-router-dom'
import { useLocation } from '../contexts/LocationContext'
import { useChannel } from '../hooks/useChannel'
import { useAuth } from '../hooks/useAuth'
import PageTransition from '../components/PageTransition'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MAP_TILE_LAYER_PROPS } from '../utils/mapTiles'
import { db } from '../firebase'
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, serverTimestamp, Timestamp } from 'firebase/firestore'

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

// Custom stress beacon marker icon (orange/red warning)
const beaconIcon = (isActive) => {
  const color = isActive ? '#FF385C' : '#FFA500'
  return new L.Icon({
    iconUrl: 'data:image/svg+xml;base64,' + btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="14" fill="${color}" stroke="white" stroke-width="3" opacity="0.9"/>
        <path d="M18 10 L18 20 M18 24 L18 26" stroke="white" stroke-width="3" stroke-linecap="round"/>
      </svg>
    `),
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
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
  const lastCenteredRef = useRef(null)

  useEffect(() => {
    if (!center || skipAutoCenter) return

    const targetLatLng = L.latLng(center[0], center[1])
    const lastCentered = lastCenteredRef.current
    const hasLocationChanged = !lastCentered || map.distance(lastCentered, targetLatLng) > 5

    if (!hasLocationChanged) return

    const currentCenter = map.getCenter()
    const distanceToTarget = map.distance(currentCenter, targetLatLng)

    if (distanceToTarget > 50) {
      map.setView(targetLatLng, map.getZoom(), { animate: true, duration: 0.5 })
    }

    lastCenteredRef.current = targetLatLng
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

// Component to handle map clicks for beacon placement
function MapClickHandler({ onClick, enabled }) {
  const map = useMap()

  useEffect(() => {
    if (!enabled || !onClick) return

    const handleClick = (e) => {
      onClick(e)
    }

    map.on('click', handleClick)

    return () => {
      map.off('click', handleClick)
    }
  }, [map, onClick, enabled])

  return null
}

export default function MapPage() {
  // CHANNEL FILTERING: All users shown on the map are filtered by the active channel.
  // The activeChannelId comes from useChannel() hook via LocationContext.
  // LocationContext filters otherUsers by channel membership using Firestore query:
  // where('joinedChannelIds', 'array-contains', activeChannelId).
  // Only users from the active channel appear as markers on the map.
  const { selectedChannel } = useChannel()
  const { userLocation, otherUsers, updateLocation, locationError, locationPermission, hasRequestedLocation } = useLocation()
  const { currentUser } = useAuth()
  const [skipAutoCenter, setSkipAutoCenter] = useState(false)
  const [isRequestingLocation, setIsRequestingLocation] = useState(false)
  const [hasTriedLocation, setHasTriedLocation] = useState(false)
  const mapRef = useRef(null)
  const containerRef = useRef(null)
  const navigate = useNavigate()

  // Stress Beacon state
  const [beacons, setBeacons] = useState([])
  const [stagedBeacon, setStagedBeacon] = useState(null) // Beacon being placed/moved by admin
  const [isPlacingBeacon, setIsPlacingBeacon] = useState(false)

  // Check if current user is admin
  const isAdmin = currentUser?.email === 'simonmathiashansen@gmail.com'

  const visibleUsers = useMemo(
    () => otherUsers.filter((user) => user.checkedIn !== false),
    [otherUsers]
  )

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

  useEffect(() => {
    let isMounted = true
    const requestLocation = async () => {
      setIsRequestingLocation(true)
      setHasTriedLocation(true)

      // Check if permission is already granted
      // If so, get location silently. Otherwise, prompt the user.
      const shouldPrompt = locationPermission !== 'granted'

      await updateLocation({ allowPrompt: shouldPrompt })
      if (isMounted) {
        setIsRequestingLocation(false)
      }
    }

    requestLocation()
    return () => {
      isMounted = false
    }
  }, []) // Only run on mount, not when locationPermission changes

  // Listen to active beacons in realtime
  useEffect(() => {
    const beaconsRef = collection(db, 'stressBeacons')
    const beaconsQuery = query(beaconsRef, where('active', '==', true))

    const unsubscribe = onSnapshot(beaconsQuery, (snapshot) => {
      const activeBeacons = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setBeacons(activeBeacons)
    }, (error) => {
      console.error('[Map] Failed to load beacons', error)
    })

    return () => unsubscribe()
  }, [])

  // Listen to staged beacons (admin only)
  useEffect(() => {
    if (!isAdmin) return

    const beaconsRef = collection(db, 'stressBeacons')
    const stagedQuery = query(beaconsRef, where('active', '==', false))

    const unsubscribe = onSnapshot(stagedQuery, (snapshot) => {
      if (snapshot.docs.length > 0) {
        const staged = snapshot.docs[0]
        const data = staged.data()
        setStagedBeacon({
          id: staged.id,
          lat: data.location.lat,
          lng: data.location.lng
        })
      } else {
        setStagedBeacon(null)
      }
    }, (error) => {
      console.error('[Map] Failed to load staged beacons', error)
    })

    return () => unsubscribe()
  }, [isAdmin])

  // Beacon handlers (admin only)
  const handleMapClick = async (e) => {
    if (!isAdmin || !mapRef.current) return

    const { lat, lng } = e.latlng

    // Create a new staged beacon
    try {
      const beaconRef = await addDoc(collection(db, 'stressBeacons'), {
        location: { lat, lng },
        active: false,
        expiresAt: null,
        createdBy: currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })

      setStagedBeacon({ id: beaconRef.id, lat, lng })
    } catch (error) {
      console.error('[Map] Failed to create staged beacon', error)
    }
  }

  const handleBeaconDragEnd = async (beaconId, e) => {
    if (!isAdmin) return

    const { lat, lng } = e.target.getLatLng()

    try {
      await updateDoc(doc(db, 'stressBeacons', beaconId), {
        location: { lat, lng },
        updatedAt: serverTimestamp()
      })
    } catch (error) {
      console.error('[Map] Failed to update beacon position', error)
    }
  }

  const handleStartBeacon = async (beaconId) => {
    if (!isAdmin) return

    try {
      const now = new Date()
      const expiresAt = Timestamp.fromDate(new Date(now.getTime() + 2 * 60 * 60 * 1000)) // 2 hours

      await updateDoc(doc(db, 'stressBeacons', beaconId), {
        active: true,
        expiresAt,
        updatedAt: serverTimestamp()
      })

      setStagedBeacon(null)
    } catch (error) {
      console.error('[Map] Failed to start beacon', error)
    }
  }

  const handleStopBeacon = async (beaconId) => {
    if (!isAdmin) return

    if (!window.confirm('Er du sikker på, at du vil stoppe denne beacon?')) {
      return
    }

    try {
      await deleteDoc(doc(db, 'stressBeacons', beaconId))
      setStagedBeacon(null)
    } catch (error) {
      console.error('[Map] Failed to stop beacon', error)
    }
  }

  const handleCenterOnMe = () => {
    if (userLocation && mapRef.current) {
      mapRef.current.setView([userLocation.lat, userLocation.lng], 15, {
        animate: true,
        duration: 0.5
      })
    }
  }

  const handleRequestLocation = async () => {
    setIsRequestingLocation(true)
    setHasTriedLocation(true)
    await updateLocation({ allowPrompt: true })
    setIsRequestingLocation(false)
  }

  const showLocationNotice = !userLocation && (hasTriedLocation || hasRequestedLocation)
  const locationMessage = locationError
    ? locationError
    : locationPermission === 'denied'
      ? 'Du har afvist adgang til placering. Tillad adgang for at se din position.'
      : 'Tillad adgang til din placering for at se dig selv pa kortet.'

  return (
    <PageTransition>
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
            <MapClickHandler onClick={handleMapClick} enabled={isAdmin && !stagedBeacon} />
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
                    navigate(`/profile/${user.id}`, { state: { profile: user, from: 'map' } })
                  },
                }}
              />
            ))}

            {/* Active Beacons - visible to all users */}
            {beacons.map((beacon) => (
              <Marker
                key={beacon.id}
                position={[beacon.location.lat, beacon.location.lng]}
                icon={beaconIcon(true)}
                draggable={isAdmin}
                eventHandlers={isAdmin ? {
                  dragend: (e) => handleBeaconDragEnd(beacon.id, e)
                } : {}}
              >
                {isAdmin && (
                  <Popup>
                    <div style={{ padding: '8px', minWidth: '200px' }}>
                      <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 'bold' }}>
                        Aktiv Stress Beacon
                      </h3>
                      <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#666' }}>
                        Position: {beacon.location.lat.toFixed(5)}, {beacon.location.lng.toFixed(5)}
                      </p>
                      <button
                        onClick={() => handleStopBeacon(beacon.id)}
                        style={{
                          width: '100%',
                          padding: '8px',
                          backgroundColor: '#FF385C',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: '600'
                        }}
                      >
                        Stop Beacon
                      </button>
                    </div>
                  </Popup>
                )}
              </Marker>
            ))}

            {/* Staged Beacon - only visible to admin */}
            {isAdmin && stagedBeacon && (
              <Marker
                key={`staged-${stagedBeacon.id}`}
                position={[stagedBeacon.lat, stagedBeacon.lng]}
                icon={beaconIcon(false)}
                draggable={true}
                eventHandlers={{
                  dragend: (e) => handleBeaconDragEnd(stagedBeacon.id, e)
                }}
              >
                <Popup>
                  <div style={{ padding: '8px', minWidth: '200px' }}>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 'bold' }}>
                      Ny Stress Beacon
                    </h3>
                    <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#666' }}>
                      Position: {stagedBeacon.lat.toFixed(5)}, {stagedBeacon.lng.toFixed(5)}
                    </p>
                    <p style={{ margin: '0 0 12px 0', fontSize: '11px', color: '#999' }}>
                      Træk markøren for at justere position. Klik "Start" for at aktivere beaconen.
                    </p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => handleStartBeacon(stagedBeacon.id)}
                        style={{
                          flex: 1,
                          padding: '8px',
                          backgroundColor: '#10B981',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: '600'
                        }}
                      >
                        Start
                      </button>
                      <button
                        onClick={() => handleStopBeacon(stagedBeacon.id)}
                        style={{
                          flex: 1,
                          padding: '8px',
                          backgroundColor: '#EF4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: '600'
                        }}
                      >
                        Slet
                      </button>
                    </div>
                  </div>
                </Popup>
              </Marker>
            )}

            <TileLayer {...MAP_TILE_LAYER_PROPS} />
          </MapContainer>

          {showLocationNotice && (
            <div className="absolute left-4 right-4 top-4 z-[1100] rounded-2xl border border-[color:var(--line,#e5e7eb)] bg-white/90 px-4 py-3 shadow-lg backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/90">
              <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                Aktiver placering
              </p>
              <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--muted,#6b7280)' }}>
                {locationMessage}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRequestLocation}
                  disabled={isRequestingLocation}
                  className="rounded-xl bg-[color:var(--brand,#FF385C)] px-3 py-2 text-xs font-semibold text-[color:var(--brand-ink,#fff)] shadow-soft disabled:opacity-70"
                >
                  {isRequestingLocation ? 'Henter...' : 'Aktiver placering'}
                </button>
                <span className="text-[11px]" style={{ color: 'var(--muted,#6b7280)' }}>
                  Vi beder kun her for at vise din position.
                </span>
              </div>
            </div>
          )}

          {userLocation && (
            <button
              type="button"
              onClick={handleCenterOnMe}
              className="center-on-me-button"
              aria-label="Centrer på min placering"
              title="Centrer på min placering"
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
        </div>
      </div>
    </PageTransition>
  )
}
