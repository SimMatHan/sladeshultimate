import { useCallback, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { updateUser } from '../services/userService'
import { useUserData } from '../contexts/UserDataContext'
import { EMOJI_OPTIONS, GRADIENT_OPTIONS } from '../config/profileOptions'
import Sheet from '../components/Sheet'

// Slide transition variants (slide + fade)
const slideVariants = {
  enter: direction => ({
    x: direction === 0 ? 0 : direction > 0 ? 80 : -80,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: direction => ({
    x: direction === 0 ? -40 : direction > 0 ? -80 : 80,
    opacity: 0,
  }),
}

// Slides copy + hero emoji mapping -------------------------------------------
const SLIDES = [
  {
    id: 'welcome',
    title: 'Velkommen til SladeshPro!',
    description: 'Følg dine drinks og hold styr på dine mål.',
    emoji: '🤙',
    emojiLabel: 'Hånd der siger ring',
    accentBg: 'bg-[rgba(255,179,71,0.20)] dark:bg-[rgba(255,179,71,0.28)]',
  },
  {
    id: 'friends',
    title: 'Forbind med venner',
    description: 'Check ind og konkurrer med venner i samme kanal.',
    emoji: '🤝',
    emojiLabel: 'Håndtryk',
    accentBg: 'bg-[rgba(255,208,102,0.20)] dark:bg-[rgba(255,208,102,0.28)]',
  },
  {
    id: 'send',
    title: 'Send Sladesh!',
    description: 'Send en Sladesh til venner, når de checker ind.',
    emoji: '🥤',
    emojiLabel: 'Drikkebæger',
    accentBg: 'bg-[rgba(255,56,92,0.12)] dark:bg-[rgba(255,56,92,0.20)]',
  },
  {
    id: 'track',
    title: 'Registrer dine drinks',
    description: 'Log hver drink og se dit samlede antal.',
    emoji: '📈',
    emojiLabel: 'Stigende graf',
    accentBg: 'bg-[rgba(0,166,153,0.15)] dark:bg-[rgba(0,166,153,0.25)]',
  },

  {
    id: 'profile',
    title: 'Vælg profilbillede',
    description: 'Vælg en emoji og farve, så dine venner kan kende dig.',
    emoji: '📸',
    emojiLabel: 'Kamera',
    accentBg: 'bg-[rgba(100,100,100,0.1)] dark:bg-[rgba(255,255,255,0.1)]',
  },
]

export default function Onboarding() {
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const { refreshUserData } = useUserData()
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // Profile selection state
  const [selectedEmoji, setSelectedEmoji] = useState('🍹')
  const [selectedGradient, setSelectedGradient] = useState('from-rose-400 to-orange-500')
  const [isSheetOpen, setIsSheetOpen] = useState(false)



  const totalSlides = SLIDES.length
  const activeSlide = SLIDES[index]
  const { title, description, id, emoji, emojiLabel, accentBg } = activeSlide
  const isLastSlide = index === totalSlides - 1

  const safeAreaStyle = {
    paddingTop: 'calc(16px + env(safe-area-inset-top, 0px))',
    paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
    paddingLeft: 'env(safe-area-inset-left, 0px)',
    paddingRight: 'env(safe-area-inset-right, 0px)',
  }

  const completeOnboarding = useCallback(async () => {
    if (!currentUser?.uid) {
      navigate('/auth?mode=signin', { replace: true })
      return
    }
    setSaving(true)
    setError(null)
    try {
      await updateUser(currentUser.uid, { onboardingCompleted: true })
      await refreshUserData()
      navigate('/home', { replace: true })
    } catch (err) {
      console.error('Failed to complete onboarding', err)
      setError('Kunne ikke gemme onboarding. Prøv igen.')
    } finally {
      setSaving(false)
    }
  }, [currentUser, navigate, refreshUserData])

  const goTo = useCallback(
    target => {
      setIndex(prev => {
        const resolved = typeof target === 'function' ? target(prev) : target
        const clamped = Math.max(0, Math.min(totalSlides - 1, resolved))
        const movement = clamped === prev ? 0 : clamped > prev ? 1 : -1
        setDirection(prevDir => (movement === prevDir ? prevDir : movement))
        return clamped
      })
    },
    [totalSlides]
  )

  const handleNext = useCallback(async () => {
    if (isLastSlide) {
      setSaving(true)
      try {
        // Save profile customization if on profile slide (or if it was set)
        await updateUser(currentUser.uid, {
          profileEmoji: selectedEmoji,
          profileGradient: selectedGradient,
          onboardingCompleted: true
        })
        await refreshUserData()
        navigate('/home', { replace: true })
      } catch (err) {
        console.error('Failed to complete onboarding', err)
        setError('Kunne ikke gemme onboarding. Prøv igen.')
        setSaving(false)
      }
      return
    }
    goTo(index + 1)
  }, [completeOnboarding, goTo, index, isLastSlide, currentUser, selectedEmoji, selectedGradient, refreshUserData, navigate])



  const handleSkip = useCallback(async () => {
    await completeOnboarding()
  }, [completeOnboarding])

  const handleDragEnd = useCallback(
    (_event, info) => {
      const threshold = 80
      if (info.offset.x < -threshold || info.velocity.x < -500) {
        goTo(prev => prev + 1)
        return
      }
      if (info.offset.x > threshold || info.velocity.x > 500) {
        goTo(prev => prev - 1)
      }
    },
    [goTo]
  )

  const progressText = `Trin ${index + 1} af ${totalSlides}`
  const primaryLabel = isLastSlide ? 'Kom i gang' : 'Næste'

  return (
    <div className="min-h-[100dvh] bg-[color:var(--bg)] text-[color:var(--text)]">
      <div
        className="mx-auto flex min-h-[100dvh] w-full max-w-[520px] flex-col overflow-hidden"
        style={safeAreaStyle}
      >
        <header className="flex shrink-0 items-center justify-end px-5 pb-6">
          <button
            type="button"
            onClick={handleSkip}
            disabled={saving}
            className="text-sm font-medium text-[color:var(--text-muted)] transition-opacity hover:opacity-70 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)] focus:ring-offset-2 focus:ring-offset-[color:var(--bg)]"
          >
            Spring over
          </button>
        </header>

        <main className="flex min-h-0 flex-1 overflow-hidden">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={id}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.28, ease: 'easeOut' }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={handleDragEnd}
              className="flex min-h-0 flex-1 flex-col items-center justify-center gap-7 overflow-y-auto px-5 py-4 text-center"
            >
              <div
                className={`relative flex shrink-0 items-center justify-center rounded-full shadow-[0_16px_48px_rgba(0,0,0,0.08)] cursor-pointer transition-transform active:scale-95`}
                onClick={() => id === 'profile' && setIsSheetOpen(true)}
                style={{ width: 'clamp(160px, 55vw, 200px)', height: 'clamp(160px, 55vw, 200px)' }}
              >
                <div className={`absolute inset-0 rounded-full bg-gradient-to-br ${id === 'profile' ? selectedGradient : ''} ${id !== 'profile' ? accentBg : ''} opacity-100`} />
                <span
                  role="img"
                  aria-label={emojiLabel}
                  className="relative z-10 text-6xl leading-none"
                >
                  {id === 'profile' ? selectedEmoji : emoji}
                </span>
                {id === 'profile' && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
                    <span className="bg-black/20 text-white text-xs font-medium px-3 py-1 rounded-full backdrop-blur-sm">
                      Skift
                    </span>
                  </div>
                )}
              </div>
              <div className="space-y-2 max-w-sm">
                <h1 className="text-2xl font-semibold leading-tight text-[color:var(--text)] sm:text-3xl">
                  {title}
                </h1>
                <p className="text-base leading-relaxed text-[color:var(--text-muted)]">
                  {description}
                </p>
              </div>
            </motion.div>
          </AnimatePresence>
        </main>

        <footer className="flex shrink-0 flex-col gap-4 px-5 pt-4">
          <div
            className="flex items-center justify-center gap-3"
            role="group"
            aria-label="Onboardingfremgang"
          >
            {SLIDES.map((slide, dotIndex) => {
              const isActive = dotIndex === index
              return (
                <span
                  key={slide.id}
                  className={`h-2 w-2 rounded-full transition-all duration-200 ${isActive
                    ? 'bg-[color:var(--brand)] scale-125'
                    : 'bg-[color:var(--text-muted)] opacity-30'
                    }`}
                />
              )
            })}
          </div>

          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={handleNext}
            disabled={saving}
            className="w-full rounded-full bg-[color:var(--brand)] py-3 text-base font-semibold text-white shadow-[0_16px_40px_rgba(255,56,92,0.35)] transition-shadow hover:shadow-[0_20px_48px_rgba(255,56,92,0.45)] focus-visible:outline-none"
          >
            {saving ? 'Gemmer...' : primaryLabel}
          </motion.button>
          {error && (
            <p className="text-sm text-red-500 text-center">
              {error}
            </p>
          )}

          <span className="sr-only" aria-live="polite">
            {progressText}
          </span>
        </footer>
      </div>
      <Sheet
        open={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        position="center"
        title="Tilpas profilbillede"
        description="Vælg en emoji og farvekombination"
        height="auto"
      >
        <div className="space-y-6">
          {/* Preview */}
          <div className="flex items-center justify-center py-6">
            <div
              className={`flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br ${selectedGradient} text-5xl shadow-[0_20px_40px_rgba(15,23,42,0.15)]`}
            >
              {selectedEmoji}
            </div>
          </div>

          {/* Emoji Picker */}
          <div className="space-y-3">
            <div className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
              Vælg emoji
            </div>
            <div className="grid grid-cols-6 gap-2">
              {EMOJI_OPTIONS.map((emoji) => {
                const isSelected = selectedEmoji === emoji;
                return (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setSelectedEmoji(emoji)}
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl border text-2xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand,#FF385C)] focus-visible:ring-offset-2 focus-visible:ring-offset-white ${isSelected
                      ? "border-[color:var(--brand,#FF385C)] bg-[color:var(--brand,#FF385C)]/10 scale-110"
                      : "border-neutral-200 bg-white hover:border-neutral-300 hover:scale-105"
                      }`}
                    aria-pressed={isSelected}
                  >
                    {emoji}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Gradient Picker */}
          <div className="space-y-3">
            <div className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
              Vælg farve
            </div>
            <div className="grid grid-cols-4 gap-2">
              {GRADIENT_OPTIONS.map((option) => {
                const isSelected = selectedGradient === option.gradient;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setSelectedGradient(option.gradient)}
                    className={`relative flex h-14 w-full items-center justify-center rounded-2xl border-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand,#FF385C)] focus-visible:ring-offset-2 focus-visible:ring-offset-white ${isSelected
                      ? "border-[color:var(--brand,#FF385C)] ring-2 ring-[color:var(--brand,#FF385C)]/20 scale-105"
                      : "border-neutral-200 hover:border-neutral-300 hover:scale-105"
                      }`}
                    aria-pressed={isSelected}
                    title={option.name}
                  >
                    <div
                      className={`h-full w-full rounded-xl bg-gradient-to-br ${option.gradient}`}
                    />
                    {isSelected && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <svg
                          className="h-5 w-5 text-white drop-shadow-lg"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="3"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Save Button */}
          <div className="pt-6 pb-8">
            <button
              type="button"
              onClick={() => setIsSheetOpen(false)}
              className="w-full inline-flex items-center justify-center rounded-full bg-[color:var(--brand)] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(255,56,92,0.2)] transition hover:-translate-y-[1px] hover:shadow-[0_18px_32px_rgba(255,56,92,0.24)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              Færdig
            </button>
          </div>
        </div>
      </Sheet>
    </div>
  )
}
