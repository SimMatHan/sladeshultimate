import { Link, useNavigate } from "react-router-dom";
import Card from "../components/Card";
import Page from "../components/Page";

function ActionCard({
  icon,
  title,
  description,
  to,
  onClick,
  actionLabel = "Open",
  tone = "default",
}) {
  const gradientMap = {
    default:
      "linear-gradient(135deg, rgba(243, 244, 246, 0.6), rgba(229, 231, 235, 0.95))",
    channels:
      "linear-gradient(135deg, rgba(252, 231, 243, 0.9), rgba(255, 228, 230, 0.75))",
    profile:
      "linear-gradient(135deg, rgba(226, 232, 240, 0.9), rgba(219, 234, 254, 0.75))",
    critical:
      "linear-gradient(135deg, rgba(239, 68, 68, 0.25), rgba(220, 38, 38, 0.3))",
  };

  const content = (
    <div className="flex w-full items-center justify-between gap-4 p-5 transition-transform duration-200 group-active:scale-[0.98]">
      <div className="flex items-start gap-4">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/50 shadow-inner"
          style={{ background: gradientMap[tone] ?? gradientMap.default }}
        >
          <span className="text-2xl">{icon}</span>
        </div>
        <div className="space-y-1.5">
          <div className="text-xs font-medium uppercase tracking-wide text-neutral-400">
            {actionLabel}
          </div>
          <div className="text-base font-semibold text-neutral-900">{title}</div>
          <p className="text-sm leading-relaxed text-neutral-500">{description}</p>
        </div>
      </div>
      <svg
        className="mt-1 h-5 w-5 shrink-0 text-neutral-400 transition-colors group-hover:text-neutral-600"
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
        className="group block transition-[transform,box-shadow] hover:-translate-y-1 hover:shadow-[0_24px_50px_rgba(15,23,42,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand,#FF385C)] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
        style={cardBackgroundStyle}
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
      className="group w-full transition-[transform,box-shadow] hover:-translate-y-1 hover:shadow-[0_24px_50px_rgba(15,23,42,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand,#FF385C)] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
      style={cardBackgroundStyle}
    >
      {content}
    </Card>
  );
}

export default function More() {
  const navigate = useNavigate();

  const handleSignOut = () => {
    localStorage.removeItem("signedIn");
    localStorage.removeItem("onboarded");
    navigate("/");
  };

  return (
    <Page title="More">
      <div className="space-y-6">
        <div className="space-y-4">
          <ActionCard
            icon="📡"
            title="Manage Channels"
            description="Invite friends, create new spaces, and tune channel visibility."
            to="/manage-channels"
            actionLabel="Channels"
            tone="channels"
          />
          <ActionCard
            icon="🧑‍🎨"
            title="Manage Profile"
            description="Update your display name, vibe, and notification preferences."
            to="/manage-profile"
            actionLabel="Profile"
            tone="profile"
          />
        </div>

        <div className="space-y-3">
          <div className="text-xs font-medium uppercase tracking-wide text-neutral-400">
            Account
          </div>
          <ActionCard
            icon="🚪"
            title="Sign out of Sladesh"
            onClick={handleSignOut}
            actionLabel="Sign out"
            tone="critical"
          />
        </div>
      </div>
    </Page>
  );
}
