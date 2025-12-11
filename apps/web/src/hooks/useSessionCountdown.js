import { useEffect, useRef, useState } from 'react'

/**
 * Counts down while the component is mounted. Resets on unmount/remount,
 * so the duration only covers the current session.
 */
export function useSessionCountdown({ durationMs, isEnabled = true }) {
  const [remainingMs, setRemainingMs] = useState(durationMs)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (!isEnabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      setRemainingMs(durationMs)
      return undefined
    }

    const startTime = Date.now()

    const tick = () => {
      const elapsed = Date.now() - startTime
      const remaining = Math.max(0, durationMs - elapsed)
      setRemainingMs(remaining)
      if (remaining === 0 && intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    intervalRef.current = setInterval(tick, 1000)
    tick()

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [durationMs, isEnabled])

  return {
    remainingMs,
    isElapsed: isEnabled && remainingMs === 0,
  }
}
