export default function InstallPwaGate({
  canPromptInstall,
  handleInstallClick,
  isIos,
}) {
  return (
    <div
      className="flex min-h-screen w-full flex-col items-center justify-center overflow-x-hidden bg-[var(--bg,#0F1115)] px-4 text-[color:var(--text,#F5F6F8)]"
      style={{
        paddingTop: 'max(1.5rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))',
      }}
    >
      <div className="w-full max-w-[480px] rounded-3xl border border-white/10 bg-white/5 p-5 text-center shadow-2xl backdrop-blur-2xl sm:p-6">
        <h1 className="text-xl font-semibold text-[color:var(--ink,#F8FAFC)] sm:text-2xl">Installer Sladesh</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[color:var(--muted,#B9C0D4)] sm:text-base">
          Tilføj appen til din hjemmeskaerm for den bedste og hurtigste Sladesh-oplevelse.
        </p>
        <div className="mt-4 rounded-2xl bg-white/5 px-4 py-3 text-[15px] text-[color:var(--ink,#F8FAFC)] sm:text-sm">
          <p className="font-semibold text-[color:var(--ink,#F8FAFC)]">Virker kun i Safari eller Chrome</p>
          <p className="mt-1 text-[color:var(--muted,#D3DAE8)]">
            Åbn siden i Safari på iOS eller Chrome på Android for at kunne installere appen.
          </p>
        </div>

        {canPromptInstall && (
          <button
            type="button"
            onClick={handleInstallClick}
            className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-[var(--brand,#FF385C)] px-4 py-3 text-base font-semibold text-[var(--brand-ink,#0D0A0B)] shadow-soft transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand,#FF385C)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface,#0F1115)] sm:text-lg"
          >
            Installer app
          </button>
        )}

        {!canPromptInstall && isIos && (
          <div className="mt-6 rounded-2xl bg-white/5 p-2 text-left text-[15px] text-[color:var(--ink,#F8FAFC)] sm:text-sm">
            <p className="font-semibold text-[color:var(--ink,#F8FAFC)]">Sådan installerer du i Safari på iOS:</p>
            <ol className="mt-3 space-y-2 text-[color:var(--muted,#D3DAE8)]">
              <li>1. Åbn siden i Safari (kraevet for PWA på iOS).</li>
              <li>2. Tryk på delingsikonet (firkant med pil op).</li>
              <li>3. Vælg "Føj til hjemmeskærm" eller "Add to Home Screen".</li>
              <li>4. Tryk "Tilføj" eller "Add" i højre hjørne.</li>
            </ol>
          </div>
        )}

        {!canPromptInstall && !isIos && (
          <div className="mt-6 rounded-2xl bg-white/5 p-4 text-left text-[15px] text-[color:var(--ink,#F8FAFC)] sm:text-sm">
            <p className="font-semibold text-[color:var(--ink,#F8FAFC)]">Sådan installerer du i Chrome:</p>
            <ol className="mt-3 space-y-2 text-[color:var(--muted,#D3DAE8)]">
              <li>1. Åbn siden i Chrome (krævet for PWA-installation).</li>
              <li>2. Tryk på menu-ikonet (tre prikker).</li>
              <li>3. Vælg "Installer app" eller "Tilføj til startskarm".</li>
              <li>4. Bekræft installationen.</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  )
}
