import { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { collection, doc, getDoc, onSnapshot, query, updateDoc, where, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { db } from '../firebase';

const SladeshContext = createContext(null);

export const SLADESH_STATUS = {
    IN_PROGRESS: 'IN_PROGRESS',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
};

const STORAGE_KEY = 'sladesh_challenges';

export function SladeshProvider({ children }) {
    const { currentUser } = useAuth();
    const userNameCacheRef = useRef({});
    const scannerSeenChallengesRef = useRef(new Set()); // Track which challenges have shown the scanner

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

    // Persist challenges to localStorage
    useEffect(() => {
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(challenges));
        } catch (e) {
            console.error('Failed to save sladesh challenges', e);
        }
    }, [challenges]);

    // Find active challenge for current user (as receiver)
    // Only show scanner if we haven't seen this challenge yet
    const activeChallenge = useMemo(() => {
        if (!currentUser) return null;
        const challenge = challenges.find(
            (c) => c.receiverId === currentUser.uid && c.status === SLADESH_STATUS.IN_PROGRESS
        );

        // If challenge exists and we've already shown scanner for it, don't lock again
        if (challenge && scannerSeenChallengesRef.current.has(challenge.id)) {
            return null;
        }

        return challenge;
    }, [challenges, currentUser]);

    // Find active challenge the current user has sent (to lock sender UI)
    const activeSenderChallenge = useMemo(() => {
        if (!currentUser) return null;
        return challenges.find(
            (c) => c.senderId === currentUser.uid && c.status === SLADESH_STATUS.IN_PROGRESS
        );
    }, [challenges, currentUser]);

    // Mark a challenge as seen when scanner is shown
    const markScannerSeen = useCallback((challengeId) => {
        if (challengeId) {
            scannerSeenChallengesRef.current.add(challengeId);
        }
    }, []);

    // Clean up seen challenges when they're completed/failed
    useEffect(() => {
        const completedOrFailedIds = challenges
            .filter(c => c.status === SLADESH_STATUS.COMPLETED || c.status === SLADESH_STATUS.FAILED)
            .map(c => c.id);

        completedOrFailedIds.forEach(id => {
            scannerSeenChallengesRef.current.delete(id);
        });
    }, [challenges]);

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
        updateDoc(doc(db, 'sladeshChallenges', challengeId), {
            ...updates,
            updatedAt: serverTimestamp(),
        }).catch((err) => console.error('[sladesh] Failed to sync challenge update', err));
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
        syncChallengeUpdate(challengeId, updates);
    }, [syncChallengeUpdate]);

    // Mark challenge as failed
    const failChallenge = useCallback((challengeId) => {
        updateChallenge(challengeId, { status: SLADESH_STATUS.FAILED });
    }, [updateChallenge]);

    // Mark challenge as completed
    const completeChallenge = useCallback((challengeId, proofAfterImage) => {
        updateChallenge(challengeId, {
            status: SLADESH_STATUS.COMPLETED,
            proofAfterImage,
            completedAt: Date.now(),
        });
    }, [updateChallenge]);

    // Helper to get challenge status for a specific user (for Leaderboard)
    const getUserSladeshStatus = useCallback((userId) => {
        // Find most recent relevant challenge for this user
        // Either as sender or receiver
        const userChallenges = challenges.filter(c => c.senderId === userId || c.receiverId === userId);
        if (userChallenges.length === 0) return null;

        // Sort by createdAt desc
        userChallenges.sort((a, b) => b.createdAt - a.createdAt);
        return userChallenges[0];
    }, [challenges]);

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
        markScannerSeen,
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
