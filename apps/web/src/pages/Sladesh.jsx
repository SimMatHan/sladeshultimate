function formatDurationUntilReset(targetDate) {
  if (!targetDate) return "snart";
  const diffMs = Math.max(0, targetDate.getTime() - Date.now());
  const diffMinutes = Math.round(diffMs / 60000);
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours} ${hours === 1 ? "time" : "timer"} og ${minutes} ${minutes === 1 ? "minut" : "minutter"}`;
  }
  if (hours > 0) {
    return `${hours} ${hours === 1 ? "time" : "timer"}`;
  }
  if (minutes > 0) {
    return `${minutes} ${minutes === 1 ? "minut" : "minutter"}`;
  }
  return "få sekunder";
}
import { useState, useMemo, useEffect, useCallback } from "react";
import Card from "../components/Card";
import Page from "../components/Page";
import { useLocation } from "../contexts/LocationContext";
import { useTheme } from "../contexts/ThemeContext";
import { useChannel } from "../hooks/useChannel";
import { useAuth } from "../hooks/useAuth";
import { USE_MOCK_DATA } from "../config/env";
import { getUser, getSladeshCooldownState, addSladesh, updateUserLocation, getNextResetBoundary, getLatestResetBoundary } from "../services/userService";
import { getCheckedInChannelMembers } from "../services/channelService";
import { incrementSladeshCount } from "../services/statsService";
import { resolveMockChannelKey, isMemberOfMockChannel, MOCK_CHANNEL_KEYS } from "../utils/mockChannels";
import { useSladesh, SLADESH_STATUS } from "../contexts/SladeshContext";

const MOCK_PARTICIPANTS = [
  {
    id: "sofie",
    name: "Sofie Holm",
    username: "sofie",
    initials: "SH",
    profileEmoji: "🍹",
    profileGradient: "from-rose-400 to-pink-500",
    accent: "from-rose-400 to-pink-500",
    radius: 128,
    duration: 28,
    mockChannels: [MOCK_CHANNEL_KEYS.OPEN],
  },
  {
    id: "malte",
    name: "Malte Jensen",
    username: "malte",
    initials: "MJ",
    profileEmoji: "🍺",
    profileGradient: "from-amber-400 to-orange-500",
    accent: "from-amber-400 to-orange-500",
    radius: 122,
    duration: 24,
    mockChannels: [MOCK_CHANNEL_KEYS.OPEN],
  },
  {
    id: "olivia",
    name: "Olivia Madsen",
    username: "olivia",
    initials: "OM",
    profileEmoji: "🍸",
    profileGradient: "from-violet-400 to-purple-500",
    accent: "from-violet-400 to-purple-500",
    radius: 116,
    duration: 32,
    mockChannels: [MOCK_CHANNEL_KEYS.BALLADE],
  },
  {
    id: "noah",
    name: "Noah Leth",
    username: "noah",
    initials: "NL",
    profileEmoji: "🥃",
    profileGradient: "from-emerald-400 to-teal-500",
    accent: "from-emerald-400 to-teal-500",
    radius: 128,
    duration: 30,
    mockChannels: [MOCK_CHANNEL_KEYS.BALLADE],
  },
  {
    id: "emma",
    name: "Emma Friis",
    username: "emma",
    initials: "EF",
    profileEmoji: "🍷",
    profileGradient: "from-sky-400 to-cyan-500",
    accent: "from-sky-400 to-cyan-500",
    radius: 118,
    duration: 22,
    mockChannels: [MOCK_CHANNEL_KEYS.OPEN],
  },
  {
    id: "lars",
    name: "Lars Bæk",
    username: "lars",
    initials: "LB",
    profileEmoji: "🍾",
    profileGradient: "from-slate-400 to-indigo-500",
    accent: "from-slate-400 to-indigo-500",
    radius: 132,
    duration: 26,
    mockChannels: [MOCK_CHANNEL_KEYS.BALLADE],
  },
];

const DEFAULT_LOCATION = {
  lat: 55.6761,
  lng: 12.5683,
};

const TIME_FORMATTER = new Intl.DateTimeFormat("da-DK", {
  hour: "2-digit",
  minute: "2-digit",
});

const MOCK_SLADESH_STORAGE_KEY = "sladesh:mockLastSladeshAt";

export default function Sladesh() {
  // CHANNEL FILTERING: All members shown in the Sladesh orbit are filtered by the active channel.
  // The activeChannelId comes from useChannel() hook, which provides selectedChannel?.id.
  // Only checked-in members of the active channel can receive Sladesh.
  const { currentUser } = useAuth();
  const { selectedChannel } = useChannel();
  const { updateLocation, userLocation } = useLocation();
  const { challenges, sendSladesh, removeChallenge } = useSladesh();

  const [userProfile, setUserProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(!USE_MOCK_DATA);
  const [profileError, setProfileError] = useState(null);
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(!USE_MOCK_DATA);
  const [membersError, setMembersError] = useState(null);
  const [pendingTarget, setPendingTarget] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [senderTimeLeft, setSenderTimeLeft] = useState(null);
  const FINISHED_SENDER_CHALLENGES_KEY = "sladesh:finishedSenderChallenges";
  const [finishedSenderChallengeIds, setFinishedSenderChallengeIds] = useState(() => {
    try {
      if (typeof window === "undefined") return new Set();
      const stored = window.localStorage.getItem(FINISHED_SENDER_CHALLENGES_KEY);
      if (!stored) return new Set();
      const parsed = JSON.parse(stored);
      return new Set(Array.isArray(parsed) ? parsed : []);
    } catch {
      return new Set();
    }
  });
  const [nextResetAt, setNextResetAt] = useState(() => getNextResetBoundary(new Date()));
  const [mockLastSladeshAt, setMockLastSladeshAt] = useState(() => {
    if (!USE_MOCK_DATA) return null;
    try {
      if (typeof window === "undefined") return null;
      const stored = window.localStorage.getItem(MOCK_SLADESH_STORAGE_KEY);
      return stored ? new Date(stored) : null;
    } catch {
      return null;
    }
  });

  const activeChannelId = selectedChannel?.id || null;

  useEffect(() => {
    if (USE_MOCK_DATA) {
      setUserProfile({ lastSladeshSentAt: null });
      setProfileLoading(false);
      setProfileError(null);
      return;
    }
    if (!currentUser) {
      setUserProfile(null);
      setProfileLoading(false);
      setProfileError("Du skal være logget ind for at sende en Sladesh.");
      return;
    }

    let cancelled = false;
    setProfileLoading(true);
    setProfileError(null);

    getUser(currentUser.uid)
      .then((data) => {
        if (!cancelled) {
          setUserProfile(data);
        }
      })
      .catch((error) => {
        console.error("Failed to load user profile", error);
        if (!cancelled) {
          setProfileError("Kunne ikke indlæse din status.");
          setUserProfile(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setProfileLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  useEffect(() => {
    if (USE_MOCK_DATA) {
      const channelKey = resolveMockChannelKey(selectedChannel);
      const filteredParticipants = MOCK_PARTICIPANTS.filter((participant) =>
        isMemberOfMockChannel(participant.mockChannels, channelKey)
      );
      setMembers(filteredParticipants);
      setMembersLoading(false);
      setMembersError(null);
      return;
    }
    if (!currentUser) {
      setMembers([]);
      setMembersLoading(false);
      setMembersError("Log ind for at se kanalens medlemmer.");
      return;
    }
    if (!activeChannelId) {
      setMembers([]);
      setMembersLoading(true);
      setMembersError(null);
      return;
    }

    let cancelled = false;
    setMembersLoading(true);
    setMembersError(null);
    setMembers([]);

    // CHANNEL FILTERING: getCheckedInChannelMembers filters members by activeChannelId.
    // This function queries Firestore for users who are checked in and members of the active channel.
    // Only these filtered members can be selected as Sladesh targets.
    getCheckedInChannelMembers(activeChannelId)
      .then((list) => {
        if (cancelled) return;
        const filtered = list.filter((member) => member.id !== currentUser.uid);
        setMembers(filtered);
      })
      .catch((error) => {
        console.error("Failed to load channel members", error);
        if (!cancelled) {
          setMembers([]);
          setMembersError("Kunne ikke hente medlemmer.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setMembersLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeChannelId, currentUser, selectedChannel?.name, selectedChannel?.isDefault]);

  const eligibleTargets = useMemo(() => {
    if (USE_MOCK_DATA) {
      return MOCK_PARTICIPANTS;
    }
    return members.map((member) => ({
      id: member.id,
      name: member.name,
      username: member.username || member.name,
      initials: member.initials || deriveInitialsFromName(member.name),
      profileEmoji: member.profileEmoji || '🍹',
      profileGradient: member.profileGradient || member.avatarGradient || 'from-rose-400 to-orange-500',
      avatarGradient: member.avatarGradient || member.profileGradient,
    }));
  }, [members]);

  const orbitParticipants = useMemo(() => {
    const source = USE_MOCK_DATA ? MOCK_PARTICIPANTS : eligibleTargets;
    if (!source.length) {
      return [];
    }
    return source.map((participant, index) => ({
      id: participant.id,
      name: participant.name,
      username: participant.username || participant.name,
      initials: participant.initials,
      profileEmoji: participant.profileEmoji || '🍹',
      profileGradient: participant.profileGradient || participant.avatarGradient || participant.accent || "from-rose-400 to-orange-500",
      accent: participant.profileGradient || participant.avatarGradient || participant.accent || "from-slate-400 to-indigo-500",
      radius: 118 + (index % 4) * 6,
      duration: 24 + (index % 5) * 2,
    }));
  }, [eligibleTargets]);

  const participantsWithRandomAngles = useMemo(() => {
    return orbitParticipants.map((participant, index) => {
      const hashSource = participant.id || String(index);
      const hash = Array.from(hashSource).reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const deterministicAngle = (hash * 37) % 360;
      return {
        ...participant,
        angle: deterministicAngle,
      };
    });
  }, [orbitParticipants]);

  const cooldownState = useMemo(() => {
    if (USE_MOCK_DATA) {
      return getSladeshCooldownState({ lastSladeshSentAt: mockLastSladeshAt });
    }
    return getSladeshCooldownState(userProfile || {});
  }, [mockLastSladeshAt, userProfile]);

  useEffect(() => {
    if (!statusMessage) return;
    const timer = setTimeout(() => setStatusMessage(null), 5000);
    return () => clearTimeout(timer);
  }, [statusMessage]);

  useEffect(() => {
    const tick = () => setNextResetAt(getNextResetBoundary(new Date()));
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      window.localStorage.setItem(FINISHED_SENDER_CHALLENGES_KEY, JSON.stringify(Array.from(finishedSenderChallengeIds)));
    } catch {
      // ignore
    }
  }, [finishedSenderChallengeIds]);

  const latestSenderChallenge = useMemo(() => {
    if (!currentUser) return null;
    const latest = [...challenges]
      .filter((c) => c.senderId === currentUser.uid)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return latest[0] || null;
  }, [challenges, currentUser]);

  const senderChallengeInCurrentBlock = useMemo(() => {
    if (!latestSenderChallenge) return null;
    const createdAtMs = latestSenderChallenge.createdAt || 0;
    const blockStart = getLatestResetBoundary(new Date()).getTime();
    if (!createdAtMs) return latestSenderChallenge;
    return createdAtMs >= blockStart ? latestSenderChallenge : null;
  }, [latestSenderChallenge]);

  useEffect(() => {
    if (!senderChallengeInCurrentBlock) return;
    if (senderChallengeInCurrentBlock.status === SLADESH_STATUS.IN_PROGRESS) return;
    setFinishedSenderChallengeIds((prev) => {
      if (prev.has(senderChallengeInCurrentBlock.id)) return prev;
      const next = new Set(prev);
      next.add(senderChallengeInCurrentBlock.id);
      return next;
    });
  }, [senderChallengeInCurrentBlock]);

  const senderLockChallenge = useMemo(() => {
    if (!senderChallengeInCurrentBlock) return null;
    const isFinished = finishedSenderChallengeIds.has(senderChallengeInCurrentBlock.id);
    if (isFinished) return null;
    if (senderChallengeInCurrentBlock.status === SLADESH_STATUS.IN_PROGRESS) {
      return senderChallengeInCurrentBlock;
    }
    return null;
  }, [finishedSenderChallengeIds, senderChallengeInCurrentBlock]);

  useEffect(() => {
    if (!senderLockChallenge) {
      setSenderTimeLeft(null);
      return undefined;
    }

    const calculate = () => {
      if (!senderLockChallenge.deadlineAt) {
        setSenderTimeLeft(null);
        return;
      }
      setSenderTimeLeft(Math.max(0, senderLockChallenge.deadlineAt - Date.now()));
    };

    calculate();
    const interval = setInterval(calculate, 1000);
    return () => clearInterval(interval);
  }, [senderLockChallenge]);

  const hasTargets = eligibleTargets.length > 0;
  const cooldownBlocked = !USE_MOCK_DATA && cooldownState.blocked;
  const cooldownReadyAt = cooldownState.blockEndsAt
    ? TIME_FORMATTER.format(cooldownState.blockEndsAt)
    : null;

  const lockedRecipientProfile = useMemo(() => {
    if (!senderLockChallenge) return null;
    const match = eligibleTargets.find((member) => member.id === senderLockChallenge.receiverId);
    if (match) return match;

    const name = senderLockChallenge.receiverName || senderLockChallenge.receiverId;
    return {
      id: senderLockChallenge.receiverId,
      name,
      username: name,
      initials: deriveInitialsFromName(name),
      profileEmoji: null,
      profileGradient: "from-rose-400 to-orange-500",
    };
  }, [senderLockChallenge, eligibleTargets]);

  const cannotInitiateReason = useMemo(() => {
    if (senderLockChallenge && senderLockChallenge.status === SLADESH_STATUS.IN_PROGRESS) {
      const displayName =
        lockedRecipientProfile?.username ||
        lockedRecipientProfile?.name ||
        senderLockChallenge.receiverName ||
        "din modtager";
      return `Du har allerede sendt en Sladesh til ${displayName}. Vent til den er afsluttet.`;
    }
    if (!hasTargets) {
      return "Ingen medlemmer er checket ind i denne kanal endnu.";
    }
    if (!USE_MOCK_DATA && profileLoading) {
      return "Vent et øjeblik, vi henter din status.";
    }
    if (!USE_MOCK_DATA && profileError) {
      return profileError;
    }
    if (!USE_MOCK_DATA && cooldownBlocked) {
      return cooldownReadyAt
        ? `Du kan sende igen kl. ${cooldownReadyAt}.`
        : "Du kan sende igen senere.";
    }
    return null;
  }, [cooldownBlocked, cooldownReadyAt, hasTargets, profileError, profileLoading, lockedRecipientProfile?.name, lockedRecipientProfile?.username, senderLockChallenge]);

  const guardAndSetTarget = useCallback(
    (target) => {
      if (membersLoading || isSending) return;
      if (cannotInitiateReason) {
        setStatusMessage({ tone: "info", body: cannotInitiateReason });
        return;
      }
      setPendingTarget(target);
    },
    [cannotInitiateReason, isSending, membersLoading]
  );

  const handleRandomSladesh = useCallback(() => {
    if (!eligibleTargets.length) {
      setStatusMessage({ tone: "info", body: "Ingen medlemmer er checket ind i denne kanal endnu." });
      return;
    }
    const randomIndex = Math.floor(Math.random() * eligibleTargets.length);
    guardAndSetTarget(eligibleTargets[randomIndex]);
  }, [eligibleTargets, guardAndSetTarget]);

  const handleConfirmSladesh = useCallback(async () => {
    if (!pendingTarget) return;

    if (USE_MOCK_DATA) {
      const now = new Date();
      setMockLastSladeshAt(now);
      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(MOCK_SLADESH_STORAGE_KEY, now.toISOString());
        }
      } catch {
        // ignore
      }
      setStatusMessage({ tone: "success", body: `Mock: Sladesh sendt til ${pendingTarget.username || pendingTarget.name}.` });
      setPendingTarget(null);
      return;
    }

    if (!currentUser) {
      setStatusMessage({ tone: "error", body: "Du skal være logget ind for at sende en Sladesh." });
      return;
    }

    setIsSending(true);

    const target = pendingTarget;
    const senderName = userProfile?.fullName || currentUser.displayName || currentUser.email || currentUser.uid;
    const recipientName = target.name || target.username || target.id;
    const optimisticCreatedAt = Date.now();
    const optimisticDeadlineAt = optimisticCreatedAt + 10 * 60 * 1000;
    const optimisticChallenge = sendSladesh(
      { id: currentUser.uid, name: senderName },
      { id: target.id, name: recipientName },
      {
        challengeId: crypto.randomUUID(),
        createdAt: optimisticCreatedAt,
        deadlineAt: optimisticDeadlineAt,
      }
    );

    setPendingTarget(null);
    setStatusMessage({ tone: "success", body: `Sladesh sendt til ${recipientName}.` });

    try {
      updateLocation();

      const resolvedLocation =
        userLocation ||
        userProfile?.currentLocation || {
          lat: DEFAULT_LOCATION.lat,
          lng: DEFAULT_LOCATION.lng,
        };

      const venue =
        userProfile?.lastCheckInVenue ||
        userProfile?.currentLocation?.venue ||
        selectedChannel?.name ||
        "Ukendt sted";

      // CHANNEL FILTERING: The sladesh includes channelId to associate it with the active channel.
      // This ensures the sladesh is linked to the channel context in which it was sent.
      await addSladesh(currentUser.uid, {
        type: "sent",
        recipientId: target.id,
        senderName,
        recipientName,
        venue,
        location: {
          lat: resolvedLocation.lat ?? DEFAULT_LOCATION.lat,
          lng: resolvedLocation.lng ?? DEFAULT_LOCATION.lng,
        },
        channelId: selectedChannel?.id || null,
        challengeId: optimisticChallenge.id,
        deadlineAtMs: optimisticDeadlineAt,
      });

      // Save location to Firestore so user appears on map
      try {
        await updateUserLocation(currentUser.uid, {
          lat: resolvedLocation.lat ?? DEFAULT_LOCATION.lat,
          lng: resolvedLocation.lng ?? DEFAULT_LOCATION.lng,
          venue,
        });
      } catch (locationError) {
        console.error("Error saving location after sladesh:", locationError);
        // Don't fail sladesh send if location save fails
      }

      await incrementSladeshCount();
      setUserProfile((prev) =>
        prev
          ? {
            ...prev,
            lastSladeshSentAt: new Date(),
          }
          : {
            lastSladeshSentAt: new Date(),
          }
      );

      console.log('[Sladesh] Successfully sent Sladesh', {
        recipient: recipientName,
        recipientId: target.id,
        venue
      });

    } catch (error) {
      console.error("Error sending sladesh:", error);
      removeChallenge(optimisticChallenge?.id);
      setStatusMessage({ tone: "error", body: "Kunne ikke sende Sladesh. Prøv igen." });
    } finally {
      setIsSending(false);
    }
  }, [
    currentUser,
    pendingTarget,
    removeChallenge,
    selectedChannel,
    sendSladesh,
    updateLocation,
    userLocation,
    userProfile,
  ]);

  const handleCloseOverlay = useCallback(() => {
    if (isSending) return;
    setPendingTarget(null);
  }, [isSending]);

  return (
    <Page title="Sladesh">
      <ComingSoonOverlay />
      {senderLockChallenge ? (
        <SenderLockOverlay
          recipient={lockedRecipientProfile}
          fallbackName={senderLockChallenge.receiverName || senderLockChallenge.receiverId}
          timeLeftMs={senderTimeLeft}
          status={senderLockChallenge.status}
          nextResetAt={nextResetAt}
          onUnlock={() => {
            if (senderLockChallenge.status !== SLADESH_STATUS.IN_PROGRESS) {
              setFinishedSenderChallengeIds((prev) => {
                const next = new Set(prev);
                next.add(senderLockChallenge.id);
                return next;
              });
            }
          }}
        />
      ) : null}
      <div className="flex flex-1 flex-col items-center justify-center gap-8 pb-8 pt-4">
        <div className="relative w-full max-w-full">
          <div className="aspect-square">
            <OrbitBackdrop />
            <OrbitCenterButton
              disabled={!!cannotInitiateReason || membersLoading || isSending}
              onPress={handleRandomSladesh}
            />
            {participantsWithRandomAngles.map((participant) => (
              <OrbitAvatar
                key={participant.id}
                participant={participant}
                disabled={!!cannotInitiateReason || membersLoading || isSending}
                onSelect={() => guardAndSetTarget(participant)}
              />
            ))}
          </div>
        </div>

        <Card
          className="w-full max-w-full p-5 text-center backdrop-blur-sm"
          style={{
            borderColor: "color-mix(in srgb, var(--line) 70%, transparent)",
            backgroundColor: "color-mix(in srgb, var(--surface) 70%, transparent)",
          }}
        >
          {cooldownBlocked ? (
            <>
              <h2
                className="text-base font-semibold"
                style={{ color: "var(--brand)" }}
              >
                Sladesh pauset
              </h2>
              <p
                className="mt-2 text-sm leading-relaxed"
                style={{
                  color: "var(--ink)",
                  backgroundColor: "color-mix(in srgb, var(--brand) 12%, transparent)",
                  borderRadius: "16px",
                  padding: "12px 16px",
                }}
              >
                Du har opbrugt din Sladesh. Den bliver resat om{" "}
                <strong>{formatDurationUntilReset(cooldownState.blockEndsAt)}</strong>.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-base font-semibold" style={{ color: "var(--ink)" }}>
                Sladesh orbit
              </h2>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
                Tryk på en deltager for at sende direkte, eller ram 🤙 i midten for en tilfældig fra{" "}
                {selectedChannel?.name || "kanalen"}.
              </p>
            </>
          )}

          {membersError ? (
            <p className="mt-4 text-sm font-semibold text-[color:var(--brand,#FF385C)]">{membersError}</p>
          ) : null}

          {!USE_MOCK_DATA && profileError ? (
            <p className="mt-4 text-sm font-semibold text-[color:var(--brand,#FF385C)]">{profileError}</p>
          ) : null}

          {cooldownBlocked && cooldownReadyAt ? (
            <div
              className="mt-4 rounded-2xl border px-4 py-3 text-sm"
              style={{
                borderColor: "color-mix(in srgb, var(--brand) 40%, transparent)",
                color: "var(--muted)",
              }}
            >
              Du har allerede sendt en Sladesh i denne 12-timers blok. Prøv igen kl. {cooldownReadyAt}.
            </div>
          ) : null}

          {!membersLoading && !hasTargets ? (
            <div
              className="mt-4 rounded-2xl border px-4 py-3 text-sm"
              style={{
                borderColor: "var(--line)",
                color: "var(--muted)",
              }}
            >
              Ingen andre er checket ind endnu. Når nogen dukker op, vælger vi én for dig.
            </div>
          ) : null}

          {statusMessage ? (
            <p
              className="mt-4 text-sm"
              style={{
                color:
                  statusMessage.tone === "error"
                    ? "var(--brand)"
                    : statusMessage.tone === "success"
                      ? "var(--ink)"
                      : "var(--muted)",
              }}
            >
              {statusMessage.body}
            </p>
          ) : null}
        </Card>
      </div>

      {pendingTarget ? (
        <RequestOverlay
          participant={pendingTarget}
          onClose={handleCloseOverlay}
          onConfirm={handleConfirmSladesh}
          loading={isSending}
        />
      ) : null}
    </Page>
  );
}

function SenderLockOverlay({ recipient, fallbackName, timeLeftMs, status, nextResetAt, onUnlock }) {
  const { isDarkMode } = useTheme();
  const displayName = recipient?.username || recipient?.name || fallbackName || "modtageren";
  const [resetRemaining, setResetRemaining] = useState(() =>
    nextResetAt ? Math.max(0, nextResetAt.getTime() - Date.now()) : 0
  );
  const participant = {
    ...recipient,
    initials: recipient?.initials || deriveInitialsFromName(displayName),
    profileGradient: recipient?.profileGradient || recipient?.avatarGradient || recipient?.accent || "from-rose-400 to-orange-500",
  };
  const derivedStatus =
    status === SLADESH_STATUS.COMPLETED
      ? SLADESH_STATUS.COMPLETED
      : status === SLADESH_STATUS.FAILED || (timeLeftMs !== null && timeLeftMs <= 0)
        ? SLADESH_STATUS.FAILED
        : SLADESH_STATUS.IN_PROGRESS;
  const countdown = derivedStatus === SLADESH_STATUS.IN_PROGRESS ? formatCountdown(timeLeftMs) : "00:00";
  const resetCountdown = formatResetCountdown(resetRemaining);
  const resetClock = nextResetAt ? TIME_FORMATTER.format(nextResetAt) : "--:--";
  const heading =
    derivedStatus === SLADESH_STATUS.COMPLETED
      ? `${displayName} fuldførte`
      : derivedStatus === SLADESH_STATUS.FAILED
        ? `${displayName} fejlede`
        : `Venter på ${displayName}`;
  const statusCopy =
    derivedStatus === SLADESH_STATUS.COMPLETED
      ? "Completed"
      : derivedStatus === SLADESH_STATUS.FAILED
        ? "Failed"
        : "Udfordring i gang";
  const canUnlock = derivedStatus !== SLADESH_STATUS.IN_PROGRESS && typeof onUnlock === "function";

  useEffect(() => {
    if (!nextResetAt) {
      setResetRemaining(0);
      return undefined;
    }
    const tick = () => {
      setResetRemaining(Math.max(0, nextResetAt.getTime() - Date.now()));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [nextResetAt]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center px-6 py-8"
      style={{ backgroundColor: isDarkMode ? "rgba(6, 10, 24, 0.78)" : "rgba(11, 17, 32, 0.68)" }}
    >
      <div
        className="w-full max-w-sm rounded-[28px] p-6 text-center shadow-[0_24px_60px_rgba(15,23,42,0.25)]"
        style={{ backgroundColor: "var(--surface)" }}
      >
        <div className="mb-4 flex flex-col items-center gap-3">
          <div className="text-3xl" aria-hidden="true">🚀</div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>
            Sladesh afsendt
          </p>
          <h3 className="text-xl font-bold" style={{ color: "var(--ink)" }}>
            {heading}
          </h3>
          <p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
            {derivedStatus === SLADESH_STATUS.IN_PROGRESS
              ? "Vi låser, indtil modtagerens vindue er slut. Timeren matcher deres nedtælling."
              : "Resultatet er landet. Du kan planlægge næste Sladesh efter reset-tidspunktet."}
          </p>
        </div>

        <div className="flex flex-col items-center gap-4">
          <OverlayAvatar participant={participant} />
          <div className="flex flex-col w-full items-center gap-3">
            <div
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide"
              style={{
                backgroundColor: "color-mix(in srgb, var(--subtle) 70%, transparent)",
                color:
                  derivedStatus === SLADESH_STATUS.COMPLETED
                    ? "var(--emerald, #10b981)"
                    : derivedStatus === SLADESH_STATUS.FAILED
                      ? "var(--brand)"
                      : "var(--ink)",
                border: "1px solid color-mix(in srgb, var(--line) 70%, transparent)",
              }}
            >
              <span className="text-xs">{statusCopy}</span>
            </div>
            <div
              className="flex w-full items-center justify-between rounded-2xl border px-4 py-3 font-mono text-lg font-semibold"
              style={{
                borderColor: "color-mix(in srgb, var(--line) 80%, transparent)",
                backgroundColor: "color-mix(in srgb, var(--surface) 80%, transparent)",
                color: "var(--ink)",
              }}
            >
              <div className="flex flex-col items-start">
                <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                  Udfordringsur
                </span>
                <span>{countdown}</span>
              </div>
              <span className="text-xs" style={{ color: "var(--muted)" }}>
                Synk. med modtager
              </span>
            </div>
            <div
              className="w-full rounded-2xl border px-4 py-3 text-left"
              style={{
                borderColor: "var(--line)",
                backgroundColor: "var(--subtle)",
                color: "var(--muted)",
              }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide">Du får en ny Sladesh om:</p>
              {resetCountdown ? (
                <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                  {resetCountdown}
                </p>
              ) : null}
            </div>
          </div>
        </div>


      </div>
    </div>
  );
}

function OrbitBackdrop() {
  // Enhanced brand color intensity for dark mode
  const { isDarkMode } = useTheme();

  const brandOpacity1 = isDarkMode ? 0.65 : 0.28;
  const brandOpacity2 = isDarkMode ? 0.55 : 0.24;
  const brandOpacity3 = isDarkMode ? 0.45 : 0.18;
  const surfaceOpacity = isDarkMode ? 0.3 : 0.85;

  const ringStyle = {
    background:
      `conic-gradient(from -90deg, rgba(var(--brand-rgb) / ${brandOpacity1}) 0deg, rgba(var(--brand-rgb) / ${brandOpacity2}) 150deg, color-mix(in srgb, var(--surface) ${surfaceOpacity}%, transparent) 240deg, rgba(var(--brand-rgb) / ${brandOpacity3}) 330deg, rgba(var(--brand-rgb) / ${brandOpacity1}) 360deg)`,
    mask: "radial-gradient(farthest-side, transparent calc(100% - 8px), #000 calc(100% - 4px))",
    WebkitMask:
      "radial-gradient(farthest-side, transparent calc(100% - 8px), #000 calc(100% - 4px))",
    filter: isDarkMode ? 'drop-shadow(0 0 20px rgba(var(--brand-rgb) / 0.4)) drop-shadow(0 0 40px rgba(var(--brand-rgb) / 0.2))' : 'none',
  };

  return (
    <>
      {/* Outer glow layer for dark mode */}
      {isDarkMode && (
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 h-[340px] w-[340px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background: `radial-gradient(circle, rgba(var(--brand-rgb) / 0.15) 0%, transparent 70%)`,
            filter: 'blur(20px)',
          }}
        />
      )}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[320px] w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-full shadow-[0_40px_80px_rgba(15,23,42,0.12)]"
        style={{ backgroundColor: 'color-mix(in srgb, var(--surface) 80%, transparent)' }}
      />
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[320px] w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={ringStyle}
      />
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[180px] w-[180px] -translate-x-1/2 -translate-y-1/2 rounded-full border backdrop-blur-sm"
        style={{
          borderColor: 'color-mix(in srgb, var(--surface) 60%, transparent)',
          backgroundColor: 'color-mix(in srgb, var(--surface) 40%, transparent)',
          ...(isDarkMode ? {
            boxShadow: `0 0 30px rgba(var(--brand-rgb) / 0.3), inset 0 0 20px rgba(var(--brand-rgb) / 0.1)`
          } : {})
        }}
      />
    </>
  );
}

function OrbitAvatar({ participant, disabled, onSelect }) {
  const size = "h-16 w-16";
  const textSize = "text-lg";
  const duration = participant.duration ?? 28;

  return (
    <div
      className="orbit-item"
      style={{
        "--angle": `${participant.angle}deg`,
        "--angle-negative": `${-participant.angle}deg`,
        "--radius": `${participant.radius}px`,
        "--duration": `${duration}s`,
      }}
    >
      <div className="orbit-item__spin">
        <button
          type="button"
          disabled={disabled}
          onClick={onSelect}
          className="orbit-item__payload focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 disabled:opacity-60"
        >
          <AvatarBadge participant={participant} size={size} textSize={textSize} />
          <span className="text-xs font-medium drop-shadow-sm" style={{ color: "var(--ink)" }}>
            {participant.username || participant.name}
          </span>
        </button>
      </div>
    </div>
  );
}

function AvatarBadge({ participant, size = "h-16 w-16", textSize = "text-lg" }) {
  const gradient = participant.profileGradient || participant.accent || "from-rose-400 to-orange-500";
  const emoji = participant.profileEmoji;

  // Use emoji if available, otherwise fall back to initials
  if (emoji) {
    return (
      <div
        className={`grid place-items-center rounded-full ${size} bg-gradient-to-br ${gradient} shadow-[0_18px_40px_rgba(15,23,42,0.18)]`}
      >
        <span className="text-2xl">{emoji}</span>
      </div>
    );
  }

  // Fallback to initials
  return (
    <div
      className={`grid place-items-center rounded-full ${size} bg-gradient-to-br ${gradient} font-semibold text-white shadow-[0_18px_40px_rgba(15,23,42,0.18)]`}
    >
      <span className={textSize}>{participant.initials || "??"}</span>
    </div>
  );
}

function RequestOverlay({ participant, onClose, onConfirm, loading }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-6 py-8 backdrop-blur-sm"
      style={{ backgroundColor: "rgba(11, 17, 32, 0.6)" }}
    >
      <div
        className="w-full max-w-[calc(100%-48px)] sm:max-w-[360px] rounded-[28px] p-6 shadow-[0_24px_60px_rgba(15,23,42,0.25)]"
        style={{ backgroundColor: "var(--surface)" }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <OverlayAvatar participant={participant} />
            <div>
              <h3 className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                Send Sladesh til {participant.username || participant.name}?
              </h3>
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                Vi giver dem besked med det samme. Klar på at sende udfordringen afsted?
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <div
            className="rounded-2xl border px-4 py-3 text-xs leading-relaxed"
            style={{
              borderColor: "var(--line)",
              backgroundColor: "var(--subtle)",
              color: "var(--muted)",
            }}
          >
            <span className="font-semibold" style={{ color: "var(--ink)" }}>
              Bekræft:
            </span>{" "}
            Dine venner får et ping, og du kan først sende igen i næste blok.
          </div>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            “Er du sikker?” – bare for en sikkerheds skyld. Du sender kun én Sladesh ad gangen.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex flex-1 min-w-[140px] items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold shadow-soft transition active:translate-y-[1px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 disabled:opacity-60"
            style={{
              backgroundColor: "var(--brand)",
              color: "var(--brand-ink)",
            }}
          >
            {loading ? "Sender..." : "Bekræft"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="inline-flex items-center justify-center rounded-2xl border px-4 py-3 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--line)] focus-visible:ring-offset-2 disabled:opacity-60"
            style={{
              borderColor: "var(--line)",
              color: "var(--ink)",
            }}
          >
            Luk
          </button>
        </div>
      </div>
    </div>
  );
}

function OverlayAvatar({ participant }) {
  const gradient = participant.profileGradient || participant.avatarGradient || participant.accent || "from-rose-400 to-orange-500";
  const emoji = participant.profileEmoji;

  // Use emoji if available, otherwise fall back to initials
  if (emoji) {
    return (
      <div
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${gradient} text-xl shadow-[0_16px_30px_rgba(15,23,42,0.12)] overflow-hidden aspect-square`}
      >
        {emoji}
      </div>
    );
  }

  // Fallback to initials
  return (
    <div
      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${gradient} text-sm font-semibold uppercase text-white shadow-[0_16px_30px_rgba(15,23,42,0.12)] overflow-hidden aspect-square`}
    >
      {participant.initials || "??"}
    </div>
  );
}

function OrbitCenterButton({ disabled, onPress }) {
  const { isDarkMode } = useTheme();
  const [pulseDelay, setPulseDelay] = useState(() => Math.random() * 2);
  const [pulseDuration, setPulseDuration] = useState(() => 2 + Math.random() * 1.5);

  // Randomize pulse timing periodically to make it feel more alive
  useEffect(() => {
    const interval = setInterval(() => {
      setPulseDelay(Math.random() * 2);
      setPulseDuration(2 + Math.random() * 1.5);
    }, 10000 + Math.random() * 5000); // Change every 10-15 seconds

    return () => clearInterval(interval);
  }, []);

  // Theme-aware styling for circle visibility
  const circleStyle = isDarkMode
    ? {
      borderColor: "color-mix(in srgb, var(--line) 60%, transparent)",
      backgroundColor: "color-mix(in srgb, var(--surface) 45%, transparent)",
    }
    : {
      borderColor: "var(--line)",
      backgroundColor: "color-mix(in srgb, var(--line) 30%, transparent)",
    };

  return (
    <>
      <style>{`
        @keyframes pulse-shadow {
          0%, 100% {
            box-shadow: 0 18px 40px rgba(15,23,42,0.18), 0 0 0 0 rgba(var(--brand-rgb), 0.5);
          }
          50% {
            box-shadow: 0 18px 40px rgba(15,23,42,0.18), 0 0 50px 20px rgba(var(--brand-rgb), 0.9);
          }
        }
        .pulse-shadow-animation {
          animation: pulse-shadow ${pulseDuration}s ease-in-out infinite;
          animation-delay: ${pulseDelay}s;
        }
      `}</style>
      <button
        type="button"
        disabled={disabled}
        onClick={onPress}
        className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 disabled:opacity-60"
        aria-label="Send tilfældig Sladesh"
      >
        <div
          className="grid h-28 w-28 place-items-center rounded-full border pulse-shadow-animation"
          style={circleStyle}
        >
          <span className="text-4xl leading-none" aria-hidden="true">
            🤙
          </span>
        </div>
        <span className="sr-only">Tilfældig Sladesh</span>
      </button>
    </>
  );
}

function deriveInitialsFromName(name = "") {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  if (!parts.length) return "";
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

function formatCountdown(ms) {
  if (ms === null || ms === undefined) return "--:--";
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatResetCountdown(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value) => value.toString().padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function ComingSoonOverlay() {
  const { isDarkMode } = useTheme();
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-6 py-8 backdrop-blur-sm"
      style={{ backgroundColor: isDarkMode ? "rgba(6, 10, 24, 0.85)" : "rgba(11, 17, 32, 0.75)" }}
    >
      <div
        className="w-full max-w-sm rounded-[28px] p-8 text-center shadow-[0_24px_60px_rgba(15,23,42,0.25)]"
        style={{ backgroundColor: "var(--surface)" }}
      >
        <h2 className="text-xl font-bold mb-2" style={{ color: "var(--ink)" }}>
          Coming soon...
        </h2>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Vi arbejder på højtryk for at gøre Sladesh klar til dig!
        </p>
      </div>
    </div>
  );
}
