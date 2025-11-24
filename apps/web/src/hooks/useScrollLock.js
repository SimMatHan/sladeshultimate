import { useEffect } from 'react';

// Global reference counter to track how many overlays are active
let lockCount = 0;
let bodyOriginalOverflow = null;
let scrollRegionOriginalOverflow = null;

/**
 * Hook to lock body and scroll-region scrolling when overlays are open.
 * Uses reference counting to handle multiple overlays simultaneously.
 * 
 * @param {boolean} isLocked - Whether to apply scroll lock
 */
export function useScrollLock(isLocked) {
  useEffect(() => {
    if (!isLocked) return;

    // Increment lock count
    lockCount++;

    // Store original overflow values on first lock
    if (lockCount === 1) {
      bodyOriginalOverflow = document.body.style.overflow;
      const scrollRegion = document.querySelector('.scroll-region');
      if (scrollRegion) {
        scrollRegionOriginalOverflow = scrollRegion.style.overflow;
      }
    }

    // Apply scroll lock
    document.body.style.overflow = 'hidden';
    const scrollRegion = document.querySelector('.scroll-region');
    if (scrollRegion) {
      scrollRegion.style.overflow = 'hidden';
    }

    // Cleanup: decrement lock count and restore if no more locks
    return () => {
      lockCount--;
      
      if (lockCount === 0) {
        // Restore original overflow values
        document.body.style.overflow = bodyOriginalOverflow || '';
        const scrollRegion = document.querySelector('.scroll-region');
        if (scrollRegion) {
          scrollRegion.style.overflow = scrollRegionOriginalOverflow || '';
        }
        
        // Reset stored values
        bodyOriginalOverflow = null;
        scrollRegionOriginalOverflow = null;
      }
    };
  }, [isLocked]);
}

