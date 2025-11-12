import { useState, useMemo } from "react";
import Card from "../components/Card";
import Page from "../components/Page";

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

export default function Sladesh() {
  const [selectedParticipant, setSelectedParticipant] = useState(null);

  // Generate random starting angles for participants on mount
  const participantsWithRandomAngles = useMemo(() => {
    return PARTICIPANTS.map((participant) => {
      // Skip center participant (self)
      if (participant.orbit === "center") {
        return participant;
      }
      // Generate random angle between 0 and 360 degrees
      const randomAngle = Math.random() * 360;
      return {
        ...participant,
        angle: randomAngle,
      };
    });
  }, []);

  return (
    <Page title="Sladesh">
      <div className="flex flex-1 flex-col items-center justify-center gap-8 pb-8 pt-4">
        <div className="relative w-full max-w-[420px]">
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

        <Card className="w-full max-w-[420px] border border-neutral-100/70 bg-white/70 p-5 text-center backdrop-blur-sm">
          <h2 className="text-base font-semibold text-neutral-900">Vælg en deltager</h2>
          <p className="mt-2 text-sm leading-relaxed text-neutral-500">
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
  const ringStyle = {
    background:
      "conic-gradient(from -90deg, rgba(var(--brand-rgb) / 0.28) 0deg, rgba(var(--brand-rgb) / 0.24) 150deg, rgba(255 255 255 / 0.85) 240deg, rgba(var(--brand-rgb) / 0.18) 330deg, rgba(var(--brand-rgb) / 0.28) 360deg)",
    mask: "radial-gradient(farthest-side, transparent calc(100% - 8px), #000 calc(100% - 4px))",
    WebkitMask:
      "radial-gradient(farthest-side, transparent calc(100% - 8px), #000 calc(100% - 4px))",
  };

  return (
    <>
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[320px] w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/80 shadow-[0_40px_80px_rgba(15,23,42,0.12)]" />
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[320px] w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={ringStyle}
      />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[180px] w-[180px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/60 bg-white/40 backdrop-blur-sm" />
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
        className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2 text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
      >
        <AvatarBadge participant={participant} size={size} textSize={textSize} />
        <span className="text-xs font-medium text-neutral-600 drop-shadow-sm">
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
          className="orbit-item__payload focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
        >
          <AvatarBadge participant={participant} size={size} textSize={textSize} />
          <span className="text-xs font-medium text-neutral-600 drop-shadow-sm">
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
  const firstName = participant.name.split(" ")[0] ?? participant.name;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1120]/60 px-6 py-8 backdrop-blur-sm">
      <div className="w-full max-w-[360px] rounded-[28px] bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.25)]">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <OverlayAvatar participant={participant} />
            <div>
              <h3 className="text-sm font-semibold text-neutral-900">{participant.name}</h3>
              <p className="text-xs text-neutral-500">
                Får en notifikation med din request og har 10 minutter til at svare.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <div className="rounded-2xl border border-neutral-100 bg-neutral-50 px-4 py-3 text-xs leading-relaxed text-neutral-500">
            <span className="font-semibold text-neutral-800">10 minutter:</span> Vi giver dig besked,
            så snart {firstName} bekræfter – eller hvis tiden løber ud.
          </div>
          <p className="text-sm text-neutral-500">
            Du sender kun en sladesh request. Ingen ekstra besked – bare ren udfordring.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            className="inline-flex flex-1 min-w-[140px] items-center justify-center rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white shadow-soft transition active:translate-y-[1px] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            Send sladesh
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-2xl border border-neutral-200 px-4 py-3 text-sm font-semibold text-neutral-600 transition hover:border-neutral-300 hover:text-neutral-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
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
    <span className="relative inline-flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-400 ring-2 ring-white shadow-[0_14px_30px_rgba(15,23,42,0.16)] overflow-hidden">
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
