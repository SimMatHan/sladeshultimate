import { useState, useMemo } from "react";
import Card from "../components/Card";
import Page from "../components/Page";
import { useLocation } from "../contexts/LocationContext";
import { useTheme } from "../contexts/ThemeContext";
import { useChannel } from "../hooks/useChannel";
import { USE_MOCK_DATA } from "../config/env";

const PARTICIPANTS = [
  {
    id: "self",
    name: "Dig selv",
    initials: "DU",
    accent: "from-indigo-400 to-sky-500",
    orbit: "center",
  duration: 26,
},
  {
    id: "sofie",
    name: "Sofie Holm",
    initials: "SH",
    accent: "from-rose-400 to-pink-500",
    radius: 128,
    duration: 28,
  },
  {
    id: "malte",
    name: "Malte Jensen",
    initials: "MJ",
    accent: "from-amber-400 to-orange-500",
    radius: 122,
    duration: 24,
  },
  {
    id: "olivia",
    name: "Olivia Madsen",
    initials: "OM",
    accent: "from-violet-400 to-purple-500",
    radius: 116,
    duration: 32,
  },
  {
    id: "noah",
    name: "Noah Leth",
    initials: "NL",
    accent: "from-emerald-400 to-teal-500",
    radius: 128,
    duration: 30,
  },
  {
    id: "emma",
    name: "Emma Friis",
    initials: "EF",
    accent: "from-sky-400 to-cyan-500",
    radius: 118,
    duration: 22,
  },
  {
    id: "lars",
    name: "Lars Bæk",
    initials: "LB",
    accent: "from-slate-400 to-indigo-500",
    radius: 132,
    duration: 26,
  },
];

const SELF_PARTICIPANT = PARTICIPANTS.find((participant) => participant.orbit === "center");

export default function Sladesh() {
  const { selectedChannel } = useChannel();
  const { otherUsers } = useLocation();
  const [selectedParticipant, setSelectedParticipant] = useState(null);

  // TODO: When implementing real Firestore queries, filter by channelId:
  // - If selectedChannel.isDefault === true: show global/unfiltered view (no channelId filter)
  // - Otherwise: filter all queries with where('channelId', '==', selectedChannel.id)
  // This applies to: participants list, sladesh activities, and user interactions

  // Generate random starting angles for participants on mount
  const activeParticipants = useMemo(() => {
    if (USE_MOCK_DATA) {
      return PARTICIPANTS.filter((participant) => participant.checkedIn !== false);
    }

    const orbiters = otherUsers
      .filter((user) => user.checkedIn !== false)
      .map((user, index) => ({
        id: user.id,
        name: user.name,
        initials: user.initials,
        accent: user.avatarGradient || "from-slate-400 to-indigo-500",
        radius: 118 + (index % 4) * 6,
        duration: 24 + (index % 5) * 2,
      }));

    if (orbiters.length === 0) {
      return PARTICIPANTS.filter((participant) => participant.checkedIn !== false);
    }

    return SELF_PARTICIPANT ? [SELF_PARTICIPANT, ...orbiters] : orbiters;
  }, [otherUsers]);

  const participantsWithRandomAngles = useMemo(() => {
    return activeParticipants.map((participant, index) => {
      if (participant.orbit === "center") {
        return participant;
      }
      const hashSource = participant.id || String(index);
      const hash = Array.from(hashSource).reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const deterministicAngle = (hash * 37) % 360;
      return {
        ...participant,
        angle: deterministicAngle,
      };
    });
  }, [activeParticipants]);

  return (
    <Page title="Sladesh">
      <div className="flex flex-1 flex-col items-center justify-center gap-8 pb-8 pt-4">
        <div className="relative w-full max-w-full">
          <div className="aspect-square">
            <OrbitBackdrop />
            {participantsWithRandomAngles.map((participant) => (
              <OrbitAvatar
                key={participant.id}
                participant={participant}
                onSelect={setSelectedParticipant}
              />
            ))}
          </div>
        </div>

        <Card className="w-full max-w-full p-5 text-center backdrop-blur-sm" style={{ 
          borderColor: 'color-mix(in srgb, var(--line) 70%, transparent)',
          backgroundColor: 'color-mix(in srgb, var(--surface) 70%, transparent)'
        }}>
          <h2 className="text-base font-semibold" style={{ color: 'var(--ink)' }}>Vælg en deltager</h2>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
            Profilbillederne svæver omkring dig. Tryk på én af dem for at åbne en request og sende
            din næste challenge.
          </p>
        </Card>
      </div>

      {selectedParticipant ? (
        <RequestOverlay
          participant={selectedParticipant}
          onClose={() => setSelectedParticipant(null)}
        />
      ) : null}
    </Page>
  );
}

function OrbitBackdrop() {
  // Enhanced brand color intensity for dark mode
  const { isDarkMode } = useTheme();
  
  const brandOpacity1 = isDarkMode ? 0.65 : 0.28;
  const brandOpacity2 = isDarkMode ? 0.55 : 0.24;
  const brandOpacity3 = isDarkMode ? 0.45 : 0.18;
  const surfaceOpacity = isDarkMode ? 0.3 : 0.85;
  
  const ringStyle = {
    background:
      `conic-gradient(from -90deg, rgba(var(--brand-rgb) / ${brandOpacity1}) 0deg, rgba(var(--brand-rgb) / ${brandOpacity2}) 150deg, color-mix(in srgb, var(--surface) ${surfaceOpacity}%, transparent) 240deg, rgba(var(--brand-rgb) / ${brandOpacity3}) 330deg, rgba(var(--brand-rgb) / ${brandOpacity1}) 360deg)`,
    mask: "radial-gradient(farthest-side, transparent calc(100% - 8px), #000 calc(100% - 4px))",
    WebkitMask:
      "radial-gradient(farthest-side, transparent calc(100% - 8px), #000 calc(100% - 4px))",
    filter: isDarkMode ? 'drop-shadow(0 0 20px rgba(var(--brand-rgb) / 0.4)) drop-shadow(0 0 40px rgba(var(--brand-rgb) / 0.2))' : 'none',
  };

  return (
    <>
      {/* Outer glow layer for dark mode */}
      {isDarkMode && (
        <div 
          className="pointer-events-none absolute left-1/2 top-1/2 h-[340px] w-[340px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background: `radial-gradient(circle, rgba(var(--brand-rgb) / 0.15) 0%, transparent 70%)`,
            filter: 'blur(20px)',
          }}
        />
      )}
      <div 
        className="pointer-events-none absolute left-1/2 top-1/2 h-[320px] w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-full shadow-[0_40px_80px_rgba(15,23,42,0.12)]" 
        style={{ backgroundColor: 'color-mix(in srgb, var(--surface) 80%, transparent)' }}
      />
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[320px] w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={ringStyle}
      />
      <div 
        className="pointer-events-none absolute left-1/2 top-1/2 h-[180px] w-[180px] -translate-x-1/2 -translate-y-1/2 rounded-full border backdrop-blur-sm" 
        style={{ 
          borderColor: 'color-mix(in srgb, var(--surface) 60%, transparent)',
          backgroundColor: 'color-mix(in srgb, var(--surface) 40%, transparent)',
          ...(isDarkMode ? {
            boxShadow: `0 0 30px rgba(var(--brand-rgb) / 0.3), inset 0 0 20px rgba(var(--brand-rgb) / 0.1)`
          } : {})
        }}
      />
    </>
  );
}

function OrbitAvatar({ participant, onSelect }) {
  const { orbit = "outer" } = participant;
  const size = orbit === "center" ? "h-28 w-28" : "h-16 w-16";
  const textSize = orbit === "center" ? "text-2xl" : "text-lg";

  if (orbit === "center") {
    return (
      <button
        type="button"
        onClick={() => onSelect(participant)}
        className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2 text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2"
      >
        <AvatarBadge participant={participant} size={size} textSize={textSize} />
        <span className="text-xs font-medium drop-shadow-sm" style={{ color: 'var(--ink)' }}>
          {participant.name}
        </span>
      </button>
    );
  }

  const duration = participant.duration ?? 28;

  return (
    <div
      className="orbit-item"
      style={{
        "--angle": `${participant.angle}deg`,
        "--angle-negative": `${-participant.angle}deg`,
        "--radius": `${participant.radius}px`,
        "--duration": `${duration}s`,
      }}
    >
      <div className="orbit-item__spin">
        <button
          type="button"
          onClick={() => onSelect(participant)}
          className="orbit-item__payload focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2"
        >
          <AvatarBadge participant={participant} size={size} textSize={textSize} />
          <span className="text-xs font-medium drop-shadow-sm" style={{ color: 'var(--ink)' }}>
            {participant.name}
          </span>
        </button>
      </div>
    </div>
  );
}

function AvatarBadge({ participant, size = "h-16 w-16", textSize = "text-lg" }) {
  return (
    <div
      className={`grid place-items-center rounded-full ${size} bg-gradient-to-br ${participant.accent} font-semibold text-white shadow-[0_18px_40px_rgba(15,23,42,0.18)]`}
    >
      <span className={textSize}>{participant.initials}</span>
    </div>
  );
}

function RequestOverlay({ participant, onClose }) {
  const { selectedChannel } = useChannel();
  const { updateLocation } = useLocation();
  const firstName = participant.name.split(" ")[0] ?? participant.name;
  
  const handleSendSladesh = () => {
    // Track location when sending sladesh
    updateLocation();
    // TODO: Implement actual sladesh sending functionality
    // When implementing, include channelId: selectedChannel?.id in the sladesh data
    console.log(`Sending sladesh to ${participant.name}`, { channelId: selectedChannel?.id });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6 py-8 backdrop-blur-sm" style={{ backgroundColor: 'rgba(11, 17, 32, 0.6)' }}>
      <div 
        className="w-full max-w-[calc(100%-48px)] sm:max-w-[360px] rounded-[28px] p-6 shadow-[0_24px_60px_rgba(15,23,42,0.25)]"
        style={{ backgroundColor: 'var(--surface)' }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <OverlayAvatar participant={participant} />
            <div>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{participant.name}</h3>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                Får en notifikation med din request og har 10 minutter til at svare.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <div 
            className="rounded-2xl border px-4 py-3 text-xs leading-relaxed"
            style={{ 
              borderColor: 'var(--line)',
              backgroundColor: 'var(--subtle)',
              color: 'var(--muted)'
            }}
          >
            <span className="font-semibold" style={{ color: 'var(--ink)' }}>10 minutter:</span> Vi giver dig besked,
            så snart {firstName} bekræfter – eller hvis tiden løber ud.
          </div>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Du sender kun en sladesh request. Ingen ekstra besked – bare ren udfordring.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleSendSladesh}
            className="inline-flex flex-1 min-w-[140px] items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold shadow-soft transition active:translate-y-[1px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2"
            style={{ 
              backgroundColor: 'var(--brand)',
              color: 'var(--brand-ink)',
            }}
          >
            Send sladesh
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-2xl border px-4 py-3 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--line)] focus-visible:ring-offset-2"
            style={{ 
              borderColor: 'var(--line)',
              color: 'var(--ink)',
            }}
            onMouseEnter={(e) => {
              e.target.style.borderColor = 'var(--line)';
              e.target.style.color = 'var(--ink)';
            }}
            onMouseLeave={(e) => {
              e.target.style.borderColor = 'var(--line)';
              e.target.style.color = 'var(--ink)';
            }}
          >
            Luk
          </button>
        </div>
      </div>
    </div>
  );
}

function OverlayAvatar({ participant }) {
  return (
    <span 
      className="relative inline-flex h-12 w-12 items-center justify-center rounded-full ring-2 shadow-[0_14px_30px_rgba(15,23,42,0.16)] overflow-hidden"
      style={{ 
        backgroundColor: 'var(--subtle)',
        color: 'var(--muted)',
        '--tw-ring-color': 'var(--surface)'
      }}
    >
      <svg
        width="26"
        height="26"
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="fill-none stroke-current stroke-[1.6]"
      >
        <circle cx="12" cy="8" r="4" />
        <path d="M5 19c0-3.2 2.8-6 7-6s7 2.8 7 6" strokeLinecap="round" />
      </svg>
      <span className="sr-only">{participant.name}</span>
    </span>
  );
}
