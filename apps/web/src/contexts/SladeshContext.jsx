import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { collection, doc, onSnapshot, query, updateDoc, where, serverTimestamp } from 'firebase/firestore';
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
    const activeChallenge = useMemo(() => {
        if (!currentUser) return null;
        return challenges.find(
            (c) => c.receiverId === currentUser.uid && c.status === SLADESH_STATUS.IN_PROGRESS
        );
    }, [challenges, currentUser]);

    // Subscribe to incoming challenges for the current user and lock the app when one arrives
    useEffect(() => {
        if (!currentUser?.uid) {
            setChallenges([]);
            return undefined;
        }

        const challengesRef = collection(db, 'sladeshChallenges');
        const q = query(
            challengesRef,
            where('recipientId', '==', currentUser.uid)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
        const next = snapshot.docs.map((docSnap) => {
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

            // Optional: mark the challenge as in_progress server-side so sender sees the state change
            if (statusRaw === 'pending') {
                updateDoc(doc(db, 'sladeshChallenges', docSnap.id), {
                        status: 'in_progress',
                        updatedAt: serverTimestamp(),
                    }).catch((err) => console.error('[sladesh] Failed to mark challenge in progress', err));
                }

                return {
                    id: docSnap.id,
                    senderId: data.senderId,
                    senderName: data.senderName || data.senderId || 'Ukendt',
                    receiverId: data.recipientId,
                    receiverName: data.receiverName || data.recipientId || 'Ukendt',
                    status,
                    createdAt: createdAtMs,
                    deadlineAt: deadlineAtMs,
                    proofBeforeImage: data.proofBeforeImage || null,
                    proofAfterImage: data.proofAfterImage || null,
                };
            });

            setChallenges(next);
        });

        return () => unsubscribe();
    }, [currentUser]);

    const syncChallengeUpdate = useCallback((challengeId, updates) => {
        updateDoc(doc(db, 'sladeshChallenges', challengeId), {
            ...updates,
            updatedAt: serverTimestamp(),
        }).catch((err) => console.error('[sladesh] Failed to sync challenge update', err));
    }, []);

    // Check if app should be locked
    const isLocked = !!activeChallenge;

    // Create a new Sladesh challenge
    const sendSladesh = useCallback((sender, receiver) => {
        const newChallenge = {
            id: crypto.randomUUID(),
            senderId: sender.id,
            senderName: sender.name || sender.username,
            receiverId: receiver.id,
            receiverName: receiver.name || receiver.username,
            status: SLADESH_STATUS.IN_PROGRESS,
            createdAt: Date.now(),
            deadlineAt: Date.now() + 10 * 60 * 1000, // 10 minutes from now
            proofBeforeImage: null,
            proofAfterImage: null,
        };

        setChallenges((prev) => [...prev, newChallenge]);
        return newChallenge;
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
        isLocked,
        sendSladesh,
        updateChallenge,
        failChallenge,
        completeChallenge,
        getUserSladeshStatus,
        debugReceiveSladesh,
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
