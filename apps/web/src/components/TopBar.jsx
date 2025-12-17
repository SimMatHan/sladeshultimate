import { useEffect, useMemo, useState, useRef, useCallback, useLayoutEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import Sheet from "./Sheet";
import { useChannel } from "../hooks/useChannel";
import { useUserData } from "../contexts/UserDataContext";
import { useAuth } from "../hooks/useAuth";
import { USE_MOCK_DATA } from "../config/env";
import {
  subscribeToMessages,
  sendMessage,
  markMessagesAsSeen,
  getUnreadMessageCount,
} from "../services/messageService";

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

function MessagesPanel({ open, onClose, channelId, userId, userName }) {
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    if (typeof window === "undefined") return;
    try {
      ["messageQuota", "messagesLeft", "quotaResetAt", "messageQuotaResetAt"].forEach((key) => {
        window.localStorage.removeItem(key);
      });
    } catch {
      // ignore
    }
  }, [open]);

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
      // Auto-scroll using requestAnimationFrame for better performance
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({
              behavior: "smooth",
              block: "end"
            });
          }
        });
      });
    });

    return unsubscribe;
  }, [open, channelId, userId]);

  const handleSendMessage = useCallback(async (e) => {
    e?.preventDefault();
    if (!messageInput.trim() || !channelId || !userId || !userName || isSending) {
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      await sendMessage(channelId, userId, userName, messageInput);
      setMessageInput("");
    } catch (err) {
      console.error("Error sending message:", err);
      setError(err.message || "Kunne ikke sende besked");
    } finally {
      setIsSending(false);
    }
  }, [messageInput, channelId, userId, userName, isSending]);

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
      height="min(60vh, 600px)"
      animationDuration={300}
      className="!p-0"
    >
      <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--surface)' }}>
        {/* Messages List */}
        <div
          ref={messagesContainerRef}
          className="flex-1 min-h-0 overflow-y-auto px-6 pt-4 pb-2 -webkit-overflow-scrolling-touch"
          style={{
            overscrollBehavior: 'contain',
            backgroundColor: 'var(--bg)'
          }}
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
                    className={`max-w-[75%] rounded-2xl px-4 py-2 ${isOwnMessage
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
          <div className="flex-none px-6 pb-2">
            <div className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
              {error}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div
          className="flex-none px-1 pt-4"
          style={{
            backgroundColor: 'var(--surface)',
            paddingBottom: '0px'
          }}
        >
          <form onSubmit={handleSendMessage} className="flex gap-3">
            <input
              type="text"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder="Skriv en besked..."
              disabled={isSending}
              maxLength={500}
              className="flex-1 px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--brand,#FF385C)] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                borderColor: 'var(--line)',
                backgroundColor: 'var(--surface)',
                color: 'var(--ink)'
              }}
            />
            <button
              type="submit"
              disabled={!messageInput.trim() || isSending}
              className="px-5 py-3 rounded-xl font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: 'var(--brand, #FF385C)',
                color: 'white'
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

function ChannelOverlay({ open, onClose, channels, selectedChannelId, onSelectChannel, onJoinChannel }) {
  const [topOffset, setTopOffset] = useState("var(--topbar-height, 64px)");

  useLayoutEffect(() => {
    if (!open) return undefined;
    const updateTopOffset = () => {
      const topbar = document.querySelector(".topbar");
      if (topbar) {
        const { bottom } = topbar.getBoundingClientRect();
        setTopOffset(`${bottom}px`);
      }
    };

    updateTopOffset();
    window.addEventListener("resize", updateTopOffset);
    window.addEventListener("orientationchange", updateTopOffset);
    return () => {
      window.removeEventListener("resize", updateTopOffset);
      window.removeEventListener("orientationchange", updateTopOffset);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKey = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = originalOverflow || "";
      window.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-x-0 z-50 flex items-start justify-center px-4"
      style={{ top: topOffset, bottom: 0 }}
    >
      <div
        className="absolute inset-x-0 bg-black/40 backdrop-blur-sm"
        style={{ top: 0, bottom: 0 }}
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-sm max-h-[85vh] overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-zinc-900 flex flex-col"
        style={{
          backgroundColor: "var(--surface)",
          maxHeight: `calc(100vh - ${topOffset} - 16px)`
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Vælg kanal"
      >
        <div className="flex-1 overflow-y-auto p-6 -webkit-overflow-scrolling-touch">
          <div className="space-y-1 mb-4">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
              Kanaler
            </p>
            <h3 className="text-lg font-semibold" style={{ color: "var(--ink)" }}>
              Vælg en kanal
            </h3>
          </div>

          {channels.length ? (
            channels.map((channel) => {
              const isActive = selectedChannelId === channel.id;
              return (
                <button
                  key={channel.id}
                  type="button"
                  onClick={() => onSelectChannel(channel.id)}
                  className="w-full text-left"
                  aria-current={isActive ? "true" : undefined}
                >
                  <div
                    className="flex items-center justify-between py-3 border-b last:border-0 px-2 rounded-xl transition-colors"
                    style={{
                      borderColor: "var(--line)",
                      backgroundColor: isActive ? "rgba(var(--brand-rgb, 255 56 92), 0.08)" : "transparent",
                    }}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                          {channel.name}
                        </div>
                        {isActive ? (
                          <span
                            className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: "var(--brand)", color: "var(--brand-ink, #fff)" }}
                          >
                            Aktiv
                          </span>
                        ) : null}
                      </div>
                      {!isActive ? (
                        <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                          Tryk for at skifte
                        </p>
                      ) : (
                        <p className="text-xs mt-0.5 font-semibold" style={{ color: "var(--brand)" }}>
                          Aktiv kanal
                        </p>
                      )}
                    </div>
                    {isActive ? (
                      <span
                        className="grid h-8 w-8 place-items-center rounded-full"
                        style={{ backgroundColor: "var(--brand)", color: "var(--brand-ink, #fff)" }}
                      >
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      </span>
                    ) : (
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: "var(--line)" }}
                        aria-hidden="true"
                      />
                    )}
                  </div>
                </button>
              );
            })
          ) : (
            <div className="py-10 text-center text-sm" style={{ color: "var(--muted)" }}>
              Ingen kanaler endnu.
            </div>
          )}
        </div>

        <div className="border-t px-6 py-4" style={{ borderColor: "var(--line)" }}>
          <button
            type="button"
            onClick={onJoinChannel}
            className="w-full rounded-xl border px-4 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand,#FF385C)] focus-visible:ring-offset-2"
            style={{
              borderColor: "var(--line)",
              backgroundColor: "var(--brand)",
              color: "var(--ink)"
            }}
          >
            Håndter kanal
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function TopBar({
  subtitle,
  title,
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

  // Use mock data in development, empty arrays in production (unless explicitly provided)
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
  const isMapPage = location.pathname.startsWith('/map')
  const isAchievementsPage = location.pathname === '/achievements'
  const isProfilePage = location.pathname.startsWith('/profile/')

  const showBackButton =
    ['/admin', '/manage-channels', '/manage-profile', '/donation'].includes(location.pathname) ||
    isAchievementsPage ||
    isDrinkPage ||
    isMapPage ||
    isProfilePage

  const handleBackClick = useCallback(() => {
    if (isProfilePage) {
      // Navigate back to the originating page (leaderboard or map)
      const from = location.state?.from;
      if (from === 'leaderboard') {
        navigate('/leaderboard', { replace: false });
      } else if (from === 'map') {
        navigate('/map', { replace: false });
      } else {
        // Fallback to home if no originating page
        navigate('/home', { replace: false });
      }
      return;
    }
    if (isDrinkPage || isMapPage || isAchievementsPage) {
      navigate('/home', { replace: true })
      return
    }
    navigate(-1)
  }, [isProfilePage, isDrinkPage, isMapPage, isAchievementsPage, navigate, location.state])

  return (
    <div className={`flex items-center gap-3 h-16 ${className}`}>
      {showBackButton ? (
        <button
          type="button"
          onClick={handleBackClick}
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
          <ChannelOverlay
            open={activeOverlay === 'channels'}
            onClose={() => setActiveOverlay(null)}
            channels={pickerChannels}
            selectedChannelId={selectedChannel?.id}
            onSelectChannel={async (channelId) => {
              setActiveOverlay(null);
              try {
                await switchChannel(channelId);
              } catch (error) {
                console.error('Failed to switch channel via picker:', error);
              }
            }}
            onJoinChannel={() => {
              setActiveOverlay(null);
              navigate('/manage-channels');
            }}
          />
        </div>
      )}

      <div className="flex items-center gap-2">
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
