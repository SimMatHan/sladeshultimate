export default function AchievementLabel({ achievement, unlocked }) {
  const statusLabel = unlocked ? 'Låst op' : 'Ikke låst op'
  const statusIcon = unlocked ? '🎉' : '🔒'

  return (
    <div
      className={`flex items-center justify-between rounded-[28px] border px-4 py-3 shadow-[0_12px_30px_rgba(15,23,42,0.08)]`}
      style={{
        borderColor: 'var(--line)',
        backgroundColor: 'var(--surface)',
      }}
    >
      <div className="min-w-0 pr-4">
        <p className="truncate text-base font-semibold leading-tight" style={{ color: 'var(--ink)' }}>
          {achievement.title}
        </p>
        <div
          className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
          style={{
            backgroundColor: unlocked ? 'rgba(16,185,129,0.12)' : 'rgba(148,163,184,0.18)',
            color: unlocked ? 'var(--brand,#FF385C)' : 'var(--muted)',
          }}
        >
          <span aria-hidden="true">{statusIcon}</span>
          <span>{statusLabel}</span>
        </div>
      </div>

      <div
        className={`relative flex h-14 w-14 items-center justify-center rounded-[20px] border`}
        style={{
          borderColor: unlocked ? 'transparent' : 'var(--line)',
          backgroundColor: unlocked ? 'rgba(255,56,92,0.08)' : 'var(--surface)',
        }}
      >
        <img
          src={achievement.image}
          alt=""
          className={`h-10 w-10 object-contain transition ${unlocked ? '' : 'opacity-25 grayscale'}`}
          loading="lazy"
        />
        {!unlocked && (
          <span className="absolute inset-0 flex items-center justify-center text-sm" style={{ color: 'var(--muted)' }}>
            🔒
          </span>
        )}
      </div>
    </div>
  )
}

