import { useState, useEffect, useRef } from 'react';
import { useSladesh, SLADESH_STATUS } from '../contexts/SladeshContext';
import { useTheme } from '../contexts/ThemeContext';

export default function SladeshScanner() {
    const { activeChallenge, updateChallenge, completeChallenge, failChallenge, markScannerSeen } = useSladesh();
    const { isDarkMode } = useTheme();
    const [step, setStep] = useState('intro'); // intro, before, drinking, after, success
    const [timeLeft, setTimeLeft] = useState(null);
    const fileInputRef = useRef(null);

    // Mark this challenge as seen when scanner first appears
    useEffect(() => {
        if (activeChallenge?.id) {
            markScannerSeen(activeChallenge.id);
        }
    }, [activeChallenge?.id, markScannerSeen]);

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

    // Auto-dismiss scanner when challenge is completed or failed
    useEffect(() => {
        if (!activeChallenge) return;
        if (activeChallenge.status === SLADESH_STATUS.COMPLETED || activeChallenge.status === SLADESH_STATUS.FAILED) {
            // Scanner will automatically unmount when activeChallenge becomes null
            // This is handled by the parent component (AppShell)
        }
    }, [activeChallenge]);

    if (!activeChallenge) return null;

    const formatTime = (ms) => {
        if (ms === null) return '--:--';
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            const imageUrl = reader.result;
            if (step === 'before') {
                updateChallenge(activeChallenge.id, { proofBeforeImage: imageUrl });
                setStep('drinking');
            } else if (step === 'after') {
                completeChallenge(activeChallenge.id, imageUrl);
                setStep('success');
            }
        };
        reader.readAsDataURL(file);
    };

    const triggerCamera = () => {
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
                onChange={handleFileChange}
            />

            {/* Timer Display (always visible if running) */}
            {timeLeft !== null && step !== 'success' && (
                <div className="absolute top-12 right-6 rounded-full px-4 py-2 text-lg font-bold font-mono" style={{ backgroundColor: 'var(--subtle)', color: timeLeft < 60000 ? 'var(--brand)' : 'var(--ink)' }}>
                    {formatTime(timeLeft)}
                </div>
            )}

            {step === 'intro' && (
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
                        onClick={() => setStep('before')}
                        className="w-full py-4 rounded-2xl text-lg font-bold shadow-lg transform transition active:scale-95"
                        style={{ backgroundColor: 'var(--brand)', color: 'white' }}
                    >
                        Lets go! 📸
                    </button>
                </div>
            )}

            {step === 'before' && (
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

            {step === 'drinking' && (
                <div className="text-center space-y-8 max-w-sm animate-in fade-in duration-300">
                    <div className="relative">
                        <div className="text-8xl animate-pulse">🍻</div>
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold mb-2">Drik! Drik! Drik!</h2>
                        <p style={{ color: 'var(--muted)' }}>Uret tikker. Er du færdig?</p>
                    </div>

                    <button
                        onClick={() => setStep('after')}
                        className="w-full py-4 rounded-2xl text-lg font-bold shadow-lg transform transition active:scale-95"
                        style={{ backgroundColor: 'var(--brand)', color: 'white' }}
                    >
                        Jeg er færdig! 🏁
                    </button>
                </div>
            )}

            {step === 'after' && (
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

            {step === 'success' && (
                <div className="text-center space-y-6 max-w-sm animate-in zoom-in duration-500">
                    <div className="text-8xl">🏆</div>
                    <h1 className="text-3xl font-bold" style={{ color: 'var(--brand)' }}>Godt klaret!</h1>
                    <p style={{ color: 'var(--muted)' }}>Du overlevede Sladesh'en. Scanneren lukker automatisk...</p>
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>
                        Hvis scanneren ikke lukker, kan du genstarte appen.
                    </p>
                </div>
            )}
        </div>
    );
}
