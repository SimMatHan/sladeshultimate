import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../components/Card";
import Page from "../components/Page";
import Sheet from "../components/Sheet";

const INITIAL_CHANNELS = [
  {
    id: "sladesh-core",
    name: "Sladesh Crew",
    members: 12,
    visibility: "private",
    code: "SLA-2218",
    notifications: true,
    lastActivity: "2 min ago",
    memberList: [
      { id: "1", name: "Alex Johnson", username: "@alexj", status: "online" },
      { id: "2", name: "Sarah Chen", username: "@sarahc", status: "online" },
      { id: "3", name: "Mike Rodriguez", username: "@miker", status: "offline" },
      { id: "4", name: "Emma Wilson", username: "@emmaw", status: "online" },
      { id: "5", name: "David Kim", username: "@davidk", status: "offline" },
      { id: "6", name: "Lisa Anderson", username: "@lisaa", status: "online" },
      { id: "7", name: "Tom Brown", username: "@tomb", status: "online" },
      { id: "8", name: "Sophie Martin", username: "@sophiem", status: "offline" },
      { id: "9", name: "James Taylor", username: "@jamest", status: "online" },
      { id: "10", name: "Olivia White", username: "@oliviaw", status: "online" },
      { id: "11", name: "Noah Garcia", username: "@noahg", status: "offline" },
      { id: "12", name: "Ava Martinez", username: "@avam", status: "online" },
    ],
  },
  {
    id: "friday-bar",
    name: "Friday Bar",
    members: 28,
    visibility: "public",
    code: "FRI-9024",
    notifications: false,
    lastActivity: "18 min ago",
    memberList: [
      { id: "1", name: "Chris Lee", username: "@chrisl", status: "online" },
      { id: "2", name: "Maya Patel", username: "@mayap", status: "online" },
      { id: "3", name: "Ryan O'Connor", username: "@ryano", status: "online" },
      { id: "4", name: "Zoe Thompson", username: "@zoet", status: "offline" },
      { id: "5", name: "Lucas Schmidt", username: "@lucass", status: "online" },
      { id: "6", name: "Isabella Rossi", username: "@isabellar", status: "online" },
      { id: "7", name: "Ethan Zhang", username: "@ethanz", status: "offline" },
      { id: "8", name: "Mia Johnson", username: "@miaj", status: "online" },
      { id: "9", name: "Liam Williams", username: "@liamw", status: "online" },
      { id: "10", name: "Charlotte Davis", username: "@charlotted", status: "offline" },
      { id: "11", name: "Benjamin Moore", username: "@benjaminm", status: "online" },
      { id: "12", name: "Amelia Clark", username: "@ameliac", status: "online" },
      { id: "13", name: "Henry Lewis", username: "@henryl", status: "offline" },
      { id: "14", name: "Harper Walker", username: "@harperw", status: "online" },
      { id: "15", name: "Alexander Hall", username: "@alexanderh", status: "online" },
      { id: "16", name: "Evelyn Young", username: "@evelyny", status: "offline" },
      { id: "17", name: "Daniel King", username: "@danielk", status: "online" },
      { id: "18", name: "Abigail Wright", username: "@abigailw", status: "online" },
      { id: "19", name: "Matthew Lopez", username: "@matthewl", status: "offline" },
      { id: "20", name: "Emily Hill", username: "@emilyh", status: "online" },
      { id: "21", name: "Joseph Green", username: "@josephg", status: "online" },
      { id: "22", name: "Sofia Adams", username: "@sofiaa", status: "offline" },
      { id: "23", name: "Samuel Baker", username: "@samuelb", status: "online" },
      { id: "24", name: "Aria Nelson", username: "@arian", status: "online" },
      { id: "25", name: "Jack Carter", username: "@jackc", status: "offline" },
      { id: "26", name: "Grace Mitchell", username: "@gracem", status: "online" },
      { id: "27", name: "Owen Perez", username: "@owenp", status: "online" },
      { id: "28", name: "Lily Roberts", username: "@lilyr", status: "offline" },
    ],
  },
];

function ChannelCard({ channel, onCopyCode, onClick }) {
  const { name, members, visibility, code, lastActivity } = channel;

  return (
    <Card 
      bare 
      className="px-5 py-4 transition-colors hover:border-neutral-300 cursor-pointer"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      <div className="flex items-center justify-between gap-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-4 mb-3">
            <div className="text-base font-semibold truncate flex-1" style={{ color: 'var(--ink)' }}>{name}</div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="text-xs" style={{ color: 'var(--muted)' }}>{lastActivity}</span>
            </div>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="text-xs" style={{ color: 'var(--muted)' }}>
              {members} {members === 1 ? 'member' : 'members'}
            </div>
            <span style={{ color: 'var(--line)' }}>·</span>
            <div className="text-xs" style={{ color: 'var(--muted)' }}>
              {visibility === "public"
                ? "Open access"
                : visibility === "hidden"
                ? "Hidden channel"
                : "Invite only"}
            </div>
            <span style={{ color: 'var(--line)' }}>·</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCopyCode(code);
              }}
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand,#FF385C)] focus-visible:ring-offset-2"
              style={{ 
                borderColor: 'var(--line)',
                backgroundColor: 'var(--subtle)',
                color: 'var(--ink)'
              }}
              onMouseEnter={(e) => {
                e.target.style.borderColor = 'var(--line)';
                e.target.style.color = 'var(--ink)';
                e.target.style.backgroundColor = 'var(--subtle)';
              }}
              onMouseLeave={(e) => {
                e.target.style.borderColor = 'var(--line)';
                e.target.style.color = 'var(--ink)';
                e.target.style.backgroundColor = 'var(--subtle)';
              }}
            >
              <span>{code}</span>
              <svg
                className="h-3 w-3"
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
        </div>
        <svg
          className="h-5 w-5 shrink-0"
          style={{ color: 'var(--muted)' }}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        >
          <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </Card>
  );
}

function MemberListItem({ member }) {
  const statusColors = {
    online: "bg-emerald-500",
    offline: "bg-neutral-300",
  };

  const statusLabels = {
    online: "Checked In",
    offline: "Not Checked In",
  };

  return (
    <div className="flex items-center gap-3 py-3 border-b last:border-0" style={{ borderColor: 'var(--line)' }}>
      <div className="relative">
        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[color:var(--brand,#FF385C)]/20 to-[color:var(--brand,#FF385C)]/10 flex items-center justify-center text-sm font-semibold text-[color:var(--brand,#FF385C)]">
          {member.name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()}
        </div>
        <span
          className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${statusColors[member.status] || statusColors.offline}`}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate" style={{ color: 'var(--ink)' }}>{member.name}</div>
        <div className="text-xs" style={{ color: 'var(--muted)' }}>{member.username}</div>
      </div>
      <div className="text-xs font-medium" style={{ color: 'var(--muted)' }}>{statusLabels[member.status] || statusLabels.offline}</div>
    </div>
  );
}

function ChannelMembersSheet({ channel, open, onClose }) {
  if (!channel) return null;

  const onlineCount = channel.memberList?.filter((m) => m.status === "online").length || 0;
  const offlineCount = channel.memberList?.filter((m) => m.status === "offline").length || 0;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      position="bottom"
      title={channel.name}
      description={`${channel.members} ${channel.members === 1 ? 'member' : 'members'}`}
      height="min(80vh, 600px)"
    >
      <div className="space-y-4">
        {onlineCount > 0 || offlineCount > 0 ? (
          <div className="flex items-center gap-4 text-xs pb-2 border-b" style={{ color: 'var(--muted)', borderColor: 'var(--line)' }}>
            {onlineCount > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span>{onlineCount} Checked In</span>
              </div>
            )}
            {offlineCount > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-neutral-300" />
                <span>{offlineCount} Not Checked In</span>
              </div>
            )}
          </div>
        ) : null}

        <div className="space-y-1">
          {channel.memberList && channel.memberList.length > 0 ? (
            channel.memberList.map((member) => (
              <MemberListItem key={member.id} member={member} />
            ))
          ) : (
            <div className="py-8 text-center text-sm" style={{ color: 'var(--muted)' }}>
              No members found
            </div>
          )}
        </div>
      </div>
    </Sheet>
  );
}

export default function ManageChannels() {
  const navigate = useNavigate();
  const [channels, setChannels] = useState(INITIAL_CHANNELS);
  const [joinCode, setJoinCode] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [selectedChannel, setSelectedChannel] = useState(null);

  useEffect(() => {
    if (!feedback) return undefined;
    const timeout = setTimeout(() => setFeedback(null), 2800);
    return () => clearTimeout(timeout);
  }, [feedback]);

  const totalMembers = useMemo(
    () => channels.reduce((sum, channel) => sum + channel.members, 0),
    [channels]
  );

  const handleCopyCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setFeedback("Invite code copied to clipboard.");
    } catch {
      setFeedback("Could not copy the invite code. Try manually.");
    }
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
          memberList: [
            {
              id: "1",
              name: "You",
              username: "@you",
              status: "online",
            },
          ],
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

        <Card className="px-5 py-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
                Your reach
              </div>
              <div className="text-lg font-semibold" style={{ color: 'var(--ink)' }}>
                {channels.length} channels · {totalMembers} sladeshers
              </div>
            </div>
            <div className="rounded-2xl bg-[color:var(--brand,#FF385C)]/10 px-3 py-1 text-sm font-semibold text-[color:var(--brand,#FF385C)]">
              Live
            </div>
          </div>
          <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
            Channels keep your nights organised. Join friends with an invite code.
          </p>
        </Card>

        <Card className="px-5 py-6 space-y-4">
          <div className="space-y-1">
            <div className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
              Join friends
            </div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--ink)' }}>
              Enter invite code
            </h2>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              Already have a code? Drop it below to hop in instantly.
            </p>
          </div>
          <form className="flex flex-col gap-3" onSubmit={handleJoinChannel}>
            <input
              type="text"
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value)}
              placeholder="e.g. FRI-9024"
              className="w-full rounded-2xl border px-4 py-3 text-sm font-semibold tracking-[0.28em] uppercase focus:outline-none focus:ring-2 focus:ring-[color:var(--brand,#FF385C)] focus:ring-offset-1"
              style={{ 
                borderColor: 'var(--line)',
                backgroundColor: 'var(--subtle)',
                color: 'var(--ink)',
                '--tw-ring-offset-color': 'var(--bg)'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'var(--brand)';
                e.target.style.backgroundColor = 'var(--surface)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'var(--line)';
                e.target.style.backgroundColor = 'var(--subtle)';
              }}
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-full border px-5 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand,#FF385C)] focus-visible:ring-offset-2"
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
              Join channel
            </button>
          </form>
        </Card>

        <div className="space-y-3">
          <div className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
            Your channels
          </div>
          <div className="space-y-3">
            {channels.map((channel) => (
              <ChannelCard
                key={channel.id}
                channel={channel}
                onCopyCode={handleCopyCode}
                onClick={() => setSelectedChannel(channel)}
              />
            ))}
          </div>
        </div>

        <ChannelMembersSheet
          channel={selectedChannel}
          open={selectedChannel !== null}
          onClose={() => setSelectedChannel(null)}
        />

        {feedback ? (
          <div className="sticky bottom-5 z-10 flex justify-center">
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
    </Page>
  );
}
