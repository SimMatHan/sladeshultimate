import { useEffect } from 'react'

const STANDALONE_CLASS = 'standalone-scroll-guard'

function getScrollTop() {
  if (typeof window === 'undefined') return 0
  return (
    window.scrollY ||
    document.documentElement?.scrollTop ||
    document.body?.scrollTop ||
    0
  )
}

export default function useStandaloneOverscrollBlock(isStandalone) {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return undefined
    }

    const body = document.body
    if (!body) return undefined

    if (!isStandalone) {
      body.classList.remove(STANDALONE_CLASS)
      return undefined
    }

    const state = {
      startY: 0,
      shouldGuard: false,
    }

    const isAtTop = () => getScrollTop() <= 0

    const handleTouchStart = (event) => {
      if (event.touches.length !== 1) return
      state.startY = event.touches[0].clientY
      state.shouldGuard = isAtTop()
    }

    const handleTouchMove = (event) => {
      if (!state.shouldGuard) return
      const currentY = event.touches[0]?.clientY ?? 0
      const deltaY = currentY - state.startY
      if (deltaY > 0 && isAtTop()) {
        event.preventDefault()
      }
    }

    const handleTouchEnd = () => {
      state.shouldGuard = false
    }

    body.classList.add(STANDALONE_CLASS)
    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: false })
    window.addEventListener('touchend', handleTouchEnd, { passive: true })
    window.addEventListener('touchcancel', handleTouchEnd, { passive: true })

    return () => {
      body.classList.remove(STANDALONE_CLASS)
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
      window.removeEventListener('touchcancel', handleTouchEnd)
    }
  }, [isStandalone])
}


