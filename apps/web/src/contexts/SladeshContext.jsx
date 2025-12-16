import { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { collection, doc, getDoc, onSnapshot, query, updateDoc, where, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { db } from '../firebase';
import { getLatestResetBoundary, getNextResetBoundary, clearActiveSladeshLock, incrementSladeshStats } from '../services/userService';
import { IS_DEVELOPMENT } from '../config/env';

const SladeshContext = createContext(null);

export const SLADESH_STATUS = {
    IN_PROGRESS: 'IN_PROGRESS',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
    EXPIRED: 'EXPIRED',
};

const STORAGE_KEY = 'sladesh_challenges';
const WHEEL_USED_KEY = 'sladesh_wheel_used_at';

export function SladeshProvider({ children }) {
    const { currentUser } = useAuth();
    const userNameCacheRef = useRef({});
    const clearedLocksRef = useRef(new Set());

    // Load challenges from localStorage
    const [challenges, setChallenges] = useState(() => {
        try {
            const stored = window.localStorage.getItem(STORAGE_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            console.error('Failed to load sladesh challenges', e);
            return [];
        }
    });

    // Track when wheel was last used (per 12h block)
    const [wheelUsedAt, setWheelUsedAt] = useState(() => {
        try {
            const stored = window.localStorage.getItem(WHEEL_USED_KEY);
            return stored ? new Date(stored) : null;
        } catch (e) {
            console.error('Failed to load wheel usage', e);
            return null;
        }
    });

    const [currentResetBoundary, setCurrentResetBoundary] = useState(() => getLatestResetBoundary());

    // Keep a live marker for the current 12h block so UI can reset badges at 00:00/12:00 without refresh
    useEffect(() => {
        let timeoutId;

        const syncBoundary = () => {
            const latest = getLatestResetBoundary(new Date());
            setCurrentResetBoundary((prev) => (prev?.getTime?.() === latest.getTime() ? prev : latest));
        };

        const scheduleNextTick = () => {
            const now = new Date();
            const nextBoundary = getNextResetBoundary(now);
            const delay = Math.max(nextBoundary.getTime() - now.getTime(), 500);

            timeoutId = window.setTimeout(() => {
                syncBoundary();
                scheduleNextTick();
            }, delay);
        };

        syncBoundary();
        scheduleNextTick();

        return () => {
            if (timeoutId) {
                window.clearTimeout(timeoutId);
            }
        };
    }, []);

    // Persist challenges to localStorage
    useEffect(() => {
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(challenges));
        } catch (e) {
            console.error('Failed to save sladesh challenges', e);
        }
    }, [challenges, currentUser]);

    // Persist wheel usage to localStorage
    useEffect(() => {
        try {
            if (wheelUsedAt) {
                window.localStorage.setItem(WHEEL_USED_KEY, wheelUsedAt.toISOString());
            } else {
                window.localStorage.removeItem(WHEEL_USED_KEY);
            }
        } catch (e) {
            console.error('Failed to save wheel usage', e);
        }
    }, [wheelUsedAt]);

    // Find active challenge for current user (as receiver)
    // Lock screen will stay visible until challenge status changes to COMPLETED or FAILED
    const activeChallenge = useMemo(() => {
        if (!currentUser) return null;
        return challenges.find(
            (c) => c.receiverId === currentUser.uid && c.status === SLADESH_STATUS.IN_PROGRESS
        ) || null;
    }, [challenges, currentUser]);

    // Find active challenge the current user has sent (to lock sender UI)
    const activeSenderChallenge = useMemo(() => {
        if (!currentUser) return null;
        return challenges.find(
            (c) => c.senderId === currentUser.uid && c.status === SLADESH_STATUS.IN_PROGRESS
        );
    }, [challenges, currentUser]);

    // No longer need to track "seen" challenges - the challenge status itself determines visibility

    const resolveUserName = useCallback(async (userId, fallback = 'Ukendt') => {
        if (!userId) return fallback;
        if (userNameCacheRef.current[userId]) {
            return userNameCacheRef.current[userId];
        }

        try {
            const userSnap = await getDoc(doc(db, 'users', userId));
            if (userSnap.exists()) {
                const data = userSnap.data() || {};
                const resolvedName = data.fullName || data.displayName || data.username || fallback || userId;
                userNameCacheRef.current[userId] = resolvedName;
                return resolvedName;
            }
        } catch (err) {
            console.error(`[sladesh] Failed to fetch user ${userId} for name resolution`, err);
        }

        const resolvedName = fallback || userId;
        userNameCacheRef.current[userId] = resolvedName;
        return resolvedName;
    }, []);

    const hydrateChallenge = useCallback(async (docSnap) => {
        const data = docSnap.data();
        const createdAtMs = data.createdAt?.toMillis
            ? data.createdAt.toMillis()
            : data.createdAt?.seconds
                ? data.createdAt.seconds * 1000
                : null;
        const deadlineAtMs = data.deadlineAt?.toMillis
            ? data.deadlineAt.toMillis()
            : data.deadlineAt?.seconds
                ? data.deadlineAt.seconds * 1000
                : (createdAtMs ? createdAtMs + 10 * 60 * 1000 : null);
        const statusRaw = (data.status || 'pending').toString().toLowerCase();
        const status =
            statusRaw === 'failed'
                ? SLADESH_STATUS.FAILED
                : statusRaw === 'completed'
                    ? SLADESH_STATUS.COMPLETED
                    : statusRaw === 'expired'
                        ? SLADESH_STATUS.EXPIRED
                        : SLADESH_STATUS.IN_PROGRESS; // treat pending/in_progress as active

        if (statusRaw === 'pending') {
            updateDoc(doc(db, 'sladeshChallenges', docSnap.id), {
                status: 'in_progress',
                updatedAt: serverTimestamp(),
            }).catch((err) => console.error('[sladesh] Failed to mark challenge in progress', err));
        }

        const fallbackSenderName = data.senderName || data.senderId || 'Ukendt';
        const fallbackReceiverName = data.receiverName || data.recipientName || data.recipientId || 'Ukendt';

        const resolvedSenderName =
            (!data.senderName || data.senderName === data.senderId)
                ? await resolveUserName(data.senderId, fallbackSenderName)
                : data.senderName;
        const resolvedReceiverName =
            (!data.receiverName && !data.recipientName) || fallbackReceiverName === data.recipientId
                ? await resolveUserName(data.recipientId, fallbackReceiverName)
                : fallbackReceiverName;

        return {
            id: docSnap.id,
            senderId: data.senderId,
            senderName: resolvedSenderName,
            receiverId: data.recipientId,
            receiverName: resolvedReceiverName,
            status,
            createdAt: createdAtMs,
            deadlineAt: deadlineAtMs,
            proofBeforeImage: data.proofBeforeImage || null,
            proofAfterImage: data.proofAfterImage || null,
            scannerStep: data.scannerStep || null,
            scannerLastUpdated: data.scannerLastUpdated || null,
            // Phase-based state for cross-platform reliability
            phase: data.phase || null,
            filledCapturedAt: data.filledCapturedAt || null,
            emptyCapturedAt: data.emptyCapturedAt || null,
        };
    }, [resolveUserName]);

    // Subscribe to challenges for the current user (both sent and received)
    useEffect(() => {
        if (!currentUser?.uid) {
            setChallenges([]);
            return undefined;
        }

        const challengesRef = collection(db, 'sladeshChallenges');
        const incomingQuery = query(
            challengesRef,
            where('recipientId', '==', currentUser.uid)
        );
        const outgoingQuery = query(
            challengesRef,
            where('senderId', '==', currentUser.uid)
        );

        let isCancelled = false;
        let incomingChallenges = [];
        let outgoingChallenges = [];

        const mergeAndSet = () => {
            if (isCancelled) return;
            const mergedMap = new Map();
            [...incomingChallenges, ...outgoingChallenges].forEach((challenge) => {
                mergedMap.set(challenge.id, challenge);
            });
            const merged = Array.from(mergedMap.values()).sort(
                (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
            );
            setChallenges(merged);
        };

        const handleSnapshot = (type) => (snapshot) => {
            const hydrateAndStore = async () => {
                const hydrated = await Promise.all(snapshot.docs.map(hydrateChallenge));
                if (isCancelled) return;
                if (type === 'incoming') {
                    incomingChallenges = hydrated;
                } else {
                    outgoingChallenges = hydrated;
                }
                mergeAndSet();
            };
            hydrateAndStore();
        };

        const unsubscribeIncoming = onSnapshot(incomingQuery, handleSnapshot('incoming'));
        const unsubscribeOutgoing = onSnapshot(outgoingQuery, handleSnapshot('outgoing'));

        return () => {
            isCancelled = true;
            unsubscribeIncoming();
            unsubscribeOutgoing();
        };
    }, [currentUser, hydrateChallenge]);

    const syncChallengeUpdate = useCallback((challengeId, updates) => {
        return updateDoc(doc(db, 'sladeshChallenges', challengeId), {
            ...updates,
            updatedAt: serverTimestamp(),
        }).catch((err) => {
            console.error('[sladesh] Failed to sync challenge update', err);
        });
    }, []);

    // Check if app should be locked
    const isLocked = !!activeChallenge;
    const isSenderLocked = !!activeSenderChallenge;

    // Create a new Sladesh challenge
    const sendSladesh = useCallback((sender, receiver, options = {}) => {
        const now = Date.now();
        const newChallenge = {
            id: options.challengeId || crypto.randomUUID(),
            senderId: sender.id,
            senderName: sender.name || sender.username,
            receiverId: receiver.id,
            receiverName: receiver.name || receiver.username,
            status: options.status || SLADESH_STATUS.IN_PROGRESS,
            createdAt: options.createdAt ?? now,
            deadlineAt: options.deadlineAt ?? now + 10 * 60 * 1000, // 10 minutes from now
            proofBeforeImage: null,
            proofAfterImage: null,
        };

        setChallenges((prev) => {
            const next = [...prev.filter((c) => c.id !== newChallenge.id), newChallenge];
            return next.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        });
        return newChallenge;
    }, []);

    const removeChallenge = useCallback((challengeId) => {
        if (!challengeId) return;
        setChallenges((prev) => prev.filter((c) => c.id !== challengeId));
    }, []);

    // Update an existing challenge
    const updateChallenge = useCallback((challengeId, updates) => {
        setChallenges((prev) =>
            prev.map((c) => (c.id === challengeId ? { ...c, ...updates } : c))
        );
        return syncChallengeUpdate(challengeId, updates);
    }, [syncChallengeUpdate]);

    // Single-active-Sladhesh guard: release the receiver lock when a challenge ends
    const releaseReceiverLock = useCallback(async (challengeId, statusLabel = 'resolved') => {
        const challenge = challenges.find((c) => c.id === challengeId);
        const receiverId = challenge?.receiverId;
        if (!receiverId) return;

        try {
            clearedLocksRef.current.add(challengeId);
            await clearActiveSladeshLock(receiverId, challengeId);
        } catch (err) {
            console.error(`[sladesh] Failed to clear active sladesh lock (${statusLabel})`, err);
        }
    }, [challenges, clearActiveSladeshLock]);

    // Mark challenge as failed
    const failChallenge = useCallback(async (challengeId) => {
        const challenge = challenges.find((c) => c.id === challengeId);
        await updateChallenge(challengeId, { status: SLADESH_STATUS.FAILED });
        await releaseReceiverLock(challengeId, 'failed');
        // Increment failed count for receiver (idempotent)
        if (challenge?.receiverId) {
            await incrementSladeshStats(challenge.receiverId, challengeId, 'failed').catch((err) => {
                console.error('[failChallenge] Failed to increment stats', err);
            });
        }
    }, [challenges, releaseReceiverLock, updateChallenge]);

    // Mark challenge as completed
    const completeChallenge = useCallback(async (challengeId, proofAfterImage) => {
        const challenge = challenges.find((c) => c.id === challengeId);
        await updateChallenge(challengeId, {
            status: SLADESH_STATUS.COMPLETED,
            proofAfterImage,
            completedAt: Date.now(),
        });
        await releaseReceiverLock(challengeId, 'completed');
        // Increment completed count for receiver (idempotent)
        if (challenge?.receiverId) {
            await incrementSladeshStats(challenge.receiverId, challengeId, 'completed').catch((err) => {
                console.error('[completeChallenge] Failed to increment stats', err);
            });
        }
    }, [challenges, releaseReceiverLock, updateChallenge]);

    // Defensive cleanup: if a resolved challenge comes in via Firestore, clear any lingering receiver lock
    useEffect(() => {
        challenges.forEach((challenge) => {
            if (challenge.status === SLADESH_STATUS.IN_PROGRESS) return;
            if (!challenge.receiverId || challenge.receiverId !== currentUser?.uid) return;
            if (clearedLocksRef.current.has(challenge.id)) return;
            clearedLocksRef.current.add(challenge.id);
            clearActiveSladeshLock(challenge.receiverId, challenge.id).catch((err) => {
                console.error('[sladesh] Passive clear of active sladesh lock failed', err);
            });
        });
    }, [challenges, clearActiveSladeshLock, currentUser?.uid]);

    const isChallengeInCurrentBlock = useCallback((challenge) => {
        if (!challenge) return false;
        const boundaryMs = currentResetBoundary?.getTime?.();
        if (!boundaryMs) return true;
        const timestampMs = typeof challenge.createdAt === 'number'
            ? challenge.createdAt
            : typeof challenge.deadlineAt === 'number'
                ? challenge.deadlineAt
                : null;

        if (!timestampMs || Number.isNaN(timestampMs)) {
            return false;
        }

        return timestampMs >= boundaryMs;
    }, [currentResetBoundary]);

    // Check if wheel is eligible: user has sent a challenge that failed in current block AND hasn't used wheel yet
    // DEV ONLY: This feature is only available in development mode
    const isWheelEligible = useMemo(() => {
        // Feature flag: Wheel is only available in development
        if (!IS_DEVELOPMENT) {
            return false;
        }

        if (!currentUser) return false;

        // DEV MODE: Always eligible for test user (bypass all checks)
        if (currentUser.email === 'simonmathiashansen@gmail.com') {
            console.log('[SladeshContext] DEV MODE: Wheel always eligible for test user');
            return true;
        }

        // Check if wheel was already used in current block
        if (wheelUsedAt) {
            const boundaryMs = currentResetBoundary?.getTime?.();
            if (boundaryMs && wheelUsedAt.getTime() >= boundaryMs) {
                return false; // Already used in this block
            }
        }

        // Check if user has any failed challenges in current block
        const failedChallenges = challenges
            .filter((c) => c.senderId === currentUser.uid)
            .filter((c) => c.status === SLADESH_STATUS.FAILED || c.status === SLADESH_STATUS.EXPIRED)
            .filter(isChallengeInCurrentBlock);

        return failedChallenges.length > 0;
    }, [challenges, currentUser, wheelUsedAt, currentResetBoundary, isChallengeInCurrentBlock]);

    // Mark wheel as used in current block
    const markWheelAsUsed = useCallback(() => {
        setWheelUsedAt(new Date());
    }, []);

    // Reset wheel eligibility at block boundaries
    useEffect(() => {
        if (!wheelUsedAt) return;
        const boundaryMs = currentResetBoundary?.getTime?.();
        if (boundaryMs && wheelUsedAt.getTime() < boundaryMs) {
            // Wheel usage was in previous block, reset it
            setWheelUsedAt(null);
        }
    }, [currentResetBoundary, wheelUsedAt]);

    // Helper to get the latest challenge where the user is the receiver (for Leaderboard)
    const getUserSladeshStatus = useCallback((userId) => {
        const receivedChallenges = challenges
            .filter((c) => c.receiverId === userId)
            .filter(isChallengeInCurrentBlock)
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        if (receivedChallenges.length === 0) return null;
        return receivedChallenges[0];
    }, [challenges, isChallengeInCurrentBlock]);

    // DEBUG: Function to simulate receiving a Sladesh (for testing)
    const debugReceiveSladesh = useCallback(() => {
        if (!currentUser) return;
        const mockSender = { id: 'mock-sender', name: 'Mock Sender' };
        const mockReceiver = { id: currentUser.uid, name: currentUser.displayName || 'Me' };
        sendSladesh(mockSender, mockReceiver);
    }, [currentUser, sendSladesh]);

    const value = {
        challenges,
        activeChallenge,
        activeSenderChallenge,
        isLocked,
        isSenderLocked,
        sendSladesh,
        removeChallenge,
        updateChallenge,
        failChallenge,
        completeChallenge,
        getUserSladeshStatus,
        debugReceiveSladesh,
        isWheelEligible,
        markWheelAsUsed,
    };

    return (
        <SladeshContext.Provider value={value}>
            {children}
        </SladeshContext.Provider>
    );
}

export function useSladesh() {
    const context = useContext(SladeshContext);
    if (!context) {
        throw new Error('useSladesh must be used within a SladeshProvider');
    }
    return context;
}
