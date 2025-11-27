import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { ACHIEVEMENTS } from '../config/achievements'
import { useDrinkLog } from './DrinkLogContext'
import { useUserData } from './UserDataContext'
import { useAuth } from '../hooks/useAuth'
import { recordAchievementUnlock } from '../services/userService'

const AchievementContext = createContext(null)

export function AchievementProvider({ children }) {
  const { currentUser } = useAuth()
  const { userData, refreshUserData } = useUserData()
  const { currentRunDrinkCount } = useDrinkLog()
  const [overlayQueue, setOverlayQueue] = useState([])
  const [currentUnlockedAchievement, setCurrentUnlockedAchievement] = useState(null)
  const [isAchievementOverlayOpen, setIsAchievementOverlayOpen] = useState(false)
  const processedThisRunRef = useRef(new Set())
  const processedTotalsRef = useRef(new Set())

  const achievementsByType = useMemo(() => {
    return ACHIEVEMENTS.reduce((acc, achievement) => {
      if (!acc[achievement.type]) {
        acc[achievement.type] = []
      }
      acc[achievement.type].push(achievement)
      return acc
    }, {})
  }, [])

  useEffect(() => {
    processedTotalsRef.current = new Set()
    processedThisRunRef.current = new Set()
  }, [currentUser?.uid])

  useEffect(() => {
    if (currentRunDrinkCount === 0 && processedThisRunRef.current.size > 0) {
      processedThisRunRef.current = new Set()
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
      const hasUnlockedBefore = !!userData?.achievements?.[achievement.id]

      if (!hasUnlockedBefore) {
        queueOverlayAchievement(achievement)
      }

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
      const alreadyProcessed = processedThisRunRef.current.has(achievement.id)
      if (currentRunDrinkCount >= achievement.threshold && !alreadyProcessed) {
        processedThisRunRef.current.add(achievement.id)
        unlockAchievement(achievement)
      }
    })
  }, [currentRunDrinkCount, currentUser, achievementsByType, unlockAchievement])

  useEffect(() => {
    if (!currentUser || !userData) return

    const totalResets = userData.totalRunResets || 0
    const totalBeers = userData.drinkTypes?.beer || 0
    const totalWines = userData.drinkTypes?.wine || 0

    const checkAchievement = (achievement, hasMetThreshold) => {
      if (!hasMetThreshold || processedTotalsRef.current.has(achievement.id)) {
        return
      }
      processedTotalsRef.current.add(achievement.id)
      unlockAchievement(achievement)
    }

    const resetAchievements = achievementsByType.total_resets || []
    resetAchievements.forEach((achievement) => {
      checkAchievement(achievement, totalResets >= achievement.threshold)
    })

    const drinkAchievements = achievementsByType.total_drinks || []
    drinkAchievements.forEach((achievement) => {
      checkAchievement(achievement, totalBeers >= achievement.threshold)
    })

    const wineAchievements = achievementsByType.total_wine_drinks || []
    wineAchievements.forEach((achievement) => {
      checkAchievement(achievement, totalWines >= achievement.threshold)
    })
  }, [achievementsByType, currentUser, unlockAchievement, userData])

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

