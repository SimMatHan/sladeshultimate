import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import Card from "../components/Card"
import Page from "../components/Page"
import { useAuth } from "../hooks/useAuth"
import { useChannel } from "../hooks/useChannel"
import { joinChannelByCode } from "../services/channelService"

function FeedbackToast({ feedback }) {
  if (!feedback) return null

  return (
    <div className="sticky bottom-5 z-10 flex justify-center">
      <div
        className="rounded-full border px-4 py-2 text-sm font-medium shadow-[0_18px_36px_rgba(15,23,42,0.15)]"
        style={{
          borderColor: feedback.tone === "error" ? "var(--brand)" : "var(--line)",
          backgroundColor: "var(--surface)",
          color: feedback.tone === "error" ? "var(--brand)" : "var(--ink)"
        }}
      >
        {feedback.message}
      </div>
    </div>
  )
}

function ChannelCard({ channel, isActive, onCopyCode }) {
  const { name, description, code, isDefault } = channel

  return (
    <Card bare className="px-5 py-4">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-base font-semibold" style={{ color: "var(--ink)" }}>
              {name}
            </div>
            {isDefault ? <span className="overlay-card__badge">Standard</span> : null}
            {isActive ? <span className="overlay-card__badge">Aktiv</span> : null}
          </div>
          {code ? (
            <button
              type="button"
              onClick={() => onCopyCode(code)}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand,#FF385C)] focus-visible:ring-offset-2"
              style={{
                borderColor: "var(--line)",
                backgroundColor: "var(--subtle)",
                color: "var(--ink)"
              }}
            >
              <span>{code}</span>
              <svg className="h-3 w-3" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path
                  d="M7 7.5V5.4A1.4 1.4 0 0 1 8.4 4h6.2A1.4 1.4 0 0 1 16 5.4v6.2a1.4 1.4 0 0 1-1.4 1.4H12.5"
                  strokeLinecap="round"
                />
                <rect x="4" y="7.5" width="8.5" height="8.5" rx="1.4" strokeLinecap="round" />
              </svg>
            </button>
          ) : (
            <span className="text-xs font-medium" style={{ color: "var(--muted)" }}>
              Ingen kode
            </span>
          )}
        </div>
        {description ? (
          <p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
            {description}
          </p>
        ) : null}
      </div>
    </Card>
  )
}

export default function ManageChannels() {
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const { channels, activeChannelId, refreshChannels, loading: channelsLoading } = useChannel()
  const [joinCode, setJoinCode] = useState("")
  const [feedback, setFeedback] = useState(null)
  const [isJoining, setIsJoining] = useState(false)

  useEffect(() => {
    if (!feedback) return undefined
    const timeout = setTimeout(() => setFeedback(null), 2800)
    return () => clearTimeout(timeout)
  }, [feedback])

  const handleCopyCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code)
      setFeedback({ tone: "success", message: "Invitationskoden er kopieret til udklipsholderen." })
    } catch {
      setFeedback({ tone: "error", message: "Kunne ikke kopiere invitationskoden. Prøv manuelt." })
    }
  }

  const handleJoinChannel = async (event) => {
    event.preventDefault()
    if (!currentUser) {
      setFeedback({ tone: "error", message: "Du skal være logget ind for at deltage i en kanal." })
      return
    }

    const sanitized = joinCode.trim()
    if (!sanitized) {
      setFeedback({ tone: "error", message: "Indtast en invitationskode for at deltage i en kanal." })
      return
    }

    setIsJoining(true)
    try {
      const { joinedChannel } = await joinChannelByCode(currentUser.uid, sanitized)
      setFeedback({
        tone: "success",
        message: `Du er nu med i ${joinedChannel?.name || "kanalen"}.`
      })
      setJoinCode("")
      await refreshChannels()
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error.message || "Det lykkedes ikke at deltage i kanalen. Prøv igen."
      })
    } finally {
      setIsJoining(false)
    }
  }

  if (!currentUser) {
    return (
      <Page title="Administrer kanaler">
        <div className="space-y-4">
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Log ind for at administrere dine kanaler.
          </p>
          <button
            type="button"
            onClick={() => navigate("/auth")}
            className="inline-flex items-center justify-center rounded-full border px-5 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand,#FF385C)] focus-visible:ring-offset-2"
            style={{
              borderColor: "var(--line)",
              backgroundColor: "var(--surface)",
              color: "var(--ink)"
            }}
          >
            Gå til log ind
          </button>
        </div>
      </Page>
    )
  }

  return (
    <Page title="Administrer kanaler" allowScroll>
      <div className="space-y-6">


        <Card className="px-5 py-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                Dine kanaler
              </div>
              <div className="text-lg font-semibold" style={{ color: "var(--ink)" }}>
                {channels.length} tilsluttet
              </div>
            </div>
            <div className="rounded-2xl bg-[color:var(--brand,#FF385C)]/10 px-3 py-1 text-sm font-semibold text-[color:var(--brand,#FF385C)]">
              Live
            </div>
          </div>
          <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
            Kanaler holder jeres aftener organiseret. Deltag hos venner med en invitationskode.
          </p>
        </Card>

        <Card className="px-5 py-6 space-y-4">
          <div className="space-y-1">
            <div className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--muted)" }}>
              Deltag hos venner
            </div>
            <h2 className="text-lg font-semibold" style={{ color: "var(--ink)" }}>
              Indtast invitationskode
            </h2>
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Har du allerede en kode? Skriv den her og kom med det samme.
            </p>
          </div>
          <form className="flex flex-col gap-3" onSubmit={handleJoinChannel}>
            <input
              type="text"
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value)}
              placeholder="fx FRI-9024"
              className="w-full rounded-2xl border px-4 py-3 text-sm font-semibold tracking-[0.28em] uppercase focus:outline-none focus:ring-2 focus:ring-[color:var(--brand,#FF385C)] focus:ring-offset-1"
              style={{
                borderColor: "var(--line)",
                backgroundColor: "var(--subtle)",
                color: "var(--ink)",
                "--tw-ring-offset-color": "var(--bg)"
              }}
            />
            <button
              type="submit"
              disabled={isJoining}
              className="inline-flex items-center justify-center rounded-full border px-5 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand,#FF385C)] focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                borderColor: "var(--line)",
                backgroundColor: "var(--surface)",
                color: "var(--ink)"
              }}
            >
              {isJoining ? "Deltager..." : "Deltag i kanal"}
            </button>
          </form>
        </Card>

        <div className="space-y-3">
          <div className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--muted)" }}>
            Dine kanaler
          </div>
          {channelsLoading ? (
            <Card className="px-5 py-6 text-sm" style={{ color: "var(--muted)" }}>
              Indlæser kanaler...
            </Card>
          ) : channels.length ? (
            <div className="space-y-3">
              {channels.map((channel) => (
                <ChannelCard
                  key={channel.id}
                  channel={channel}
                  isActive={channel.id === activeChannelId}
                  onCopyCode={handleCopyCode}
                />
              ))}
            </div>
          ) : (
            <Card className="px-5 py-6 text-sm" style={{ color: "var(--muted)" }}>
              Du er ikke med i nogen kanaler endnu. Brug en kode for at deltage.
            </Card>
          )}
        </div>

        <FeedbackToast feedback={feedback} />
      </div>
    </Page>
  )
}

