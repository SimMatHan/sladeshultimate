import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { ACHIEVEMENTS } from '../config/achievements'
import { useDrinkLog } from './DrinkLogContext'
import { useUserData } from './UserDataContext'
import { useAuth } from '../hooks/useAuth'
import { recordAchievementUnlock, getLatestDrinkDayBoundary } from '../services/userService'

const AchievementContext = createContext(null)

export function AchievementProvider({ children }) {
  const { currentUser } = useAuth()
  const { userData, refreshUserData } = useUserData()
  const { currentRunDrinkCount } = useDrinkLog()
  const [overlayQueue, setOverlayQueue] = useState([])
  const [currentUnlockedAchievement, setCurrentUnlockedAchievement] = useState(null)
  const [isAchievementOverlayOpen, setIsAchievementOverlayOpen] = useState(false)
  // Track last processed value for each achievement to detect threshold crossings
  const lastProcessedValuesRef = useRef({})
  const lastRunDrinkCountRef = useRef(0)

  const achievementsByType = useMemo(() => {
    return ACHIEVEMENTS.reduce((acc, achievement) => {
      if (!acc[achievement.type]) {
        acc[achievement.type] = []
      }
      acc[achievement.type].push(achievement)
      return acc
    }, {})
  }, [])

  // Helper to normalize timestamp to Date
  const normalizeToDate = useCallback((value) => {
    if (!value) return null
    if (value instanceof Date) return value
    if (typeof value.toDate === 'function') {
      return value.toDate()
    }
    if (typeof value.seconds === 'number') {
      return new Date(value.seconds * 1000)
    }
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }, [])

  // Check if achievement was unlocked today (using drink day boundary)
  const wasUnlockedToday = useCallback((achievementId) => {
    const achievementData = userData?.achievements?.[achievementId]
    if (!achievementData?.lastUnlockedAt) {
      return false
    }

    const lastUnlockedDate = normalizeToDate(achievementData.lastUnlockedAt)
    if (!lastUnlockedDate) {
      return false
    }

    const now = new Date()
    const latestDrinkDayBoundary = getLatestDrinkDayBoundary(now)
    
    // Check if last unlock was after the current drink day boundary
    return lastUnlockedDate.getTime() >= latestDrinkDayBoundary.getTime()
  }, [userData?.achievements, normalizeToDate])

  useEffect(() => {
    lastProcessedValuesRef.current = {}
    lastRunDrinkCountRef.current = 0
  }, [currentUser?.uid])

  useEffect(() => {
    if (currentRunDrinkCount === 0) {
      lastRunDrinkCountRef.current = 0
    }
  }, [currentRunDrinkCount])

  const queueOverlayAchievement = useCallback((achievement) => {
    setOverlayQueue((queue) => [...queue, achievement])
  }, [])

  const closeAchievementOverlay = useCallback(() => {
    setIsAchievementOverlayOpen(false)
    setCurrentUnlockedAchievement(null)
    setOverlayQueue((queue) => queue.slice(1))
  }, [])

  useEffect(() => {
    if (!currentUnlockedAchievement && overlayQueue.length > 0) {
      setCurrentUnlockedAchievement(overlayQueue[0])
      setIsAchievementOverlayOpen(true)
    }
  }, [overlayQueue, currentUnlockedAchievement])

  const unlockAchievement = useCallback(
    async (achievement) => {
      if (!currentUser) return
      const achievementData = userData?.achievements?.[achievement.id]
      const hasUnlockedBefore = !!achievementData

      // Always show overlay when achievement is unlocked
      queueOverlayAchievement(achievement)

      try {
        await recordAchievementUnlock(currentUser.uid, achievement.id, hasUnlockedBefore)
        await refreshUserData(true)
      } catch (error) {
        console.error('[achievements] Failed to record achievement unlock', error)
      }
    },
    [currentUser, queueOverlayAchievement, refreshUserData, userData?.achievements]
  )

  useEffect(() => {
    if (!currentUser) return

    const runAchievements = achievementsByType.run_drinks || []
    runAchievements.forEach((achievement) => {
      // Check if we've crossed the threshold
      const previousCount = lastRunDrinkCountRef.current
      const currentCount = currentRunDrinkCount
      
      // Check if achievement was already unlocked today (once per drink day limit)
      if (wasUnlockedToday(achievement.id)) {
        // Still update the tracked value but don't unlock
        if (currentCount !== previousCount) {
          lastRunDrinkCountRef.current = currentRunDrinkCount
        }
        return
      }
      
      // Unlock if we've crossed the threshold from below
      if (previousCount < achievement.threshold && currentCount >= achievement.threshold) {
        unlockAchievement(achievement)
      }
    })
    
    lastRunDrinkCountRef.current = currentRunDrinkCount
  }, [currentRunDrinkCount, currentUser, achievementsByType, unlockAchievement, wasUnlockedToday, userData])

  useEffect(() => {
    if (!currentUser || !userData) return

    const totalResets = userData.totalRunResets || 0
    const totalBeers = userData.drinkTypes?.beer || 0
    const totalWines = userData.drinkTypes?.wine || 0
    const totalAllDrinks = userData.totalDrinks || 0

    const checkAchievement = (achievement, currentValue) => {
      const key = `${achievement.type}_${achievement.id}`
      let previousValue = lastProcessedValuesRef.current[key]
      
      // Initialize with current value if not set (prevents unlocking on first render)
      if (previousValue === undefined) {
        lastProcessedValuesRef.current[key] = currentValue
        return
      }
      
      // Only check if value has increased
      if (currentValue <= previousValue) {
        lastProcessedValuesRef.current[key] = currentValue
        return
      }
      
      // Check if achievement was already unlocked today (once per drink day limit)
      if (wasUnlockedToday(achievement.id)) {
        // Still update the tracked value but don't unlock
        lastProcessedValuesRef.current[key] = currentValue
        return
      }
      
      // Calculate threshold multiples for previous and current values
      // For threshold 3: unlock at 3, 6, 9, 12, etc.
      const previousMultiples = Math.floor(previousValue / achievement.threshold)
      const currentMultiples = Math.floor(currentValue / achievement.threshold)
      
      // Unlock if we've crossed a new threshold multiple AND haven't unlocked today
      if (currentMultiples > previousMultiples) {
        unlockAchievement(achievement)
      }
      
      lastProcessedValuesRef.current[key] = currentValue
    }

    const resetAchievements = achievementsByType.total_resets || []
    resetAchievements.forEach((achievement) => {
      checkAchievement(achievement, totalResets)
    })

    const drinkAchievements = achievementsByType.total_drinks || []
    drinkAchievements.forEach((achievement) => {
      checkAchievement(achievement, totalBeers)
    })

    const wineAchievements = achievementsByType.total_wine_drinks || []
    wineAchievements.forEach((achievement) => {
      checkAchievement(achievement, totalWines)
    })

    const allDrinksAchievements = achievementsByType.total_all_drinks || []
    allDrinksAchievements.forEach((achievement) => {
      checkAchievement(achievement, totalAllDrinks)
    })
  }, [achievementsByType, currentUser, unlockAchievement, userData, wasUnlockedToday])

  const value = {
    currentUnlockedAchievement,
    isAchievementOverlayOpen,
    closeAchievementOverlay,
  }

  return <AchievementContext.Provider value={value}>{children}</AchievementContext.Provider>
}

export function useAchievements() {
  const context = useContext(AchievementContext)
  if (!context) {
    throw new Error('useAchievements must be used within an AchievementProvider')
  }
  return context
}

