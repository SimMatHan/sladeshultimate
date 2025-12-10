import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSladesh, SLADESH_STATUS } from '../contexts/SladeshContext';
import { useTheme } from '../contexts/ThemeContext';

export default function SladeshScanner() {
    const { activeChallenge, updateChallenge, completeChallenge, failChallenge } = useSladesh();
    const { isDarkMode } = useTheme();
    const navigate = useNavigate();
    const fileInputRef = useRef(null);

    // Derive initial phase from Firestore (for state recovery)
    const [phase, setPhase] = useState(() => {
        if (!activeChallenge) return 'intro';

        // Resume from Firestore phase if available
        if (activeChallenge.phase) {
            console.log('[Scanner] Recovering from Firestore phase:', activeChallenge.phase);
            return activeChallenge.phase;
        }

        // Fallback: derive from photos (backwards compatibility)
        if (activeChallenge.proofAfterImage) return 'empty_captured';
        if (activeChallenge.proofBeforeImage) return 'filled_captured';

        // Fallback: use old scannerStep if available
        if (activeChallenge.scannerStep) {
            const stepToPhaseMap = {
                'intro': 'intro',
                'before': 'awaiting_filled',
                'drinking': 'filled_captured',
                'after': 'awaiting_empty',
                'success': 'completed'
            };
            return stepToPhaseMap[activeChallenge.scannerStep] || 'intro';
        }

        return 'intro';
    });

    const [timeLeft, setTimeLeft] = useState(null);

    // Sync phase from Firestore updates (for multi-device support)
    useEffect(() => {
        if (!activeChallenge?.phase) return;
        if (activeChallenge.phase !== phase) {
            console.log('[Scanner] Syncing phase from Firestore:', activeChallenge.phase, '(current:', phase + ')');
            setPhase(activeChallenge.phase);
        }
    }, [activeChallenge?.phase]);

    // Handle iOS PWA lifecycle - re-sync when app becomes visible
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                console.log('[Scanner] App became visible, re-syncing from Firestore');
                if (activeChallenge?.phase && activeChallenge.phase !== phase) {
                    console.log('[Scanner] Phase mismatch after visibility change, syncing:', activeChallenge.phase);
                    setPhase(activeChallenge.phase);
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [activeChallenge, phase]);

    // Timer countdown
    useEffect(() => {
        if (!activeChallenge) return;

        const interval = setInterval(() => {
            const now = Date.now();
            const remaining = activeChallenge.deadlineAt - now;

            if (remaining <= 0) {
                setTimeLeft(0);
                clearInterval(interval);
                if (activeChallenge.status === SLADESH_STATUS.IN_PROGRESS) {
                    failChallenge(activeChallenge.id);
                }
            } else {
                setTimeLeft(remaining);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [activeChallenge, failChallenge]);

    // Auto-navigate after completion
    useEffect(() => {
        if (phase === 'completed' && activeChallenge) {
            console.log('[Scanner] Challenge completed, navigating to home in 5s');
            const timeout = setTimeout(() => {
                console.log('[Scanner] Navigating to /home');
                navigate('/home');
            }, 5000);

            return () => clearTimeout(timeout);
        }
    }, [phase, activeChallenge?.id, navigate]);

    // Handle photo capture
    const handlePhotoCapture = useCallback(async (file) => {
        if (!file || !activeChallenge) {
            console.warn('[Scanner] No file or no active challenge');
            return;
        }

        console.log('[Scanner] Photo captured in phase:', phase);

        const reader = new FileReader();
        reader.onloadend = async () => {
            const imageData = reader.result;

            if (phase === 'awaiting_filled') {
                // First photo (filled drink)
                console.log('[Scanner] Saving first photo (filled drink)');
                await updateChallenge(activeChallenge.id, {
                    proofBeforeImage: imageData,
                    phase: 'filled_captured',
                    filledCapturedAt: Date.now()
                });
                setPhase('filled_captured');

            } else if (phase === 'awaiting_empty') {
                // Second photo (empty drink)
                const now = Date.now();
                const startTime = activeChallenge.filledCapturedAt || activeChallenge.createdAt;
                const elapsed = now - startTime;
                const tenMinutes = 10 * 60 * 1000;

                console.log('[Scanner] Saving second photo (empty drink)');
                console.log('[Scanner] Time elapsed:', Math.floor(elapsed / 1000), 'seconds');

                if (elapsed > tenMinutes) {
                    // Too slow!
                    console.warn('[Scanner] Challenge failed: exceeded 10 minutes');
                    await updateChallenge(activeChallenge.id, {
                        phase: 'failed',
                        proofAfterImage: imageData
                    });
                    await failChallenge(activeChallenge.id);
                    setPhase('failed');
                } else {
                    // Success!
                    console.log('[Scanner] Challenge completed successfully!');
                    await updateChallenge(activeChallenge.id, {
                        proofAfterImage: imageData,
                        phase: 'empty_captured',
                        emptyCapturedAt: now
                    });
                    await completeChallenge(activeChallenge.id, imageData);
                    setPhase('completed');
                }
            }
        };
        reader.readAsDataURL(file);
    }, [phase, activeChallenge, updateChallenge, completeChallenge, failChallenge]);

    if (!activeChallenge) return null;

    const formatTime = (ms) => {
        if (ms === null) return '--:--';
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const triggerCamera = () => {
        console.log('[Scanner] Triggering camera in phase:', phase);
        fileInputRef.current?.click();
    };

    // Styles
    const overlayStyle = {
        backgroundColor: 'var(--surface)',
        color: 'var(--ink)',
    };

    return (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-6" style={overlayStyle}>
            <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                ref={fileInputRef}
                onChange={(e) => handlePhotoCapture(e.target.files[0])}
            />

            {/* Timer Display */}
            {timeLeft !== null && phase !== 'completed' && phase !== 'failed' && (
                <div className="absolute top-12 right-6 rounded-full px-4 py-2 text-lg font-bold font-mono" style={{ backgroundColor: 'var(--subtle)', color: timeLeft < 60000 ? 'var(--brand)' : 'var(--ink)' }}>
                    {formatTime(timeLeft)}
                </div>
            )}

            {/* Intro */}
            {phase === 'intro' && (
                <div className="text-center space-y-6 max-w-sm animate-in fade-in zoom-in duration-300">
                    <div className="text-6xl mb-4">🚨</div>
                    <h1 className="text-3xl font-bold" style={{ color: 'var(--brand)' }}>Du er blevet Sladeshed!</h1>
                    <p className="text-lg leading-relaxed" style={{ color: 'var(--muted)' }}>
                        <span className="font-semibold text-white">{activeChallenge.senderName}</span> har udfordret dig.
                    </p>
                    <div className="p-4 rounded-2xl text-left text-sm space-y-2" style={{ backgroundColor: 'var(--subtle)' }}>
                        <p>1. Tag et billede af din drink.</p>
                        <p>2. Bund eller drik op inden tiden løber ud.</p>
                        <p>3. Tag et billede af det tomme glas.</p>
                        <p className="font-bold mt-2" style={{ color: 'var(--brand)' }}>Du har 10 minutter!</p>
                    </div>
                    <button
                        onClick={() => {
                            console.log('[Scanner] Starting challenge');
                            setPhase('awaiting_filled');
                            updateChallenge(activeChallenge.id, { phase: 'awaiting_filled' });
                        }}
                        className="w-full py-4 rounded-2xl text-lg font-bold shadow-lg transform transition active:scale-95"
                        style={{ backgroundColor: 'var(--brand)', color: 'white' }}
                    >
                        Lets go! 📸
                    </button>
                </div>
            )}

            {/* Awaiting First Photo */}
            {phase === 'awaiting_filled' && (
                <div className="text-center space-y-6 max-w-sm animate-in slide-in-from-right duration-300">
                    <h2 className="text-2xl font-bold">Step 1: Før-billede</h2>
                    <p style={{ color: 'var(--muted)' }}>Vis os hvad du skal til at nedlægge.</p>
                    <div
                        onClick={triggerCamera}
                        className="aspect-square w-64 mx-auto rounded-3xl border-4 border-dashed flex items-center justify-center cursor-pointer hover:opacity-80 transition"
                        style={{ borderColor: 'var(--line)', backgroundColor: 'var(--subtle)' }}
                    >
                        <span className="text-4xl">📸</span>
                    </div>
                    <button
                        onClick={triggerCamera}
                        className="w-full py-4 rounded-2xl text-lg font-bold"
                        style={{ backgroundColor: 'var(--ink)', color: 'var(--surface)' }}
                    >
                        Tag billede
                    </button>
                </div>
            )}

            {/* Drinking Phase */}
            {phase === 'filled_captured' && (
                <div className="text-center space-y-8 max-w-sm animate-in fade-in duration-300">
                    <div className="relative">
                        <div className="text-8xl animate-pulse">🍻</div>
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold mb-2">Drik! Drik! Drik!</h2>
                        <p style={{ color: 'var(--muted)' }}>Uret tikker. Er du færdig?</p>
                    </div>

                    <button
                        onClick={() => {
                            console.log('[Scanner] User finished drinking');
                            setPhase('awaiting_empty');
                            updateChallenge(activeChallenge.id, { phase: 'awaiting_empty' });
                        }}
                        className="w-full py-4 rounded-2xl text-lg font-bold shadow-lg transform transition active:scale-95"
                        style={{ backgroundColor: 'var(--brand)', color: 'white' }}
                    >
                        Jeg er færdig! 🏁
                    </button>
                </div>
            )}

            {/* Awaiting Second Photo */}
            {phase === 'awaiting_empty' && (
                <div className="text-center space-y-6 max-w-sm animate-in slide-in-from-right duration-300">
                    <h2 className="text-2xl font-bold">Step 2: Efter-billede</h2>
                    <p style={{ color: 'var(--muted)' }}>Bevis det! Vis os det tomme glas.</p>
                    <div
                        onClick={triggerCamera}
                        className="aspect-square w-64 mx-auto rounded-3xl border-4 border-dashed flex items-center justify-center cursor-pointer hover:opacity-80 transition"
                        style={{ borderColor: 'var(--line)', backgroundColor: 'var(--subtle)' }}
                    >
                        <span className="text-4xl">📸</span>
                    </div>
                    <button
                        onClick={triggerCamera}
                        className="w-full py-4 rounded-2xl text-lg font-bold"
                        style={{ backgroundColor: 'var(--ink)', color: 'var(--surface)' }}
                    >
                        Indsend bevis
                    </button>
                </div>
            )}

            {/* Success */}
            {phase === 'completed' && (
                <div className="text-center space-y-6 max-w-sm animate-in zoom-in duration-500">
                    <div className="text-8xl">🏆</div>
                    <h1 className="text-3xl font-bold" style={{ color: 'var(--brand)' }}>Godt klaret!</h1>
                    <p style={{ color: 'var(--muted)' }}>Du overlevede Sladesh'en. Navigerer til home om 5 sekunder...</p>
                </div>
            )}

            {/* Failed */}
            {phase === 'failed' && (
                <div className="text-center space-y-6 max-w-sm animate-in fade-in duration-300">
                    <div className="text-8xl">😢</div>
                    <h1 className="text-3xl font-bold" style={{ color: 'var(--brand)' }}>For langsomt!</h1>
                    <p style={{ color: 'var(--muted)' }}>Du brugte mere end 10 minutter. Bedre held næste gang!</p>
                </div>
            )}
        </div>
    );
}
