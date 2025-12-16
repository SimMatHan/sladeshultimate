import { useState, useRef, useEffect } from 'react';
import './SpinTheWheel.css';

// Wheel outcomes with probabilities
const WHEEL_OUTCOMES = [
    { id: 'refill', label: '🎉 Sladesh Refill!', color: 'from-emerald-400 to-teal-500', weight: 15 },
    { id: 'nothing', label: '😅 Bedre held næste gang', color: 'from-slate-400 to-gray-500', weight: 30 },
    { id: 'nothing2', label: '🤷 Intet denne gang', color: 'from-rose-400 to-pink-500', weight: 25 },
    { id: 'nothing3', label: '💪 Prøv igen senere', color: 'from-amber-400 to-orange-500', weight: 20 },
    { id: 'nothing4', label: '🎯 Næsten!', color: 'from-violet-400 to-purple-500', weight: 10 },
];

// Calculate total weight for probability
const TOTAL_WEIGHT = WHEEL_OUTCOMES.reduce((sum, outcome) => sum + outcome.weight, 0);

export default function SpinTheWheel({ onResult, disabled = false }) {
    const [isSpinning, setIsSpinning] = useState(false);
    const [rotation, setRotation] = useState(0);
    const [result, setResult] = useState(null);
    const wheelRef = useRef(null);

    const handleSpin = () => {
        if (isSpinning || disabled) return;

        setIsSpinning(true);
        setResult(null);

        // Select outcome based on weighted probability
        const random = Math.random() * TOTAL_WEIGHT;
        let cumulativeWeight = 0;
        let selectedOutcome = WHEEL_OUTCOMES[0];

        for (const outcome of WHEEL_OUTCOMES) {
            cumulativeWeight += outcome.weight;
            if (random <= cumulativeWeight) {
                selectedOutcome = outcome;
                break;
            }
        }

        // Calculate rotation
        const outcomeIndex = WHEEL_OUTCOMES.findIndex(o => o.id === selectedOutcome.id);
        const segmentAngle = 360 / WHEEL_OUTCOMES.length;
        const outcomeAngle = outcomeIndex * segmentAngle;

        // Spin multiple times + land on outcome (offset to center of segment)
        const spins = 5 + Math.random() * 3; // 5-8 full rotations
        const finalRotation = (spins * 360) + (360 - outcomeAngle - segmentAngle / 2);

        setRotation(finalRotation);

        // Show result after animation completes
        setTimeout(() => {
            setIsSpinning(false);
            setResult(selectedOutcome);
            if (onResult) {
                onResult(selectedOutcome);
            }
        }, 4000); // Match CSS animation duration
    };

    const handleReset = () => {
        setResult(null);
        setRotation(0);
    };

    return (
        <div className="spin-the-wheel">
            <div className="wheel-container">
                <div className="wheel-pointer">▼</div>
                <div
                    ref={wheelRef}
                    className={`wheel ${isSpinning ? 'spinning' : ''}`}
                    style={{ transform: `rotate(${rotation}deg)` }}
                >
                    {WHEEL_OUTCOMES.map((outcome, index) => {
                        const segmentAngle = 360 / WHEEL_OUTCOMES.length;
                        const rotation = index * segmentAngle;
                        return (
                            <div
                                key={outcome.id}
                                className="wheel-segment"
                                style={{
                                    transform: `rotate(${rotation}deg)`,
                                }}
                            >
                                <div className={`segment-content bg-gradient-to-br ${outcome.color}`}>
                                    <span className="segment-label">{outcome.label}</span>
                                </div>
                            </div>
                        );
                    })}
                    <div className="wheel-center">
                        <span className="wheel-center-emoji">🤙</span>
                    </div>
                </div>
            </div>

            {!result && (
                <button
                    className="spin-button"
                    onClick={handleSpin}
                    disabled={isSpinning || disabled}
                >
                    {isSpinning ? 'Snurrer...' : 'Spin Hjulet!'}
                </button>
            )}

            {result && (
                <div className="result-overlay">
                    <div className="result-card">
                        <div className={`result-icon bg-gradient-to-br ${result.color}`}>
                            {result.label.split(' ')[0]}
                        </div>
                        <h2 className="result-title">
                            {result.id === 'refill' ? 'Tillykke!' : 'Åh nej!'}
                        </h2>
                        <p className="result-message">{result.label}</p>
                        {result.id === 'refill' && (
                            <p className="result-description">
                                Du har vundet en ekstra Sladesh! Du kan nu sende en ny Sladesh med det samme.
                            </p>
                        )}
                        {result.id !== 'refill' && (
                            <p className="result-description">
                                Prøv igen næste gang din Sladesh udløber uden respons.
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
