export default function InstallPwaGate({
  canPromptInstall,
  handleInstallClick,
  isIos,
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg,#0F1115)] px-5 py-8 text-[color:var(--text,#F5F6F8)]">
      <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-white/5 p-6 text-center shadow-2xl backdrop-blur-2xl">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--brand,#FF385C)]/15 text-3xl">
          📱
        </div>
        <h1 className="text-2xl font-semibold text-[color:var(--ink,#F8FAFC)]">
          Installér SladeshUltimate
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[color:var(--muted,#B9C0D4)]">
          Tilføj appen til din hjemmeskærm for den bedste og hurtigste
          Sladesh-oplevelse. Når den er installeret, åbnes den i fuldskærm som
          en rigtig app.
        </p>

        {canPromptInstall && (
          <button
            type="button"
            onClick={handleInstallClick}
            className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-[var(--brand,#FF385C)] px-4 py-3 text-base font-semibold text-[var(--brand-ink,#0D0A0B)] shadow-soft transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand,#FF385C)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface,#0F1115)]"
          >
            Installér app
          </button>
        )}

        {!canPromptInstall && isIos && (
          <div className="mt-6 rounded-2xl bg-white/5 p-4 text-left text-sm text-[color:var(--ink,#F8FAFC)]">
            <p className="font-semibold text-[color:var(--ink,#F8FAFC)]">
              Sådan installerer du på iOS:
            </p>
            <ol className="mt-3 space-y-2 text-[color:var(--muted,#D3DAE8)]">
              <li>1. Tryk på share-ikonet i Safari.</li>
              <li>2. Vælg “Føj til hjemmeskærm”.</li>
              <li>3. Bekræft navnet og tryk “Tilføj”.</li>
            </ol>
          </div>
        )}

        {!canPromptInstall && !isIos && (
          <p className="mt-6 text-sm text-[color:var(--muted,#B9C0D4)]">
            Åbn denne side i din browsers installerbare PWA-visning for at
            fortsætte.
          </p>
        )}
      </div>
    </div>
  )
}

