import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../hooks/useAuth'
import { getUser } from '../services/userService'

const UserDataContext = createContext(null)

export function UserDataProvider({ children }) {
  const { currentUser } = useAuth()
  const [userData, setUserData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchUserData = useCallback(async (silent = false) => {
    if (!currentUser) {
      setUserData(null)
      setLoading(false)
      setError(null)
      return
    }

    try {
      // Only set loading state if not silent (prevents UI reload/buffering)
      if (!silent) {
        setLoading(true)
      }
      setError(null)
      const data = await getUser(currentUser.uid)
      setUserData(data)
    } catch (err) {
      console.error('Error fetching user data:', err)
      setError(err)
      // Don't clear userData on error - keep last known state
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }, [currentUser])

  // Initial fetch when currentUser changes
  useEffect(() => {
    fetchUserData()
  }, [fetchUserData])

  // REALTIME UPDATES: Subscribe to user document changes for live currentRunDrinkCount updates
  // This ensures Home.jsx shows the same realtime data as Leaderboard.jsx and ProfileDetails.jsx
  useEffect(() => {
    if (!currentUser) return

    console.log('[UserDataContext] Setting up realtime listener for user:', currentUser.uid)

    const userRef = doc(db, 'users', currentUser.uid)

    const unsubscribe = onSnapshot(
      userRef,
      (docSnap) => {
        if (!docSnap.exists()) {
          console.warn('[UserDataContext] User document not found:', currentUser.uid)
          return
        }

        const data = docSnap.data()

        console.log('[UserDataContext] Realtime update received:', {
          userId: currentUser.uid,
          currentRunDrinkCount: data.currentRunDrinkCount,
          totalDrinks: data.totalDrinks
        })

        setUserData({ id: currentUser.uid, ...data })
        setError(null)
      },
      (err) => {
        console.error('[UserDataContext] Realtime listener error:', err)
        setError(err)
      }
    )

    return () => {
      console.log('[UserDataContext] Cleaning up realtime listener for user:', currentUser.uid)
      unsubscribe()
    }
  }, [currentUser])

  // Refresh function that can be called manually
  // silent: if true, doesn't set loading state (prevents UI reload/buffering)
  const refreshUserData = useCallback(async (silent = false) => {
    await fetchUserData(silent)
  }, [fetchUserData])

  const value = {
    userData,
    loading,
    error,
    refreshUserData,
  }

  return (
    <UserDataContext.Provider value={value}>
      {children}
    </UserDataContext.Provider>
  )
}

export function useUserData() {
  const context = useContext(UserDataContext)
  if (!context) {
    throw new Error('useUserData must be used within a UserDataProvider')
  }
  return context
}
