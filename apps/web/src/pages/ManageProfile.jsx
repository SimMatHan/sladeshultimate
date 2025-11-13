import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../components/Card";
import Page from "../components/Page";
import Sheet from "../components/Sheet";
import { useTheme } from "../contexts/ThemeContext";

// Emoji options for profile pictures
const EMOJI_OPTIONS = [
  "🍹", "🍺", "🍷", "🍸", "🥃", "🍾",
  "🎉", "🔥", "🌙", "🌟", "✨", "💫",
  "🎭", "🎪", "🎨", "🎵", "🎸", "🎤",
  "🏖️", "🌴", "🌊", "☀️", "🌙", "⭐",
  "🚀", "💎", "🎯", "🏆", "👑", "💪",
];

// Color gradient options (matching the app's style)
const GRADIENT_OPTIONS = [
  { id: "rose-orange", name: "Rose Orange", gradient: "from-rose-400 to-orange-500" },
  { id: "sky-indigo", name: "Sky Indigo", gradient: "from-sky-400 to-indigo-500" },
  { id: "purple-fuchsia", name: "Purple Fuchsia", gradient: "from-purple-400 to-fuchsia-500" },
  { id: "emerald-teal", name: "Emerald Teal", gradient: "from-emerald-400 to-teal-500" },
  { id: "amber-red", name: "Amber Red", gradient: "from-amber-400 to-red-500" },
  { id: "pink-rose", name: "Pink Rose", gradient: "from-pink-400 to-rose-500" },
  { id: "cyan-blue", name: "Cyan Blue", gradient: "from-cyan-400 to-blue-500" },
  { id: "brand", name: "Brand", gradient: "from-[color:var(--brand,#FF385C)]/90 to-[color:var(--brand,#FF385C)]/70" },
];

// Mock user data - replace with actual Firebase Auth data later
const INITIAL_USER_DATA = {
  username: "@pioneer",
  fullName: "Sladesh Pioneer",
  email: "pioneer@sladesh.com",
  profileEmoji: "🍹",
  profileGradient: "from-rose-400 to-orange-500",
};

export default function ManageProfile() {
  const navigate = useNavigate();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const [userData, setUserData] = useState(INITIAL_USER_DATA);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  const [tempProfile, setTempProfile] = useState({
    emoji: userData.profileEmoji,
    gradient: userData.profileGradient,
  });

  useEffect(() => {
    // Load user data from localStorage or Firebase
    const savedProfile = localStorage.getItem("sladesh:profile");
    if (savedProfile) {
      try {
        const parsed = JSON.parse(savedProfile);
        setUserData((prev) => ({
          ...prev,
          profileEmoji: parsed.profileEmoji || prev.profileEmoji,
          profileGradient: parsed.profileGradient || prev.profileGradient,
        }));
      } catch (e) {
        console.warn("Failed to parse saved profile", e);
      }
    }
  }, []);

  useEffect(() => {
    if (!feedback) return undefined;
    const timeout = setTimeout(() => setFeedback(null), 2800);
    return () => clearTimeout(timeout);
  }, [feedback]);

  // Sync temp profile when sheet opens
  useEffect(() => {
    if (profileSheetOpen) {
      setTempProfile({
        emoji: userData.profileEmoji,
        gradient: userData.profileGradient,
      });
    }
  }, [profileSheetOpen, userData.profileEmoji, userData.profileGradient]);

  const handleEmojiSelect = (emoji) => {
    setTempProfile((prev) => ({
      ...prev,
      emoji,
    }));
  };

  const handleGradientSelect = (gradient) => {
    setTempProfile((prev) => ({
      ...prev,
      gradient,
    }));
  };

  const handleProfileSheetSave = () => {
    setUserData((prev) => ({
      ...prev,
      profileEmoji: tempProfile.emoji,
      profileGradient: tempProfile.gradient,
    }));
    setProfileSheetOpen(false);
    setFeedback("Profile picture updated!");
  };

  const handleSave = () => {
    setSaving(true);
    // Save to localStorage (replace with Firebase update later)
    const payload = {
      username: userData.username,
      fullName: userData.fullName,
      email: userData.email,
      profileEmoji: userData.profileEmoji,
      profileGradient: userData.profileGradient,
    };
    localStorage.setItem("sladesh:profile", JSON.stringify(payload));
    setTimeout(() => {
      setSaving(false);
      setFeedback("Profile updated successfully!");
    }, 450);
  };

  const handleDarkModeToggle = () => {
    const newMode = !isDarkMode;
    toggleDarkMode();
    setFeedback(newMode ? "Switched to dark mode" : "Switched to light mode");
  };

  return (
    <Page title="Manage Profile" allowScroll={true}>
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => navigate("/more")}
          className="mb-2 flex items-center gap-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand,#FF385C)] focus-visible:ring-offset-2"
          style={{ color: 'var(--ink)' }}
          onMouseEnter={(e) => e.target.style.color = 'var(--ink)'}
          onMouseLeave={(e) => e.target.style.color = 'var(--ink)'}
        >
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Back
        </button>

        <Card className="px-5 py-6 space-y-5">
          <div className="space-y-1">
            <div className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
              Profile Picture
            </div>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              This picture will appear across the application.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <div
                className={`flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br ${userData.profileGradient} text-3xl shadow-[0_16px_30px_rgba(15,23,42,0.12)]`}
              >
                {userData.profileEmoji}
              </div>
            </div>
            <div className="flex-1">
              <button
                type="button"
                onClick={() => setProfileSheetOpen(true)}
                className="inline-flex items-center justify-center rounded-full border px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand,#FF385C)] focus-visible:ring-offset-2"
                style={{ 
                  borderColor: 'var(--line)',
                  backgroundColor: 'var(--surface)',
                  color: 'var(--ink)'
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
                Change Picture
              </button>
            </div>
          </div>
        </Card>

        <Card className="px-5 py-6 space-y-5">
          <div className="space-y-1">
            <div className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
              Account Information
            </div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--ink)' }}>
              Your details
            </h2>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              Your account information as it appears in the app.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
                Username
              </label>
              <div className="w-full rounded-2xl border px-4 py-3 text-sm font-mono font-medium tracking-wide" style={{ 
                borderColor: 'var(--line)',
                backgroundColor: 'var(--subtle)',
                color: 'var(--ink)'
              }}>
                {userData.username}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
                Full Name
              </label>
              <div className="w-full rounded-2xl border px-4 py-3 text-sm font-medium" style={{ 
                borderColor: 'var(--line)',
                backgroundColor: 'var(--subtle)',
                color: 'var(--ink)'
              }}>
                {userData.fullName}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
                Email
              </label>
              <div className="w-full rounded-2xl border px-4 py-3 text-sm font-medium" style={{ 
                borderColor: 'var(--line)',
                backgroundColor: 'var(--subtle)',
                color: 'var(--ink)'
              }}>
                {userData.email}
              </div>
            </div>
          </div>
        </Card>

        <Card className="px-5 py-6 space-y-4">
          <div className="space-y-1">
            <div className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
              Appearance
            </div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--ink)' }}>
              Dark Mode
            </h2>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              Toggle dark mode for the application.
            </p>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={isDarkMode}
            onClick={handleDarkModeToggle}
            className="flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand,#FF385C)] focus-visible:ring-offset-2"
            style={{ 
              borderColor: 'var(--line)',
              backgroundColor: 'var(--surface)'
            }}
            onMouseEnter={(e) => {
              e.target.style.borderColor = 'var(--line)';
            }}
            onMouseLeave={(e) => {
              e.target.style.borderColor = 'var(--line)';
            }}
          >
            <span className="space-y-1">
              <span className="block text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                Enable Dark Mode
              </span>
              <span className="block text-xs" style={{ color: 'var(--muted)' }}>
                Switch to dark theme
              </span>
            </span>
            <span
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                isDarkMode
                  ? "bg-[color:var(--brand,#FF385C)]/90"
                  : "bg-neutral-200 text-neutral-400"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                  isDarkMode ? "translate-x-5" : "translate-x-1"
                }`}
              />
            </span>
          </button>
        </Card>

        <div className="pb-4">
          <button
            type="button"
            onClick={handleSave}
            className="w-full inline-flex items-center justify-center rounded-full bg-[color:var(--brand,#FF385C)] px-4 py-3 text-sm font-semibold text-[color:var(--brand-ink,#fff)] shadow-[0_12px_24px_rgba(255,56,92,0.2)] transition hover:-translate-y-[1px] hover:shadow-[0_18px_32px_rgba(255,56,92,0.24)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand,#FF385C)] focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-70"
            disabled={saving}
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>

        {feedback ? (
          <div className="sticky bottom-5 z-10 flex justify-center pt-4">
            <div 
              className="rounded-full border px-4 py-2 text-sm font-medium shadow-[0_18px_36px_rgba(15,23,42,0.15)]"
              style={{ 
                borderColor: 'var(--line)',
                backgroundColor: 'var(--surface)',
                color: 'var(--ink)'
              }}
            >
              {feedback}
            </div>
          </div>
        ) : null}
      </div>

      {/* Profile Picture Customization Sheet */}
      <Sheet
        open={profileSheetOpen}
        onClose={() => setProfileSheetOpen(false)}
        position="bottom"
        title="Customize Profile Picture"
        description="Choose an emoji and color combination"
        height="min(85vh, 700px)"
      >
        <div className="space-y-6">
          {/* Preview */}
          <div className="flex items-center justify-center py-6">
            <div
              className={`flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br ${tempProfile.gradient} text-5xl shadow-[0_20px_40px_rgba(15,23,42,0.15)]`}
            >
              {tempProfile.emoji}
            </div>
          </div>

          {/* Emoji Picker */}
          <div className="space-y-3">
            <div className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
              Choose Emoji
            </div>
            <div className="grid grid-cols-6 gap-2">
              {EMOJI_OPTIONS.map((emoji) => {
                const isSelected = tempProfile.emoji === emoji;
                return (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleEmojiSelect(emoji)}
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl border text-2xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand,#FF385C)] focus-visible:ring-offset-2 focus-visible:ring-offset-white ${
                      isSelected
                        ? "border-[color:var(--brand,#FF385C)] bg-[color:var(--brand,#FF385C)]/10 scale-110"
                        : "border-neutral-200 bg-white hover:border-neutral-300 hover:scale-105"
                    }`}
                    aria-pressed={isSelected}
                  >
                    {emoji}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Gradient Picker */}
          <div className="space-y-3">
            <div className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
              Choose Color
            </div>
            <div className="grid grid-cols-4 gap-2">
              {GRADIENT_OPTIONS.map((option) => {
                const isSelected = tempProfile.gradient === option.gradient;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleGradientSelect(option.gradient)}
                    className={`relative flex h-14 w-full items-center justify-center rounded-2xl border-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand,#FF385C)] focus-visible:ring-offset-2 focus-visible:ring-offset-white ${
                      isSelected
                        ? "border-[color:var(--brand,#FF385C)] ring-2 ring-[color:var(--brand,#FF385C)]/20 scale-105"
                        : "border-neutral-200 hover:border-neutral-300 hover:scale-105"
                    }`}
                    aria-pressed={isSelected}
                    title={option.name}
                  >
                    <div
                      className={`h-full w-full rounded-xl bg-gradient-to-br ${option.gradient}`}
                    />
                    {isSelected && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <svg
                          className="h-5 w-5 text-white drop-shadow-lg"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="3"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Save Button */}
          <div className="pt-6 pb-8">
            <button
              type="button"
              onClick={handleProfileSheetSave}
              className="w-full inline-flex items-center justify-center rounded-full bg-[color:var(--brand,#FF385C)] px-4 py-3 text-sm font-semibold text-[color:var(--brand-ink,#fff)] shadow-[0_12px_24px_rgba(255,56,92,0.2)] transition hover:-translate-y-[1px] hover:shadow-[0_18px_32px_rgba(255,56,92,0.24)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand,#FF385C)] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              Save Changes
            </button>
          </div>
        </div>
      </Sheet>
    </Page>
  );
}
