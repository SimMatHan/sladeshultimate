import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Sheet from "./Sheet";
import { useChannel } from "../hooks/useChannel";
import { USE_MOCK_DATA } from "../config/env";

const DEFAULT_NOTIFICATIONS = [
  {
    id: "notification-1",
    title: "Welcome to Sladesh!",
    body: "Start by checking in and logging your first drink.",
    meta: "Just now",
    badge: "New",
    icon: "✨",
  },
  {
    id: "notification-2",
    title: "Leaderboard update",
    body: "Sofie just moved to 1st place with 12 points.",
    meta: "15 min ago",
    icon: "🏆",
  },
];

const DEFAULT_MESSAGES = [
  {
    id: "message-1",
    title: "Mikkel",
    body: "Should we meet at the bar in 10?",
    meta: "2 min ago",
    icon: "💬",
    badge: "Reply",
  },
  {
    id: "message-2",
    title: "Emma",
    body: "Loved the cocktail menu you recommended!",
    meta: "30 min ago",
    icon: "🍸",
  },
];

function BellIcon(props) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M6 9V8a6 6 0 0 1 12 0v1c0 1.2.4 2.4 1.1 3.4L20 13.5V15H4v-1.5l.9-1.1C5.6 11.4 6 10.2 6 9Z" />
      <path d="M9 18a3 3 0 0 0 6 0" />
    </svg>
  );
}

function ChatBubbleIcon(props) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M7 9h10" />
      <path d="M7 13h6" />
      <path d="M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-3.5L12 21l-3.5-4H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
    </svg>
  );
}

function OverlayPanel({ open, onClose, title, description, items, variant = "notifications" }) {
  const getFallbackIcon = () => {
    if (variant === "messages") return <ChatBubbleIcon />;
    return <BellIcon />;
  };

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
      <div className="sheet-panel__body">
        {items.length > 0 ? (
          <ul className="sheet-list flex flex-col gap-3">
            {items.map((item) => {
              const iconNode =
                item.icon && typeof item.icon === "string" ? (
                  <span>{item.icon}</span>
                ) : (
                  item.icon ?? getFallbackIcon()
                );
              return (
                <li key={item.id}>
                  <div className="overlay-card">
                    <div className="overlay-card__icon" aria-hidden="true">
                      {iconNode}
                    </div>
                    <div className="overlay-card__body">
                      <div className="overlay-card__title">{item.title}</div>
                      <p className="overlay-card__text">{item.body}</p>
                    </div>
                    <div className="overlay-card__meta">
                      {item.badge ? <span className="overlay-card__badge">{item.badge}</span> : null}
                      {item.meta}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="sheet-empty py-10 text-center text-xs">
            Nothing here yet. Stay tuned!
          </div>
        )}
      </div>
    </Sheet>
  );
}

function ChannelPickerSheet({ open, onClose, channels, selectedChannel, onSelectChannel }) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      position="top"
      title="Select Channel"
      description="Choose a channel to filter content"
      height="min(60vh, 400px)"
      animationDuration={300}
    >
      {channels.length > 0 ? (
        <ul className="sheet-list flex flex-col gap-3">
          {channels.map((channel) => {
            const isActive = selectedChannel?.id === channel.id;
            return (
              <li key={channel.id}>
                <button
                  type="button"
                  onClick={() => onSelectChannel(channel.id)}
                  className="channel-card text-left"
                  aria-pressed={isActive}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                          {channel.name}
                        </div>
                        {channel.isDefault ? <span className="overlay-card__badge">Default</span> : null}
                      </div>
                      <div className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
                        {channel.isDefault ? "Default channel" : "Tap to switch"}
                      </div>
                      {isActive && (
                        <div className="mt-3">
                          <span className="overlay-card__badge">Active</span>
                        </div>
                      )}
                    </div>
                    <div className="channel-card__indicator" data-active={isActive}>
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="sheet-empty py-10 text-center text-xs">
          No channels available
        </div>
      )}
    </Sheet>
  );
}

export default function TopBar({
  subtitle,
  title,
  notifications: propNotifications,
  messages: propMessages,
  onProfileClick,
  actions,
  className = "",
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeOverlay, setActiveOverlay] = useState(null);
  const { selectedChannel, setSelectedChannel, channels, loading: channelsLoading, refreshChannels } = useChannel();

  // Use mock data in development, empty arrays in production (unless explicitly provided)
  const notifications = USE_MOCK_DATA
    ? (propNotifications ?? DEFAULT_NOTIFICATIONS)
    : (propNotifications ?? []);
  const messages = USE_MOCK_DATA
    ? (propMessages ?? DEFAULT_MESSAGES)
    : (propMessages ?? []);

  // Close all overlays when route changes
  useEffect(() => {
    setActiveOverlay(null);
  }, [location.pathname]);

  // Handler for overlay toggle
  const handleOverlayToggle = (overlay) => {
    setActiveOverlay(prev => prev === overlay ? null : overlay);
  };

  const handleChannelButtonClick = async () => {
    if (activeOverlay === 'channels') {
      setActiveOverlay(null);
      return;
    }
    try {
      await refreshChannels();
    } catch (error) {
      console.error('Failed to refresh channels before opening overlay:', error);
    }
    setActiveOverlay('channels');
  };

  const pickerChannels = useMemo(
    () => channels.map(channel => ({
      id: channel.id,
      name: channel.name,
      isDefault: !!channel.isDefault
    })),
    [channels]
  );


  const handleProfileClick =
    onProfileClick ??
    (() => {
      navigate("/manage-profile");
    });

  return (
    <div className={`flex items-center gap-3 h-16 ${className}`}>
      {['/admin', '/manage-channels', '/manage-profile'].includes(location.pathname) ? (
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="grid h-12 w-12 place-items-center rounded-2xl border text-neutral-500 transition-colors hover:border-neutral-300 hover:text-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand,#FF385C)] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          style={{ borderColor: 'var(--line)', backgroundColor: 'var(--surface)', color: 'var(--muted)' }}
          aria-label="Go back"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleProfileClick}
          className="grid h-12 w-12 place-items-center rounded-2xl border text-neutral-500 transition-colors hover:border-neutral-300 hover:text-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand,#FF385C)] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          style={{ borderColor: 'var(--line)', backgroundColor: 'var(--surface)', color: 'var(--muted)' }}
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
      )}

      <div className="flex-1">
        {subtitle ? (
          <div className="text-xs font-medium uppercase tracking-wide text-neutral-400">
            {subtitle}
          </div>
        ) : null}
        <h1 className="text-xl font-semibold leading-tight" style={{ color: 'var(--ink)' }}>{title}</h1>
      </div>

      {selectedChannel && !channelsLoading && (
        <div className="relative">
          <button
            type="button"
            onClick={handleChannelButtonClick}
            aria-haspopup="dialog"
            aria-expanded={activeOverlay === 'channels'}
            aria-label="Select channel"
            className="grid h-10 w-10 place-items-center rounded-full border transition-colors"
            style={{
              borderColor: activeOverlay === 'channels' ? 'var(--brand, #FF385C)' : 'var(--line)',
              color: activeOverlay === 'channels' ? 'var(--brand, #FF385C)' : 'var(--muted)'
            }}
            onMouseEnter={(e) => {
              if (activeOverlay !== 'channels') {
                e.currentTarget.style.borderColor = 'var(--line)';
                e.currentTarget.style.color = 'var(--ink)';
              }
            }}
            onMouseLeave={(e) => {
              if (activeOverlay !== 'channels') {
                e.currentTarget.style.borderColor = 'var(--line)';
                e.currentTarget.style.color = 'var(--muted)';
              }
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M9 22V12h6v10"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <ChannelPickerSheet
            open={activeOverlay === 'channels'}
            onClose={() => setActiveOverlay(null)}
            channels={pickerChannels}
            selectedChannel={selectedChannel}
            onSelectChannel={(channelId) => {
              setSelectedChannel(channelId);
              setActiveOverlay(null);
            }}
          />
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className="relative">
          <button
            type="button"
            onClick={() => handleOverlayToggle('notifications')}
            aria-haspopup="dialog"
            aria-expanded={activeOverlay === 'notifications'}
            aria-label="Open notifications"
            className="grid h-10 w-10 place-items-center rounded-full border transition-colors"
            style={{
              borderColor: activeOverlay === 'notifications' ? 'var(--brand, #FF385C)' : 'var(--line)',
              color: activeOverlay === 'notifications' ? 'var(--brand, #FF385C)' : 'var(--muted)'
            }}
            onMouseEnter={(e) => {
              if (activeOverlay !== 'notifications') {
                e.currentTarget.style.borderColor = 'var(--line)';
                e.currentTarget.style.color = 'var(--ink)';
              }
            }}
            onMouseLeave={(e) => {
              if (activeOverlay !== 'notifications') {
                e.currentTarget.style.borderColor = 'var(--line)';
                e.currentTarget.style.color = 'var(--muted)';
              }
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
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
            open={activeOverlay === 'notifications'}
            onClose={() => setActiveOverlay(null)}
            title="Notifications"
            description="Latest updates and alerts"
            items={notifications}
            variant="notifications"
          />
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => handleOverlayToggle('messages')}
            aria-haspopup="dialog"
            aria-expanded={activeOverlay === 'messages'}
            aria-label="Open messages"
            className="grid h-10 w-10 place-items-center rounded-full border transition-colors"
            style={{
              borderColor: activeOverlay === 'messages' ? 'var(--brand, #FF385C)' : 'var(--line)',
              color: activeOverlay === 'messages' ? 'var(--brand, #FF385C)' : 'var(--muted)'
            }}
            onMouseEnter={(e) => {
              if (activeOverlay !== 'messages') {
                e.currentTarget.style.borderColor = 'var(--line)';
                e.currentTarget.style.color = 'var(--ink)';
              }
            }}
            onMouseLeave={(e) => {
              if (activeOverlay !== 'messages') {
                e.currentTarget.style.borderColor = 'var(--line)';
                e.currentTarget.style.color = 'var(--muted)';
              }
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
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
            open={activeOverlay === 'messages'}
            onClose={() => setActiveOverlay(null)}
            title="Messages"
            description="Your latest conversations"
            items={messages}
            variant="messages"
          />
        </div>

        {actions ? (
          <div className="flex items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}

