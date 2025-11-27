import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Sheet from "./Sheet";
import { useChannel } from "../hooks/useChannel";
import { useUserData } from "../contexts/UserDataContext";
import { useAuth } from "../hooks/useAuth";
import { USE_MOCK_DATA } from "../config/env";
import { 
  subscribeToMessages, 
  sendMessage, 
  getMessageQuota, 
  markMessagesAsSeen,
  getUnreadMessageCount 
} from "../services/messageService";
import {
  subscribeToNotifications,
  getUnreadNotificationCount,
  deleteAllNotifications
} from "../services/notificationService";

const DEFAULT_NOTIFICATIONS = [
  {
    id: "notification-1",
    title: "Velkommen til Sladesh!",
    body: "Begynd med at checke ind og logge din første drink.",
    meta: "Lige nu",
    badge: "Ny",
    icon: "✨",
  },
  {
    id: "notification-2",
    title: "Topliste opdateret",
    body: "Sofie gik lige i front med 12 point.",
    meta: "For 15 min siden",
    icon: "🏆",
  },
];

const DEFAULT_MESSAGES = [
  {
    id: "message-1",
    title: "Mikkel",
    body: "Skal vi mødes i baren om 10?",
    meta: "For 2 min siden",
    icon: "💬",
    badge: "Svar",
  },
  {
    id: "message-2",
    title: "Emma",
    body: "Elskede cocktailkortet du anbefalede!",
    meta: "For 30 min siden",
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

function OverlayPanel({ open, onClose, title, description, items, variant = "notifications", onClearAll }) {
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
          <>
            {onClearAll && (
              <div className="px-6 pb-3">
                <button
                  type="button"
                  onClick={onClearAll}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors hover:opacity-80"
                  style={{
                    color: 'var(--muted)',
                    backgroundColor: 'var(--line)'
                  }}
                >
                  Ryd alle
                </button>
              </div>
            )}
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
          </>
        ) : (
          <div className="sheet-empty py-10 text-center text-xs">
            Intet her endnu. Kig snart igen!
          </div>
        )}
      </div>
    </Sheet>
  );
}

function MessagesPanel({ open, onClose, channelId, userId, userName }) {
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const [quota, setQuota] = useState({ used: 0, limit: 3, remaining: 3, canSend: true });
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  // Format timestamp to relative time
  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Lige nu";
    if (diffMins < 60) return `For ${diffMins} min siden`;
    if (diffHours < 24) return `For ${diffHours} time${diffHours > 1 ? "r" : ""} siden`;
    if (diffDays === 1) return "I går";
    if (diffDays < 7) return `For ${diffDays} dage siden`;
    return date.toLocaleDateString("da-DK", { day: "numeric", month: "short" });
  };

  // Subscribe to real-time messages
  useEffect(() => {
    if (!open || !channelId) {
      setMessages([]);
      return;
    }

    // Mark messages as seen when opening
    if (userId && channelId) {
      markMessagesAsSeen(userId, channelId).catch(console.error);
    }

    const unsubscribe = subscribeToMessages(channelId, (newMessages) => {
      setMessages(newMessages);
      // Auto-scroll to bottom after a short delay to ensure DOM update
      setTimeout(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
      }, 100);
    });

    return unsubscribe;
  }, [open, channelId, userId]);

  // Load quota when panel opens and refresh periodically
  useEffect(() => {
    if (!open || !userId) return;
    
    const loadQuota = async () => {
      try {
        const currentQuota = await getMessageQuota(userId);
        setQuota(currentQuota);
      } catch (error) {
        console.error('Error loading quota:', error);
      }
    };
    
    // Load immediately
    loadQuota();
    
    // Refresh quota every 5 seconds while panel is open
    const intervalId = setInterval(loadQuota, 5000);
    
    return () => clearInterval(intervalId);
  }, [open, userId]);

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current && messages.length > 0) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length]);

  const handleSendMessage = useCallback(async (e) => {
    e?.preventDefault();
    if (!messageInput.trim() || !channelId || !userId || !userName || isSending || !quota.canSend) {
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      // Optimistically update quota in UI
      const optimisticQuota = {
        ...quota,
        used: quota.used + 1,
        remaining: Math.max(0, quota.remaining - 1),
        canSend: quota.remaining > 1
      };
      setQuota(optimisticQuota);
      
      await sendMessage(channelId, userId, userName, messageInput);
      setMessageInput("");
      
      // Refresh quota from Firestore after a short delay to ensure update is visible
      setTimeout(async () => {
        try {
          const newQuota = await getMessageQuota(userId);
          setQuota(newQuota);
        } catch (error) {
          console.error("Error refreshing quota:", error);
        }
      }, 500);
    } catch (err) {
      console.error("Error sending message:", err);
      setError(err.message || "Kunne ikke sende besked");
      // Revert optimistic update on error
      try {
        const currentQuota = await getMessageQuota(userId);
        setQuota(currentQuota);
      } catch (error) {
        console.error("Error reverting quota:", error);
      }
    } finally {
      setIsSending(false);
    }
  }, [messageInput, channelId, userId, userName, isSending, quota.canSend]);

  if (!channelId) {
    return (
      <Sheet
        open={open}
        onClose={onClose}
        position="top"
        title="Beskeder"
        description="Ingen kanal valgt"
        height="min(50vh, 460px)"
        animationDuration={300}
      >
        <div className="sheet-empty py-10 text-center text-xs">
          Vælg en kanal for at se beskeder
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      position="top"
      title="Beskeder"
      description={`${quota.used}/${quota.limit} beskeder brugt`}
      height="min(70vh, 600px)"
      animationDuration={300}
    >
      <div className="flex flex-col h-full">
        {/* Messages List */}
        <div 
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto px-6 py-4"
          style={{ maxHeight: "calc(70vh - 140px)" }}
        >
          {messages.length === 0 ? (
            <div className="sheet-empty py-10 text-center text-xs">
              Ingen beskeder endnu. Vær den første til at skrive!
            </div>
          ) : (
            messages.map((message) => {
              const isOwnMessage = message.userId === userId;
              return (
                <div
                  key={message.id}
                  className={`flex flex-col ${isOwnMessage ? "items-end" : "items-start"} mb-3`}
                >
                  {/* Username always visible above message */}
                  <div className={`text-xs font-semibold mb-1 px-1 ${isOwnMessage ? "text-right" : "text-left"}`} style={{ color: 'var(--muted)' }}>
                    {message.userName}
                  </div>
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                      isOwnMessage
                        ? "bg-[color:var(--brand,#FF385C)] text-white"
                        : "bg-[color:var(--line)]"
                    }`}
                    style={!isOwnMessage ? { color: 'var(--ink)' } : {}}
                  >
                    <p className="text-sm break-words">{message.content}</p>
                    <div className={`text-xs mt-1 ${isOwnMessage ? "text-white/70" : ""}`} style={!isOwnMessage ? { color: 'var(--muted)' } : {}}>
                      {formatTime(message.timestamp)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Error Message */}
        {error && (
          <div className="px-6 pb-2">
            <div className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
              {error}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="px-6 pb-4 pt-2 border-t" style={{ borderColor: 'var(--line)' }}>
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              type="text"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder={quota.canSend ? "Skriv en besked..." : "Kvote opbrugt"}
              disabled={!quota.canSend || isSending}
              maxLength={500}
              className="flex-1 px-4 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--brand,#FF385C)] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ 
                borderColor: 'var(--line)', 
                backgroundColor: 'var(--surface)',
                color: 'var(--ink)'
              }}
            />
            <button
              type="submit"
              disabled={!messageInput.trim() || !quota.canSend || isSending}
              className="px-4 py-2 rounded-xl font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: quota.canSend ? 'var(--brand, #FF385C)' : 'var(--line)',
                color: quota.canSend ? 'white' : 'var(--muted)'
              }}
            >
              {isSending ? "..." : "Send"}
            </button>
          </form>
        </div>
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
      title="Vælg kanal"
      description="Vælg en kanal for at filtrere indhold"
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
                        {channel.isDefault ? <span className="overlay-card__badge">Standard</span> : null}
                      </div>
                      <div className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
                        {channel.isDefault ? "Standardkanal" : "Tryk for at skifte"}
                      </div>
                      {isActive && (
                        <div className="mt-3">
                          <span className="overlay-card__badge">Aktiv</span>
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
          Ingen kanaler tilgængelige
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
  const {
    selectedChannel,
    channels,
    loading: channelsLoading,
    refreshChannels,
    switchChannel,
    isChannelSwitching,
  } = useChannel();
  const [displayChannelName, setDisplayChannelName] = useState(selectedChannel?.name ?? "");
  const { userData } = useUserData();
  const { currentUser } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
  const [isClearingNotifications, setIsClearingNotifications] = useState(false);

  // Use mock data in development, empty arrays in production (unless explicitly provided)
  const displayNotifications = USE_MOCK_DATA
    ? (propNotifications ?? DEFAULT_NOTIFICATIONS)
    : (propNotifications ?? notifications);
  const messages = USE_MOCK_DATA
    ? (propMessages ?? DEFAULT_MESSAGES)
    : (propMessages ?? []);

  // Close all overlays when route changes
  useEffect(() => {
    setActiveOverlay(null);
  }, [location.pathname]);

  // Keep showing the previously resolved channel label during switching
  useEffect(() => {
    if (channelsLoading) return;
    if (selectedChannel?.name) {
      setDisplayChannelName(selectedChannel.name);
    }
  }, [channelsLoading, selectedChannel]);

  // Load notifications from Firestore
  useEffect(() => {
    if (!currentUser || USE_MOCK_DATA) {
      if (USE_MOCK_DATA) {
        setNotifications(propNotifications ?? DEFAULT_NOTIFICATIONS);
      } else {
        setNotifications([]);
      }
      return;
    }

    const unsubscribe = subscribeToNotifications(currentUser.uid, (newNotifications) => {
      setNotifications(newNotifications);
    });

    return unsubscribe;
  }, [currentUser, propNotifications]);

  // Track unread notification count (across all channels)
  useEffect(() => {
    if (!currentUser || USE_MOCK_DATA) {
      setNotificationUnreadCount(0);
      return;
    }

    let intervalId;
    
    const updateUnreadCount = async () => {
      try {
        const count = await getUnreadNotificationCount(currentUser.uid);
        setNotificationUnreadCount(count);
      } catch (error) {
        console.error('Error getting unread notification count:', error);
      }
    };

    // Update immediately
    updateUnreadCount();
    
    // Update every 30 seconds
    intervalId = setInterval(updateUnreadCount, 30000);

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [currentUser]);

  // Track unread message count
  useEffect(() => {
    if (!currentUser || !selectedChannel?.id || activeOverlay === 'messages') {
      setUnreadCount(0);
      return;
    }

    let intervalId;
    let unsubscribeMessages;
    
    const updateUnreadCount = async () => {
      try {
        const count = await getUnreadMessageCount(selectedChannel.id, currentUser.uid);
        setUnreadCount(count);
      } catch (error) {
        console.error('Error getting unread count:', error);
      }
    };

    // Update immediately
    updateUnreadCount();
    
    // Update every 30 seconds
    intervalId = setInterval(updateUnreadCount, 30000);

    // Also subscribe to real-time messages to update count immediately when new messages arrive
    unsubscribeMessages = subscribeToMessages(selectedChannel.id, () => {
      updateUnreadCount();
    });

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
      if (unsubscribeMessages) {
        unsubscribeMessages();
      }
    };
  }, [currentUser, selectedChannel?.id, activeOverlay]);

  // Handler for overlay toggle
  const handleOverlayToggle = (overlay) => {
    setActiveOverlay(prev => prev === overlay ? null : overlay);
    
    // When messages overlay opens, mark as seen and reset unread count
    if (overlay === 'messages' && currentUser && selectedChannel?.id) {
      markMessagesAsSeen(currentUser.uid, selectedChannel.id).catch(console.error);
      setUnreadCount(0);
    }
  };

  // Handler for clearing all notifications
  const handleClearAllNotifications = useCallback(async () => {
    if (!currentUser || isClearingNotifications) return;
    
    setIsClearingNotifications(true);
    try {
      await deleteAllNotifications(currentUser.uid);
      // Notifications will update automatically via the subscription
      setNotificationUnreadCount(0);
    } catch (error) {
      console.error('Error clearing notifications:', error);
      alert('Kunne ikke rydde notifikationer. Prøv igen.');
    } finally {
      setIsClearingNotifications(false);
    }
  }, [currentUser, isClearingNotifications]);

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

  const shouldShowChannelButton = Boolean(selectedChannel || displayChannelName);

  const isDrinkPage = location.pathname === '/drink' || location.pathname.startsWith('/drink/')

  const showBackButton =
    ['/admin', '/manage-channels', '/manage-profile'].includes(location.pathname) ||
    isDrinkPage

  return (
    <div className={`flex items-center gap-3 h-16 ${className}`}>
      {showBackButton ? (
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="grid h-12 w-12 place-items-center rounded-2xl border text-neutral-500 transition-colors hover:border-neutral-300 hover:text-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand,#FF385C)] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          style={{ borderColor: 'var(--line)', backgroundColor: 'var(--surface)', color: 'var(--muted)' }}
          aria-label="Gå tilbage"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleProfileClick}
          className="h-12 w-12 rounded-2xl border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand,#FF385C)] focus-visible:ring-offset-2 focus-visible:ring-offset-white overflow-hidden"
          style={{ borderColor: 'var(--line)', backgroundColor: 'var(--surface)' }}
          aria-label="Åbn profilindstillinger"
        >
          {userData?.profileEmoji && userData?.profileGradient ? (
            <div
              className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${userData.profileGradient} text-xl`}
            >
              {userData.profileEmoji}
            </div>
          ) : (
            <div className="grid h-full w-full place-items-center text-neutral-500" style={{ color: 'var(--muted)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.6" />
                <path
                  d="M5.5 19.5c0-3.59 3.04-5.5 6.5-5.5s6.5 1.91 6.5 5.5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          )}
        </button>
      )}

      {shouldShowChannelButton && (
        <div className="flex-1 relative">
          <button
            type="button"
            onClick={handleChannelButtonClick}
            disabled={isChannelSwitching}
            aria-haspopup="dialog"
            aria-expanded={activeOverlay === 'channels'}
            aria-label="Vælg kanal"
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand,#FF385C)] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            style={{
              color: activeOverlay === 'channels' ? 'var(--brand, #FF385C)' : 'var(--ink)',
              opacity: isChannelSwitching ? 0.5 : 1,
              cursor: isChannelSwitching ? 'not-allowed' : 'pointer',
            }}
            onMouseEnter={(e) => {
              if (activeOverlay !== 'channels') {
                e.currentTarget.style.color = 'var(--brand, #FF385C)';
              }
            }}
            onMouseLeave={(e) => {
              if (activeOverlay !== 'channels') {
                e.currentTarget.style.color = 'var(--ink)';
              }
            }}
          >
            <span className="text-xl font-semibold leading-tight">
              {selectedChannel?.name ?? displayChannelName}
            </span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                transform: activeOverlay === 'channels' ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease'
              }}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          <ChannelPickerSheet
            open={activeOverlay === 'channels'}
            onClose={() => setActiveOverlay(null)}
            channels={pickerChannels}
            selectedChannel={selectedChannel}
            onSelectChannel={async (channelId) => {
              setActiveOverlay(null);
              try {
                await switchChannel(channelId);
              } catch (error) {
                console.error('Failed to switch channel via picker:', error);
              }
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
            aria-label="Åbn notifikationer"
            className="grid h-10 w-10 place-items-center rounded-full border transition-colors relative"
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
            {notificationUnreadCount > 0 && (
              <span 
                className="absolute top-0 right-0 h-3 w-3 rounded-full bg-red-500 border-2"
                style={{ borderColor: 'var(--surface)' }}
                aria-label={`${notificationUnreadCount} nye notifikationer`}
              />
            )}
          </button>
          <OverlayPanel
            open={activeOverlay === 'notifications'}
            onClose={() => setActiveOverlay(null)}
            title="Notifikationer"
            description="Seneste opdateringer og beskeder"
            items={displayNotifications}
            variant="notifications"
            onClearAll={displayNotifications.length > 0 && !USE_MOCK_DATA ? handleClearAllNotifications : undefined}
          />
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => handleOverlayToggle('messages')}
            aria-haspopup="dialog"
            aria-expanded={activeOverlay === 'messages'}
            aria-label="Åbn beskeder"
            className="grid h-10 w-10 place-items-center rounded-full border transition-colors relative"
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
            {unreadCount > 0 && (
              <span 
                className="absolute top-0 right-0 h-3 w-3 rounded-full bg-red-500 border-2"
                style={{ borderColor: 'var(--surface)' }}
                aria-label={`${unreadCount} nye beskeder`}
              />
            )}
          </button>
          <MessagesPanel
            open={activeOverlay === 'messages'}
            onClose={() => setActiveOverlay(null)}
            channelId={selectedChannel?.id}
            userId={currentUser?.uid}
            userName={userData?.username || userData?.displayName || userData?.fullName || "Bruger"}
          />
        </div>

        {actions ? (
          <div className="flex items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}

