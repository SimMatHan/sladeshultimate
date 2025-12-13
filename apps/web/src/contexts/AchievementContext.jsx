import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { ACHIEVEMENTS } from '../config/achievements'
import { IS_DEVELOPMENT } from '../config/env'
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

  const getAchievementValue = useCallback(
    (achievement) => {
      const type = achievement?.type
      const variationType = achievement?.variationType
      const hasVariationType = typeof variationType === 'string' && variationType.length > 0
      if (!type) return null

      if (type === 'run_drinks') {
        if (hasVariationType) {
          const runVariationCounts = userData?.drinkVariations?.[variationType] || {}
          return Object.values(runVariationCounts).reduce((sum, value) => sum + value, 0)
        }
        return currentRunDrinkCount
      }

      if (type === 'total_resets') {
        return userData?.totalRunResets || 0
      }

      if (type === 'total_all_drinks') {
        return userData?.totalDrinks || 0
      }

      if (type === 'total_drinks') {
        if (hasVariationType) {
          return userData?.drinkTypes?.[variationType] || 0
        }
        return userData?.totalDrinks || 0
      }

      const drinkTypeMatch = /^total_(.+)_drinks$/.exec(type)
      if (drinkTypeMatch) {
        const drinkType = drinkTypeMatch[1]
        return userData?.drinkTypes?.[drinkType] || 0
      }

      return null
    },
    [currentRunDrinkCount, userData?.drinkTypes, userData?.totalDrinks, userData?.totalRunResets]
  )

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
  }, [currentUser?.uid])

  useEffect(() => {
    if (currentRunDrinkCount === 0) {
      ACHIEVEMENTS.forEach((achievement) => {
        if (achievement.type === 'run_drinks') {
          const key = `${achievement.type}_${achievement.id}`
          lastProcessedValuesRef.current[key] = 0
        }
      })
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

    const checkAchievement = (achievement) => {
      if (!userData && achievement.type !== 'run_drinks') {
        return
      }

      const currentValue = getAchievementValue(achievement)
      if (currentValue === null || currentValue === undefined) {
        return
      }

      const key = `${achievement.type}_${achievement.id}`
      let previousValue = lastProcessedValuesRef.current[key]

      // Initialize with current value if not set (prevents unlocking on first render for totals)
      if (previousValue === undefined) {
        previousValue = achievement.type === 'run_drinks' ? 0 : currentValue
        lastProcessedValuesRef.current[key] = previousValue
        if (achievement.type !== 'run_drinks') {
          return
        }
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

      // Thresholds and variation scopes live in config/achievements.js; keep unlock logic data-driven.
      if (achievement.type === 'run_drinks') {
        if (previousValue < achievement.threshold && currentValue >= achievement.threshold) {
          unlockAchievement(achievement)
        }
      } else {
        // Calculate threshold multiples for previous and current values
        // For threshold 3: unlock at 3, 6, 9, 12, etc.
        const previousMultiples = Math.floor(previousValue / achievement.threshold)
        const currentMultiples = Math.floor(currentValue / achievement.threshold)

        // Unlock if we've crossed a new threshold multiple AND haven't unlocked today
        if (currentMultiples > previousMultiples) {
          if (IS_DEVELOPMENT && achievement.id === 'obeerma') {
            console.debug('[achievements][dev] Obeerma threshold crossed', {
              variationType: achievement.variationType || 'all drinks',
              threshold: achievement.threshold,
              currentValue,
              previousValue,
            })
          }
          unlockAchievement(achievement)
        }
      }

      lastProcessedValuesRef.current[key] = currentValue
    }

    ACHIEVEMENTS.forEach(checkAchievement)
  }, [currentUser, getAchievementValue, unlockAchievement, userData, wasUnlockedToday])

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
