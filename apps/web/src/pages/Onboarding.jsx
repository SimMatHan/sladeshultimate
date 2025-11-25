import { useCallback, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'

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
]

export default function Onboarding() {
  const navigate = useNavigate()
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState(0)

  const totalSlides = SLIDES.length
  const activeSlide = SLIDES[index]
  const { title, description, id, emoji, emojiLabel, accentBg } = activeSlide
  const isLastSlide = index === totalSlides - 1

  const safeAreaStyle = {
    paddingTop: 'calc(24px + env(safe-area-inset-top, 0px))',
    paddingBottom: 'calc(32px + env(safe-area-inset-bottom, 0px))',
    paddingLeft: 'env(safe-area-inset-left, 0px)',
    paddingRight: 'env(safe-area-inset-right, 0px)',
  }

  const completeOnboarding = useCallback(() => {
    localStorage.setItem('onboarded', '1')
    navigate('/home', { replace: true })
  }, [navigate])

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

  const handleNext = useCallback(() => {
    if (isLastSlide) {
      completeOnboarding()
      return
    }
    goTo(index + 1)
  }, [completeOnboarding, goTo, index, isLastSlide])

  const handleSkip = useCallback(() => {
    completeOnboarding()
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
    <div className="min-h-screen bg-[color:var(--bg)] text-[color:var(--text)]">
      <div
        className="mx-auto flex min-h-screen w-full max-w-full flex-col"
        style={safeAreaStyle}
      >
        <header className="flex items-center justify-end px-6 pb-10">
          <button
            type="button"
            onClick={handleSkip}
            className="text-sm font-medium text-[color:var(--text-muted)] transition-opacity hover:opacity-70 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)] focus:ring-offset-2 focus:ring-offset-[color:var(--bg)]"
          >
            Spring over
          </button>
        </header>

        <main className="flex flex-1 flex-col">
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
              className="flex flex-1 flex-col items-center justify-center gap-10 px-6 text-center"
            >
              <div
                className={`flex h-[220px] w-[220px] items-center justify-center rounded-[16px] shadow-[0_16px_48px_rgba(0,0,0,0.08)] ${accentBg}`}
              >
                <span
                  role="img"
                  aria-label={emojiLabel}
                  className="text-7xl leading-none"
                >
                  {emoji}
                </span>
              </div>
              <div className="space-y-3">
                <h1 className="text-3xl font-semibold text-[color:var(--text)]">
                  {title}
                </h1>
                <p className="text-base text-[color:var(--text-muted)]">
                  {description}
                </p>
              </div>
            </motion.div>
          </AnimatePresence>
        </main>

        <footer className="flex flex-col gap-6 px-6 pt-6">
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
                  className={`h-2 w-2 rounded-full transition-all duration-200 ${
                    isActive
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
            className="w-full rounded-full bg-[color:var(--brand)] py-3 text-base font-semibold text-white shadow-[0_16px_40px_rgba(255,56,92,0.35)] transition-shadow hover:shadow-[0_20px_48px_rgba(255,56,92,0.45)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)] focus:ring-offset-2 focus:ring-offset-[color:var(--bg)]"
          >
            {primaryLabel}
          </motion.button>

          <span className="sr-only" aria-live="polite">
            {progressText}
          </span>
        </footer>
      </div>
    </div>
  )
}
