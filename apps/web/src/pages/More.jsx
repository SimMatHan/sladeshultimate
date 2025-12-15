import { Link, useNavigate } from "react-router-dom";
import Card from "../components/Card";
import Page from "../components/Page";
import { useAuth } from "../hooks/useAuth";
import { isAdminUser } from "../config/admin";


function ActionCard({
  icon,
  title,
  description,
  to,
  onClick,
  actionLabel = "Åbn",
  tone = "default",
}) {
  const gradientMap = {
    default:
      "linear-gradient(135deg, rgba(243, 244, 246, 0.6), rgba(229, 231, 235, 0.95))",
    channels:
      "linear-gradient(135deg, rgba(252, 231, 243, 0.9), rgba(255, 228, 230, 0.75))",
    profile:
      "linear-gradient(135deg, rgba(226, 232, 240, 0.9), rgba(219, 234, 254, 0.75))",
    support:
      "linear-gradient(135deg, rgba(255, 56, 92, 0.18), rgba(255, 177, 193, 0.4))",
    critical:
      "linear-gradient(135deg, rgba(239, 68, 68, 0.25), rgba(220, 38, 38, 0.3))",
  };

  const content = (
    <div className="flex w-full items-center justify-between gap-4 p-5 transition-transform duration-200 group-active:scale-[0.98]">
      <div className="flex items-start gap-4">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border shadow-inner"
          style={{
            background: gradientMap[tone] ?? gradientMap.default,
            borderColor: 'var(--line)'
          }}
        >
          <span className="text-2xl">{icon}</span>
        </div>
        <div className="space-y-1.5">
          <div className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
            {actionLabel}
          </div>
          <div className="text-base font-semibold" style={{ color: 'var(--ink)' }}>{title}</div>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>{description}</p>
        </div>
      </div>
      <svg
        className="mt-1 h-5 w-5 shrink-0 transition-colors"
        style={{ color: 'var(--muted)' }}
        onMouseEnter={(e) => e.target.style.color = 'var(--ink)'}
        onMouseLeave={(e) => e.target.style.color = 'var(--muted)'}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      >
        <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );

  const cardBackgroundStyle = tone === "critical"
    ? { background: "linear-gradient(135deg, rgba(254, 226, 226, 0.4), rgba(254, 202, 202, 0.5))" }
    : {};

  if (to) {
    return (
      <Card
        as={Link}
        to={to}
        bare
        className="group block transition-[transform,box-shadow] hover:-translate-y-1 hover:shadow-[0_24px_50px_rgba(15,23,42,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand,#FF385C)] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
        style={{ ...cardBackgroundStyle, borderColor: 'var(--line)' }}
      >
        {content}
      </Card>
    );
  }

  return (
    <Card
      as="button"
      type="button"
      onClick={onClick}
      bare
      className="group w-full transition-[transform,box-shadow] hover:-translate-y-1 hover:shadow-[0_24px_50px_rgba(15,23,42,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand,#FF385C)] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
      style={{ ...cardBackgroundStyle, borderColor: 'var(--line)' }}
    >
      {content}
    </Card>
  );
}

export default function More() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const isAdmin = isAdminUser(currentUser);
  const handleSignOut = () => {
    localStorage.removeItem("signedIn");
    localStorage.removeItem("onboarded");
    localStorage.removeItem("sladesh:checkedIn");
    navigate("/");
  };

  /* const handleLocationToggle = async () => {
    setLocationHint(null);

    if (locationEnabled) {
      setLocationHint('Slå fra i telefonens/browserens indstillinger');
      return;
    }

    if (locationPermission === 'denied') {
      setLocationHint('Slå til i telefonens/browserens indstillinger');
      return;
    }

    setIsRequestingLocation(true);
    await updateLocation({ allowPrompt: true });
    setIsRequestingLocation(false);

    try {
      if (navigator?.permissions?.query) {
        const status = await navigator.permissions.query({ name: 'geolocation' });
        if (status.state === 'denied') {
          setLocationHint('Slå til i telefonens/browserens indstillinger');
        }
      }
    } catch {
      // ignore
    }
  }; */

  return (
    <Page title="Mere">
      <div className="flex flex-1 flex-col space-y-6">
        {/*
        <Card className="px-5 py-6 space-y-4">
          <div className="space-y-1">
            <div className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
              Tilladelser
            </div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--ink)' }}>
              Tilladelser
            </h2>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              Forbered tilladelser, så funktioner virker med det samme.
            </p>
          </div>

          <div className="rounded-2xl border px-4 py-3" style={{ borderColor: 'var(--line)', backgroundColor: 'var(--surface)' }}>
            <div className="flex items-center justify-between gap-3">
              <span className="space-y-1">
                <span className="block text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                  Lokation
                </span>
                <span className="block text-xs" style={{ color: 'var(--muted)' }}>
                  {locationEnabled ? 'Aktiveret' : 'Deaktiveret'}
                </span>
              </span>
              <span className="flex items-center gap-3">
                {isRequestingLocation ? (
                  <span className="text-xs" style={{ color: 'var(--muted)' }}>
                    Henter...
                  </span>
                ) : null}
                <ToggleSwitch
                  checked={locationEnabled}
                  onChange={handleLocationToggle}
                  ariaLabel="Aktiver lokation"
                />
              </span>
            </div>
            {locationHint ? (
              <div className="mt-3 text-xs" style={{ color: 'var(--muted)' }}>
                {locationHint}
              </div>
            ) : null}
          </div>
        </Card>
        */}

        <div className="space-y-4">
          {isAdmin && (
            <ActionCard
              icon="🛠️"
              title="Admin"
              description="Administrer drinkvariationer og kanaler."
              to="/admin"
              actionLabel="Admin"
            />
          )}
          <ActionCard
            icon="📡"
            title="Administrer kanaler"
            description="Invitér venner, opret nye rum og justér kanal-synlighed."
            to="/manage-channels"
            actionLabel="Kanaler"
            tone="channels"
          />
          <ActionCard
            icon="🤝"
            title="Støt Sladesh"
            description="Giv en frivillig MobilePay-donation til hobbyprojektet."
            to="/donation"
            actionLabel="Support"
            tone="support"
          />
          <ActionCard
            icon="🧑‍🎨"
            title="Administrer profil"
            description="Opdater dit displaynavn, din vibe og dine notifikationer."
            to="/manage-profile"
            actionLabel="Profil"
            tone="profile"
          />

          <ActionCard
            icon="🚪"
            title="Log ud af Sladesh"
            onClick={handleSignOut}
            actionLabel="Log ud"
            tone="critical"
          />
        </div>
      </div>
    </Page>
  );
}
