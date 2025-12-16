import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import './ThemeDropAnimation.css';

export default function ThemeDropAnimation() {
    const { currentUser } = useAuth();
    const [activeEmojis, setActiveEmojis] = useState([]);

    useEffect(() => {
        if (!currentUser) return;

        // Listen to theme drops where current user is in targetUserIds
        const themeDropsRef = collection(db, 'themeDrops');
        const themeDropsQuery = query(
            themeDropsRef,
            orderBy('createdAt', 'desc'),
            limit(1)
        );

        const unsubscribe = onSnapshot(themeDropsQuery, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const data = change.doc.data();

                    // Check if current user is in targetUserIds
                    if (data.targetUserIds && data.targetUserIds.includes(currentUser.uid)) {
                        console.log('[ThemeDropAnimation] Triggering theme drop', {
                            themeName: data.themeName,
                            emojiCount: data.emojis?.length
                        });

                        triggerAnimation(data.emojis || [], data.themeName);
                    }
                }
            });
        });

        return () => unsubscribe();
    }, [currentUser]);

    const triggerAnimation = (emojis, themeName) => {
        if (!emojis || emojis.length === 0) return;

        // Generate 25 random emoji drops
        const newEmojis = Array.from({ length: 25 }, (_, index) => ({
            id: `${Date.now()}-${index}`,
            emoji: emojis[Math.floor(Math.random() * emojis.length)],
            left: Math.random() * 100, // Random horizontal position (0-100%)
            delay: Math.random() * 2, // Random delay (0-2s)
            duration: 3 + Math.random() * 2, // Random duration (3-5s)
            size: 1.5 + Math.random() * 1.5 // Random size (1.5-3rem)
        }));

        console.log('[ThemeDropAnimation] Generated emojis:', newEmojis.length, newEmojis);
        setActiveEmojis(newEmojis);

        // Clear emojis after longest animation completes
        const maxDuration = Math.max(...newEmojis.map(e => e.duration + e.delay));
        setTimeout(() => {
            console.log('[ThemeDropAnimation] Clearing emojis');
            setActiveEmojis([]);
        }, (maxDuration + 0.5) * 1000);
    };

    if (activeEmojis.length === 0) return null;

    console.log('[ThemeDropAnimation] Rendering', activeEmojis.length, 'emojis');

    return (
        <div
            className="theme-drop-container"
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 9999,
                overflow: 'hidden'
            }}
        >
            {activeEmojis.map((item) => (
                <div
                    key={item.id}
                    className="emoji-drop"
                    style={{
                        position: 'absolute',
                        top: '-100px',
                        left: `${item.left}%`,
                        fontSize: `${item.size}rem`,
                        pointerEvents: 'none',
                        userSelect: 'none',
                        animation: `fall ${item.duration}s linear ${item.delay}s forwards`,
                        willChange: 'transform, opacity'
                    }}
                >
                    {item.emoji}
                </div>
            ))}
            <style>{`
                @keyframes fall {
                    0% {
                        transform: translateY(0) rotate(0deg);
                        opacity: 1;
                    }
                    100% {
                        transform: translateY(calc(100vh + 100px)) rotate(360deg);
                        opacity: 0;
                    }
                }
            `}</style>
        </div>
    );
}
