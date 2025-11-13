import { useState, useEffect, useCallback } from 'react'
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth'
import { auth } from '../firebase'
import { createUser } from '../services/userService'
import { incrementUserCount } from '../services/statsService'
import { ensureDefaultChannelExists, joinChannel } from '../services/channelService'

/**
 * Custom hook for Firebase Authentication
 * Handles sign up, sign in, sign out, and user state
 * Automatically creates user document in Firestore on signup
 */
export function useAuth() {
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user)
      setLoading(false)
      setError(null)
    })

    return unsubscribe
  }, [])

  /**
   * Sign up a new user with email and password
   * Automatically creates user document in Firestore
   * @param {string} email - User email
   * @param {string} password - User password
   * @param {string} fullName - User's full name (required)
   * @param {string} [displayName] - Optional display name (defaults to fullName)
   * @returns {Promise<UserCredential>}
   */
  const signUp = useCallback(async (email, password, fullName, displayName = null) => {
    try {
      setError(null)
      
      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      const user = userCredential.user

      // Update Firebase Auth profile with display name
      if (displayName || fullName) {
        await updateProfile(user, {
          displayName: displayName || fullName
        })
      }

      // Create user document in Firestore
      await createUser({
        uid: user.uid,
        email: user.email,
        fullName,
        displayName: displayName || fullName
      })

      // Ensure default channel exists and add user to it
      const defaultChannel = await ensureDefaultChannelExists()
      await joinChannel(user.uid, defaultChannel.id)

      // Increment user count in stats
      await incrementUserCount()

      return userCredential
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [])

  /**
   * Sign in an existing user with email and password
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise<UserCredential>}
   */
  const signIn = useCallback(async (email, password) => {
    try {
      setError(null)
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      return userCredential
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [])

  /**
   * Sign out the current user
   * @returns {Promise<void>}
   */
  const signOut = useCallback(async () => {
    try {
      setError(null)
      await firebaseSignOut(auth)
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [])

  return {
    currentUser,
    loading,
    error,
    signUp,
    signIn,
    signOut
  }
}

/**
 * Higher-order component or hook to protect routes
 * Can be used to wrap components that require authentication
 */
export function requireAuth(Component) {
  return function AuthenticatedComponent(props) {
    const { currentUser, loading } = useAuth()

    if (loading) {
      return <div>Loading...</div>
    }

    if (!currentUser) {
      // Redirect to auth page or return null
      return null
    }

    return <Component {...props} />
  }
}
