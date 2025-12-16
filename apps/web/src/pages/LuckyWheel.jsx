import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Page from '../components/Page';
import SpinTheWheel from '../components/SpinTheWheel';
import { useAuth } from '../hooks/useAuth';
import { useSladesh } from '../contexts/SladeshContext';
import { grantSladeshRefill } from '../services/userService';
import { IS_DEVELOPMENT } from '../config/env';

export default function LuckyWheel() {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const { isWheelEligible, markWheelAsUsed } = useSladesh();
    const [result, setResult] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);

    // Production mode: Redirect to home (feature not available)
    useEffect(() => {
        if (!IS_DEVELOPMENT) {
            navigate('/home', { replace: true });
        }
    }, [navigate]);

    // Redirect if not eligible
    useEffect(() => {
        if (!isWheelEligible) {
            navigate('/sladesh', { replace: true });
        }
    }, [isWheelEligible, navigate]);

    const handleResult = async (outcome) => {
        setResult(outcome);
        setIsProcessing(true);

        try {
            // Mark wheel as used in this block
            markWheelAsUsed();

            // If won refill, grant it
            if (outcome.id === 'refill' && currentUser) {
                await grantSladeshRefill(currentUser.uid);
            }

            // Wait a bit to show result, then navigate back
            setTimeout(() => {
                navigate('/sladesh', { replace: true });
            }, 5000);
        } catch (error) {
            console.error('Error processing wheel result:', error);
            setIsProcessing(false);
        }
    };

    if (!isWheelEligible) {
        return null;
    }

    return (
        <Page title="Lykkehjulet" showBackButton>
            <div className="flex flex-1 flex-col items-center justify-center p-4">
                <div className="mb-6 text-center">
                    <h1 className="text-2xl font-bold" style={{ color: 'var(--ink)' }}>
                        Prøv lykken!
                    </h1>
                    <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>
                        Spin hjulet for en chance for at vinde en ekstra Sladesh
                    </p>
                </div>

                <SpinTheWheel onResult={handleResult} disabled={isProcessing} />
            </div>
        </Page>
    );
}
