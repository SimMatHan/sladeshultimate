import { useEffect } from 'react'

const STANDALONE_CLASS = 'standalone-scroll-guard'

/**
 * FIXED: Get scroll position from the actual scroll container (.scroll-region),
 * not from window/document which may not reflect the actual scroll state.
 */
function getScrollRegionTop() {
  if (typeof document === 'undefined') return 0
  const scrollRegion = document.querySelector('.scroll-region')
  if (!scrollRegion) return 0
  return scrollRegion.scrollTop || 0
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

    /**
     * FIXED: Check the actual .scroll-region scroll position, not window scroll.
     * Only guard when we're at the very top (within 1px to account for rounding).
     */
    const isAtTop = () => {
      const scrollTop = getScrollRegionTop()
      return scrollTop <= 1 // Allow 1px tolerance for rounding
    }

    const handleTouchStart = (event) => {
      if (event.touches.length !== 1) return
      state.startY = event.touches[0].clientY
      // FIXED: Only guard if we're actually at the top of the scroll region
      state.shouldGuard = isAtTop()
    }

    const handleTouchMove = (event) => {
      // FIXED: Only prevent default if:
      // 1. We're guarding (started at top)
      // 2. User is trying to scroll down (deltaY > 0)
      // 3. We're still at the top (double-check to avoid locking mid-scroll)
      if (!state.shouldGuard) return
      
      const currentY = event.touches[0]?.clientY ?? 0
      const deltaY = currentY - state.startY
      
      // Only prevent pull-to-refresh when at the very top and scrolling down
      if (deltaY > 0 && isAtTop()) {
        event.preventDefault()
      } else {
        // If we've scrolled away from top or scrolling up, stop guarding
        state.shouldGuard = false
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


