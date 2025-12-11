import { Link } from 'react-router-dom'

export default function DonationBanner({ onClose }) {
  return (
    <div className="mb-3 flex items-start gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 shadow-soft">
      <div className="flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--ink)]">
          Stot Sladesh
        </p>
        <p className="mt-1 text-sm leading-relaxed text-[color:var(--muted)]">
          Har Sladesh hjulpet dig? Efter 5 minutters brug giver et lille bidrag os mulighed for at holde udviklingen i
          gang.
        </p>
        <div className="mt-2">
          <Link
            to="/donation"
            className="text-sm font-semibold text-[color:var(--brand,#FF385C)] underline"
          >
            Ga til donation
          </Link>
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Luk banner"
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold text-[color:var(--muted)] transition hover:bg-black/5 hover:text-[color:var(--ink)]"
      >
        X
      </button>
    </div>
  )
}
