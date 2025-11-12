import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Sheet from "./Sheet";

const DEFAULT_NOTIFICATIONS = [
  {
    id: "notification-1",
    title: "Welcome to Sladesh!",
    body: "Start by checking in and logging your first drink.",
    meta: "Just now",
  },
  {
    id: "notification-2",
    title: "Leaderboard update",
    body: "Sofie just moved to 1st place with 12 points.",
    meta: "15 min ago",
  },
];

const DEFAULT_MESSAGES = [
  {
    id: "message-1",
    title: "Mikkel",
    body: "Should we meet at the bar in 10?",
    meta: "2 min ago",
  },
  {
    id: "message-2",
    title: "Emma",
    body: "Loved the cocktail menu you recommended!",
    meta: "30 min ago",
  },
];

function OverlayPanel({ open, onClose, title, description, items }) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      position="top"
      title={title}
      description={description}
      height="min(50vh, 460px)"
      animationDuration={300}
    >
      {items.length > 0 ? (
        <ul className="divide-y divide-neutral-100">
          {items.map((item) => (
            <li key={item.id} className="py-4">
              <div className="text-sm font-semibold text-neutral-900">
                {item.title}
              </div>
              <p className="mt-1 text-xs text-neutral-500">{item.body}</p>
              <div className="mt-2 text-[11px] uppercase tracking-wide text-neutral-400">
                {item.meta}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="py-10 text-center text-xs text-neutral-500">
          Nothing here yet. Stay tuned!
        </div>
      )}
    </Sheet>
  );
}

export default function TopBar({
  subtitle,
  title,
  notifications = DEFAULT_NOTIFICATIONS,
  messages = DEFAULT_MESSAGES,
  onProfileClick,
  actions,
  className = "",
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);

  useEffect(() => {
    setNotificationOpen(false);
    setMessageOpen(false);
  }, [location.pathname]);

  const handleProfileClick =
    onProfileClick ??
    (() => {
      navigate("/manage-profile");
    });

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <button
        type="button"
        onClick={handleProfileClick}
        className="grid h-12 w-12 place-items-center rounded-2xl border border-neutral-200 bg-white text-neutral-500 transition-colors hover:border-neutral-300 hover:text-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand,#FF385C)] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
        aria-label="Open profile settings"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M5.5 19.5c0-3.59 3.04-5.5 6.5-5.5s6.5 1.91 6.5 5.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </button>

      <div className="flex-1">
        {subtitle ? (
          <div className="text-xs font-medium uppercase tracking-wide text-neutral-400">
            {subtitle}
          </div>
        ) : null}
        <h1 className="text-xl font-semibold leading-tight text-neutral-900">{title}</h1>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setNotificationOpen((prev) => !prev);
              setMessageOpen(false);
            }}
            aria-haspopup="dialog"
            aria-expanded={notificationOpen}
            aria-label="Open notifications"
            className="grid h-10 w-10 place-items-center rounded-full border border-neutral-200 text-neutral-500 transition-colors hover:border-neutral-300 hover:text-neutral-700"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 5a3 3 0 00-3 3v1.268c0 .43-.166.845-.463 1.155L7 12.06V13h10v-.94l-1.537-1.637a1.67 1.67 0 01-.463-1.155V8a3 3 0 00-3-3z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M10 16a2 2 0 004 0"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <OverlayPanel
            open={notificationOpen}
            onClose={() => setNotificationOpen(false)}
            title="Notifications"
            description="Latest updates and alerts"
            items={notifications}
          />
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setMessageOpen((prev) => !prev);
              setNotificationOpen(false);
            }}
            aria-haspopup="dialog"
            aria-expanded={messageOpen}
            aria-label="Open messages"
            className="grid h-10 w-10 place-items-center rounded-full border border-neutral-200 text-neutral-500 transition-colors hover:border-neutral-300 hover:text-neutral-700"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M6 8.5c0-1.38 1.343-2.5 3-2.5h6c1.657 0 3 1.12 3 2.5v3c0 1.38-1.343 2.5-3 2.5H9.75L6 17.5V8.5z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M8.5 11h7"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <OverlayPanel
            open={messageOpen}
            onClose={() => setMessageOpen(false)}
            title="Messages"
            description="Your latest conversations"
            items={messages}
          />
        </div>

        {actions ? (
          <div className="flex items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}

