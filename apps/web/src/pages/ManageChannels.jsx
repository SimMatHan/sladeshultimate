import { useEffect, useMemo, useState } from "react";
import Card from "../components/Card";
import Page from "../components/Page";

const INITIAL_CHANNELS = [
  {
    id: "sladesh-core",
    name: "Sladesh Crew",
    members: 12,
    visibility: "private",
    code: "SLA-2218",
    notifications: true,
    lastActivity: "2 min ago",
  },
  {
    id: "friday-bar",
    name: "Friday Bar",
    members: 28,
    visibility: "public",
    code: "FRI-9024",
    notifications: false,
    lastActivity: "18 min ago",
  },
];

const VISIBILITY_OPTIONS = [
  { value: "public", label: "Public · Anyone with invite can join" },
  { value: "private", label: "Private · Only invited members" },
  { value: "hidden", label: "Hidden · Invite only, not searchable" },
];

function ChannelCard({ channel, onToggleNotifications, onCopyCode }) {
  const { id, name, members, visibility, code, notifications, lastActivity } =
    channel;

  return (
    <Card bare className="px-5 py-4 transition-colors hover:border-neutral-300">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="text-xs font-medium uppercase tracking-wide text-neutral-400">
            Channel
          </div>
          <div className="text-base font-semibold text-neutral-900">{name}</div>
          <div className="text-xs text-neutral-500">
            {members} members ·{" "}
            {visibility === "public"
              ? "Open access"
              : visibility === "hidden"
              ? "Hidden channel"
              : "Invite only"}
          </div>
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Active {lastActivity}
          </div>
          <button
            type="button"
            onClick={() => onCopyCode(code)}
            className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-semibold text-neutral-600 transition hover:border-neutral-300 hover:text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand,#FF385C)] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            <span>{code}</span>
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                d="M7 7.5V5.4A1.4 1.4 0 0 1 8.4 4h6.2A1.4 1.4 0 0 1 16 5.4v6.2a1.4 1.4 0 0 1-1.4 1.4H12.5"
                strokeLinecap="round"
              />
              <rect
                x="4"
                y="7.5"
                width="8.5"
                height="8.5"
                rx="1.4"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={() => onToggleNotifications(id)}
            className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand,#FF385C)] focus-visible:ring-offset-2 focus-visible:ring-offset-white ${
              notifications
                ? "border-emerald-200 bg-emerald-50 text-emerald-600"
                : "border-neutral-200 bg-white text-neutral-500 hover:border-neutral-300 hover:text-neutral-700"
            }`}
            aria-pressed={notifications}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {notifications ? "Notifications on" : "Notifications off"}
          </button>
        </div>
      </div>
    </Card>
  );
}

function Field({ label, input, description }) {
  return (
    <label className="block space-y-2">
      <div className="space-y-1">
        <div className="text-xs font-medium uppercase tracking-wide text-neutral-400">
          {label}
        </div>
        {description ? (
          <div className="text-xs text-neutral-500">{description}</div>
        ) : null}
      </div>
      {input}
    </label>
  );
}

export default function ManageChannels() {
  const [channels, setChannels] = useState(INITIAL_CHANNELS);
  const [createForm, setCreateForm] = useState({
    name: "",
    visibility: "private",
    description: "",
  });
  const [joinCode, setJoinCode] = useState("");
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    if (!feedback) return undefined;
    const timeout = setTimeout(() => setFeedback(null), 2800);
    return () => clearTimeout(timeout);
  }, [feedback]);

  const totalMembers = useMemo(
    () => channels.reduce((sum, channel) => sum + channel.members, 0),
    [channels]
  );

  const handleToggleNotifications = (id) => {
    setChannels((prev) =>
      prev.map((channel) =>
        channel.id === id
          ? { ...channel, notifications: !channel.notifications }
          : channel
      )
    );
    setFeedback("Notification preference updated.");
  };

  const handleCopyCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setFeedback("Invite code copied to clipboard.");
    } catch {
      setFeedback("Could not copy the invite code. Try manually.");
    }
  };

  const handleCreateChannel = (event) => {
    event.preventDefault();
    if (!createForm.name.trim()) {
      setFeedback("Give your channel a name first.");
      return;
    }
    const normalizedName = createForm.name.trim();
    const code = `${normalizedName.slice(0, 3).toUpperCase()}-${Math.floor(
      1000 + Math.random() * 9000
    )}`;

    const newChannel = {
      id: `${normalizedName.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`,
      name: normalizedName,
      members: 1,
      visibility: createForm.visibility,
      code,
      notifications: true,
      lastActivity: "Just created",
      description: createForm.description.trim(),
    };

    setChannels((prev) => [newChannel, ...prev]);
    setCreateForm({ name: "", visibility: createForm.visibility, description: "" });
    setFeedback(`“${normalizedName}” is live. Invite your crew!`);
  };

  const handleJoinChannel = (event) => {
    event.preventDefault();
    if (!joinCode.trim()) {
      setFeedback("Enter an invite code to join a channel.");
      return;
    }
    const code = joinCode.trim().toUpperCase();
    const existing = channels.find((channel) => channel.code === code);

    if (existing) {
      setFeedback(`You’re already part of ${existing.name}.`);
    } else {
      setChannels((prev) => [
        {
          id: `joined-${code}`,
          name: `Channel ${code}`,
          members: 1,
          visibility: "private",
          code,
          notifications: true,
          lastActivity: "Just joined",
        },
        ...prev,
      ]);
      setFeedback(`Joined channel with invite code ${code}.`);
    }
    setJoinCode("");
  };

  return (
    <Page title="Manage Channels" allowScroll={true}>
      <div className="space-y-6">
        <Card className="px-5 py-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                Your reach
              </div>
              <div className="text-lg font-semibold text-neutral-900">
                {channels.length} channels · {totalMembers} sladeshers
              </div>
            </div>
            <div className="rounded-2xl bg-[color:var(--brand,#FF385C)]/10 px-3 py-1 text-sm font-semibold text-[color:var(--brand,#FF385C)]">
              Live
            </div>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-neutral-500">
            Channels keep your nights organised. Create one for each occasion or
            join friends with an invite code.
          </p>
        </Card>

        <Card className="px-5 py-6 space-y-5">
          <div className="space-y-1">
            <div className="text-xs font-medium uppercase tracking-wide text-neutral-400">
              Create channel
            </div>
            <h2 className="text-lg font-semibold text-neutral-900">
              Spin up a new space
            </h2>
            <p className="text-sm text-neutral-500">
              Name your channel and pick who can discover it.
            </p>
          </div>
          <form className="space-y-4" onSubmit={handleCreateChannel}>
            <Field
              label="Channel name"
              input={
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(event) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Friday Bar at Mikeller"
                  className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-medium text-neutral-800 placeholder:text-neutral-400 focus:border-[color:var(--brand,#FF385C)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[color:var(--brand,#FF385C)] focus:ring-offset-1 focus:ring-offset-white"
                />
              }
            />
            <Field
              label="Visibility"
              input={
                <select
                  value={createForm.visibility}
                  onChange={(event) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      visibility: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-800 focus:border-[color:var(--brand,#FF385C)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[color:var(--brand,#FF385C)] focus:ring-offset-1 focus:ring-offset-white"
                >
                  {VISIBILITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              }
            />
            <Field
              label="Description"
              description="Optional. Briefly let people know what this channel is for."
              input={
                <textarea
                  rows={3}
                  value={createForm.description}
                  onChange={(event) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      description: event.target.value,
                    }))
                  }
                  placeholder="Weekly meetup for exploring new craft beers."
                  className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-800 placeholder:text-neutral-400 focus:border-[color:var(--brand,#FF385C)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[color:var(--brand,#FF385C)] focus:ring-offset-1 focus:ring-offset-white"
                />
              }
            />
            <div className="flex justify-end">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-full bg-[color:var(--brand,#FF385C)] px-5 py-2 text-sm font-semibold text-[color:var(--brand-ink,#fff)] shadow-[0_16px_30px_rgba(255,56,92,0.2)] transition hover:translate-y-[-1px] hover:shadow-[0_22px_38px_rgba(255,56,92,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand,#FF385C)] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              >
                Create channel
              </button>
            </div>
          </form>
        </Card>

        <Card className="px-5 py-6 space-y-4">
          <div className="space-y-1">
            <div className="text-xs font-medium uppercase tracking-wide text-neutral-400">
              Join friends
            </div>
            <h2 className="text-lg font-semibold text-neutral-900">
              Enter invite code
            </h2>
            <p className="text-sm text-neutral-500">
              Already have a code? Drop it below to hop in instantly.
            </p>
          </div>
          <form className="flex flex-col gap-3" onSubmit={handleJoinChannel}>
            <input
              type="text"
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value)}
              placeholder="e.g. FRI-9024"
              className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold tracking-[0.28em] text-neutral-800 placeholder:tracking-normal placeholder:text-neutral-400 focus:border-[color:var(--brand,#FF385C)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[color:var(--brand,#FF385C)] focus:ring-offset-1 focus:ring-offset-white uppercase"
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-full border border-neutral-200 bg-white px-5 py-2 text-sm font-semibold text-neutral-700 transition hover:border-neutral-300 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand,#FF385C)] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              Join channel
            </button>
          </form>
        </Card>

        <div className="space-y-3">
          <div className="text-xs font-medium uppercase tracking-wide text-neutral-400">
            Your channels
          </div>
          <div className="space-y-3">
            {channels.map((channel) => (
              <ChannelCard
                key={channel.id}
                channel={channel}
                onToggleNotifications={handleToggleNotifications}
                onCopyCode={handleCopyCode}
              />
            ))}
          </div>
        </div>

        {feedback ? (
          <div className="sticky bottom-5 z-10 flex justify-center">
            <div className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-600 shadow-[0_18px_36px_rgba(15,23,42,0.15)]">
              {feedback}
            </div>
          </div>
        ) : null}
      </div>
    </Page>
  );
}
