import { useEffect, useState } from "react";
import Card from "../components/Card";
import Page from "../components/Page";

const EMOJI_CHOICES = ["🍹", "🍺", "🍷", "🍸", "🎉", "🔥", "🌙", "🌟"];

const INITIAL_PROFILE = {
  displayName: "Sladesh Pioneer",
  username: "@pioneer",
  statusEmoji: "🍹",
  favoriteDrink: "Margarita",
  bio: "Here for good vibes, better drinks, and nightly adventures.",
  city: "Copenhagen",
  notifications: {
    channelUpdates: true,
    mentions: true,
    weeklySummary: false,
  },
  privacy: {
    showOnLeaderboard: true,
    allowInvites: true,
  },
};

function SectionHeader({ eyebrow, title, description }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium uppercase tracking-wide text-neutral-400">
        {eyebrow}
      </div>
      <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
      {description ? (
        <p className="text-sm text-neutral-500">{description}</p>
      ) : null}
    </div>
  );
}

function PreferenceToggle({ label, description, value, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={onChange}
      className="flex w-full items-center justify-between rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-left transition hover:border-neutral-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand,#FF385C)] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
    >
      <span className="space-y-1">
        <span className="block text-sm font-semibold text-neutral-900">
          {label}
        </span>
        {description ? (
          <span className="block text-xs text-neutral-500">{description}</span>
        ) : null}
      </span>
      <span
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
          value
            ? "bg-[color:var(--brand,#FF385C)]/90"
            : "bg-neutral-200 text-neutral-400"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
            value ? "translate-x-5" : "translate-x-1"
          }`}
        />
      </span>
    </button>
  );
}

export default function ManageProfile() {
  const [profile, setProfile] = useState(INITIAL_PROFILE);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    if (!feedback) return undefined;
    const timeout = setTimeout(() => setFeedback(null), 2800);
    return () => clearTimeout(timeout);
  }, [feedback]);

  const handleInputChange = (field) => (event) =>
    setProfile((prev) => ({ ...prev, [field]: event.target.value }));

  const toggleNotification = (field) =>
    setProfile((prev) => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [field]: !prev.notifications[field],
      },
    }));

  const togglePrivacy = (field) =>
    setProfile((prev) => ({
      ...prev,
      privacy: {
        ...prev.privacy,
        [field]: !prev.privacy[field],
      },
    }));

  const handleEmojiSelect = (emoji) => {
    setProfile((prev) => ({ ...prev, statusEmoji: emoji }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setSaving(true);
    const payload = { ...profile };
    window.localStorage.setItem("sladesh:profile", JSON.stringify(payload));
    setTimeout(() => {
      setSaving(false);
      setFeedback("Profile updated. You’re all set!");
    }, 450);
  };

  return (
    <Page
      title="Manage Profile"
      allowScroll={true}
      actions={
        <button
          type="submit"
          form="profile-form"
          className="inline-flex items-center justify-center rounded-full bg-[color:var(--brand,#FF385C)] px-4 py-2 text-sm font-semibold text-[color:var(--brand-ink,#fff)] shadow-[0_12px_24px_rgba(255,56,92,0.2)] transition hover:-translate-y-[1px] hover:shadow-[0_18px_32px_rgba(255,56,92,0.24)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand,#FF385C)] focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-70"
          disabled={saving}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      }
    >
      <form id="profile-form" className="space-y-6" onSubmit={handleSubmit}>
        <Card className="px-5 py-6 space-y-5">
          <SectionHeader
            eyebrow="Overview"
            title="Your Sladesh identity"
            description="What friends and teammates see across channels and leaderboards."
          />
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => {
                const next =
                  EMOJI_CHOICES[
                    (EMOJI_CHOICES.indexOf(profile.statusEmoji) + 1) %
                      EMOJI_CHOICES.length
                  ];
                handleEmojiSelect(next);
              }}
              className="flex h-16 w-16 items-center justify-center rounded-3xl border border-neutral-200 bg-white text-3xl shadow-[0_16px_30px_rgba(15,23,42,0.12)] transition hover:-translate-y-[1px] hover:shadow-[0_20px_36px_rgba(15,23,42,0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand,#FF385C)] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              aria-label="Change status emoji"
            >
              <span>{profile.statusEmoji}</span>
            </button>
            <div className="space-y-2">
              <div className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                Status emoji
              </div>
              <p className="text-sm text-neutral-500">
                Tap to cycle through vibes. Pick something that matches tonight.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <label className="space-y-2">
              <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                Display name
              </span>
              <input
                type="text"
                value={profile.displayName}
                onChange={handleInputChange("displayName")}
                placeholder="Your full name"
                className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-medium text-neutral-800 placeholder:text-neutral-400 focus:border-[color:var(--brand,#FF385C)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[color:var(--brand,#FF385C)] focus:ring-offset-1 focus:ring-offset-white"
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                Username
              </span>
              <input
                type="text"
                value={profile.username}
                onChange={handleInputChange("username")}
                placeholder="@handle"
                className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-mono font-medium tracking-wide text-neutral-800 placeholder:text-neutral-400 focus:border-[color:var(--brand,#FF385C)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[color:var(--brand,#FF385C)] focus:ring-offset-1 focus:ring-offset-white"
              />
            </label>
          </div>
          <label className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">
              Bio
            </span>
            <textarea
              rows={3}
              value={profile.bio}
              onChange={handleInputChange("bio")}
              placeholder="Let people know what kind of night you’re planning."
              className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-800 placeholder:text-neutral-400 focus:border-[color:var(--brand,#FF385C)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[color:var(--brand,#FF385C)] focus:ring-offset-1 focus:ring-offset-white"
            />
          </label>
        </Card>

        <Card className="px-5 py-6 space-y-5">
          <SectionHeader
            eyebrow="Preferences"
            title="Signature drink & hometown"
            description="We use this to tailor drink recs, leaderboards, and invites."
          />
          <div className="grid grid-cols-1 gap-4">
            <label className="space-y-2">
              <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                Favorite drink
              </span>
              <input
                type="text"
                value={profile.favoriteDrink}
                onChange={handleInputChange("favoriteDrink")}
                placeholder="Margarita, IPA, Mezcal Negroni..."
                className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-800 placeholder:text-neutral-400 focus:border-[color:var(--brand,#FF385C)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[color:var(--brand,#FF385C)] focus:ring-offset-1 focus:ring-offset-white"
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                Home city
              </span>
              <input
                type="text"
                value={profile.city}
                onChange={handleInputChange("city")}
                placeholder="Copenhagen"
                className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-800 placeholder:text-neutral-400 focus:border-[color:var(--brand,#FF385C)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[color:var(--brand,#FF385C)] focus:ring-offset-1 focus:ring-offset-white"
              />
            </label>
          </div>
          <div className="space-y-3">
            <span className="block text-xs font-medium uppercase tracking-wide text-neutral-400">
              Quick emoji pick
            </span>
            <div className="flex flex-wrap gap-2">
              {EMOJI_CHOICES.map((emoji) => {
                const isActive = profile.statusEmoji === emoji;
                return (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleEmojiSelect(emoji)}
                    className={`flex h-11 w-11 items-center justify-center rounded-2xl border text-xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand,#FF385C)] focus-visible:ring-offset-2 focus-visible:ring-offset-white ${
                      isActive
                        ? "border-[color:var(--brand,#FF385C)] bg-[color:var(--brand,#FF385C)]/10"
                        : "border-neutral-200 bg-white hover:border-neutral-300"
                    }`}
                    aria-pressed={isActive}
                  >
                    {emoji}
                  </button>
                );
              })}
            </div>
          </div>
        </Card>

        <Card className="px-5 py-6 space-y-4">
          <SectionHeader
            eyebrow="Notifications"
            title="When we should nudge you"
            description="Tune how Sladesh reaches you across channels and check-ins."
          />
          <div className="space-y-3">
            <PreferenceToggle
              label="Channel updates"
              description="Highlights when a channel you follow gets active."
              value={profile.notifications.channelUpdates}
              onChange={() => toggleNotification("channelUpdates")}
            />
            <PreferenceToggle
              label="Mentions"
              description="Ping me when someone tags me in a conversation."
              value={profile.notifications.mentions}
              onChange={() => toggleNotification("mentions")}
            />
            <PreferenceToggle
              label="Weekly summary"
              description="One digest with stats, streaks, and new invites."
              value={profile.notifications.weeklySummary}
              onChange={() => toggleNotification("weeklySummary")}
            />
          </div>
        </Card>

        <Card className="px-5 py-6 space-y-4">
          <SectionHeader
            eyebrow="Privacy"
            title="Control your visibility"
            description="Choose how others discover or track you on Sladesh."
          />
          <div className="space-y-3">
            <PreferenceToggle
              label="Appear on leaderboards"
              description="When enabled, friends can see your ranking."
              value={profile.privacy.showOnLeaderboard}
              onChange={() => togglePrivacy("showOnLeaderboard")}
            />
            <PreferenceToggle
              label="Allow new invites"
              description="Friends-of-friends can invite you to their channels."
              value={profile.privacy.allowInvites}
              onChange={() => togglePrivacy("allowInvites")}
            />
          </div>
        </Card>
      </form>

      {feedback ? (
        <div className="sticky bottom-5 z-10 flex justify-center pt-4">
          <div className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-600 shadow-[0_18px_36px_rgba(15,23,42,0.15)]">
            {feedback}
          </div>
        </div>
      ) : null}
    </Page>
  );
}
