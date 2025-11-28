export default function AchievementLabel({ achievement, unlocked, count, onClick }) {
  const displayCount = count || 0
  const statusIcon = unlocked ? '🎉' : '🔒'
  
  // Status label reflects repeatability
  const getStatusLabel = () => {
    if (!unlocked) return 'Ikke låst op'
    if (displayCount === 0) return 'Låst op'
    if (displayCount === 1) return 'Optjent 1 gang'
    return `Optjent ${displayCount} gange`
  }

  const handleClick = () => {
    if (unlocked && onClick) {
      onClick()
    }
  }

  const handleKeyDown = (e) => {
    if (unlocked && onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      onClick()
    }
  }

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-[28px] border px-4 py-3 shadow-[0_12px_30px_rgba(15,23,42,0.08)] transition ${
        unlocked 
          ? 'cursor-pointer hover:shadow-[0_16px_40px_rgba(15,23,42,0.12)] hover:-translate-y-0.5' 
          : 'cursor-default opacity-90'
      }`}
      style={{
        borderColor: 'var(--line)',
        backgroundColor: 'var(--surface)',
      }}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role={unlocked ? 'button' : undefined}
      tabIndex={unlocked ? 0 : undefined}
      aria-label={unlocked ? `Se detaljer for ${achievement.title}` : undefined}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold leading-tight" style={{ color: 'var(--ink)' }}>
          {achievement.title}
        </p>
        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
          <div
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
            style={{
              backgroundColor: unlocked ? 'rgba(16,185,129,0.12)' : 'rgba(148,163,184,0.18)',
              color: unlocked ? 'var(--brand,#FF385C)' : 'var(--muted)',
            }}
          >
            <span aria-hidden="true">{statusIcon}</span>
            <span>{getStatusLabel()}</span>
          </div>
          {unlocked && displayCount > 0 && (
            <div
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold shadow-sm"
              style={{
                backgroundColor: 'rgba(255,56,92,0.15)',
                color: 'var(--brand,#FF385C)',
                border: '1.5px solid rgba(255,56,92,0.3)',
              }}
            >
              <span className="text-[10px] leading-none">×</span>
              <span className="leading-none">{displayCount}</span>
            </div>
          )}
        </div>
      </div>

      <div
        className={`relative flex h-16 w-16 shrink-0 items-center justify-center rounded-[20px] border`}
        style={{
          borderColor: unlocked ? 'rgba(255,56,92,0.2)' : 'var(--line)',
          backgroundColor: unlocked ? 'rgba(255,56,92,0.08)' : 'var(--surface)',
        }}
      >
        <img
          src={achievement.image}
          alt=""
          className={`h-12 w-12 object-contain transition ${unlocked ? '' : 'opacity-25 grayscale'}`}
          loading="lazy"
        />
        {!unlocked && (
          <span className="absolute inset-0 flex items-center justify-center text-base" style={{ color: 'var(--muted)' }}>
            🔒
          </span>
        )}
        {/* Count badge on the image - always visible when unlocked */}
        {unlocked && displayCount > 0 && (
          <div
            className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 shadow-sm text-xs font-bold"
            style={{
              backgroundColor: 'var(--brand,#FF385C)',
              color: 'white',
              borderColor: 'var(--surface)',
            }}
          >
            {displayCount}
          </div>
        )}
      </div>
    </div>
  )
}

