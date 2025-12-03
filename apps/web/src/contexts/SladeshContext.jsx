import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';

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
    }, []);

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
