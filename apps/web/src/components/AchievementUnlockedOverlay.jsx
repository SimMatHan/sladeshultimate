import { useEffect } from 'react'

const AUTO_CLOSE_MS = 5600

export default function AchievementUnlockedOverlay({ achievement, onClose }) {
  // Auto-close timer
  useEffect(() => {
    if (!achievement) return undefined
    const timeout = setTimeout(() => {
      onClose?.()
    }, AUTO_CLOSE_MS)
    return () => clearTimeout(timeout)
  }, [achievement, onClose])

  // FIXED: Lock scroll region when overlay is open to prevent background scrolling
  useEffect(() => {
    if (!achievement) return undefined
    
    const scrollRegion = document.querySelector('.scroll-region')
    const originalOverflow = scrollRegion ? scrollRegion.style.overflow : null
    
    if (scrollRegion) {
      scrollRegion.style.overflow = 'hidden'
    }
    
    return () => {
      if (scrollRegion) {
        scrollRegion.style.overflow = originalOverflow || ''
      }
    }
  }, [achievement])

  if (!achievement) {
    return null
  }

  return (
    <div className="pointer-events-auto fixed inset-0 z-[1300] flex items-center justify-center bg-black/35 backdrop-blur-md px-6 text-center">
      <div className="relative w-full max-w-sm rounded-[32px] border border-[color:var(--line)] bg-[color:var(--surface,#fff)] px-6 pb-8 pt-10 text-left shadow-[0_30px_60px_rgba(15,23,42,0.35)]">
        <button
          type="button"
          aria-label="Luk"
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[color:var(--line)] text-xl font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--bg,#f7f8fb)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand,#FF385C)] focus-visible:ring-offset-2"
        >
          ×
        </button>

        <div className="flex flex-col items-center gap-6 text-center">
          <div className="flex h-48 w-48 items-center justify-center rounded-3xl bg-[color:var(--brand,#FF385C)]/10 sm:h-56 sm:w-56">
            <img
              src={achievement.image}
              alt={achievement.title}
              className="h-40 w-40 rounded-2xl object-contain sm:h-48 sm:w-48"
              loading="lazy"
            />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--muted)' }}>
              Achievement unlocked
            </p>
            <h3 className="text-2xl font-semibold leading-tight" style={{ color: 'var(--ink)' }}>
              {achievement.title}
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
              {achievement.description}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold shadow-soft transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand,#FF385C)] focus-visible:ring-offset-2"
            style={{ backgroundColor: 'var(--brand)', color: 'var(--brand-ink)' }}
          >
            Fortsæt
          </button>
        </div>
      </div>
    </div>
  )
}

