import { useEffect, useState, useMemo } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getUser } from '../services/userService';
import { ACHIEVEMENTS } from '../config/achievements';
import { USE_MOCK_DATA } from '../config/env';

export default function ProfileDetails() {
    const { userId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const [profile, setProfile] = useState(location.state?.profile || null);
    const [loading, setLoading] = useState(!profile);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchProfile = async () => {
            if (!userId) return;

            // If we already have the full profile data from state and it's not mock data mode (or we want to refresh),
            // we might still want to fetch fresh data.
            // But if we have initial data, we can show it while loading.

            try {
                if (USE_MOCK_DATA) {
                    // In mock mode, we rely on the state passed from Leaderboard
                    // If accessed directly, we might need to find it in the mock list (not implemented here for simplicity, assuming navigation)
                    if (!profile) {
                        // Fallback for direct access in mock mode if needed, or just show loading/error
                        setError('Kan ikke indlæse profil i mock mode uden navigation');
                    }
                    setLoading(false);
                    return;
                }

                setLoading(true);
                const userData = await getUser(userId);

                if (userData) {
                    setProfile(prev => ({
                        ...prev, // Keep existing data (like rank, etc if passed)
                        ...userData,
                        // Ensure we have the display properties
                        name: userData.fullName,
                        username: userData.username,
                        initials: userData.initials,
                        profileEmoji: userData.profileEmoji,
                        profileGradient: userData.avatarGradient || userData.profileGradient,
                    }));
                } else {
                    setError('Bruger ikke fundet');
                }
            } catch (err) {
                console.error('Error fetching user profile:', err);
                setError('Der skete en fejl ved indlæsning af profilen');
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, [userId]);

    // Build drink breakdown
    const drinkBreakdown = useMemo(() => {
        if (!profile) return [];

        // If we have pre-calculated breakdown from Leaderboard (mock or passed state), use it
        if (profile.drinkBreakdown) return profile.drinkBreakdown;

        // Otherwise calculate from drinkVariations
        const breakdown = [];
        const variations = profile.drinkVariations || {};

        Object.entries(variations).forEach(([type, typeVariations]) => {
            if (typeVariations && typeof typeVariations === 'object') {
                Object.entries(typeVariations).forEach(([variation, count]) => {
                    if (count > 0) {
                        breakdown.push({
                            id: `${type}-${variation}`,
                            label: variation,
                            count: count
                        });
                    }
                });
            }
        });

        return breakdown.sort((a, b) => b.count - a.count);
    }, [profile]);

    const breakdownTotal = drinkBreakdown.reduce((sum, item) => sum + item.count, 0);

    // Get unlocked achievements
    const unlockedAchievements = useMemo(() => {
        if (!profile || !profile.achievements) return [];
        return ACHIEVEMENTS.filter(achievement => {
            const userAchievement = profile.achievements[achievement.id];
            return !!userAchievement;
        }).map(achievement => ({
            ...achievement,
            userData: profile.achievements[achievement.id]
        }));
    }, [profile]);

    if (loading && !profile) {
        return (
            <div className="flex items-center justify-center py-12">
                <p className="text-sm" style={{ color: 'var(--muted)' }}>Indlæser profil...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
                <p className="text-sm" style={{ color: 'var(--muted)' }}>{error}</p>
                <button
                    onClick={() => navigate(-1)}
                    className="text-sm font-semibold text-[var(--brand)]"
                >
                    Gå tilbage
                </button>
            </div>
        );
    }

    if (!profile) return null;

    const displayName = profile.name || profile.username || 'Ukendt';
    const displayUsername = profile.username;
    const totalDrinks = profile.totalDrinks || 0;
    const currentRun = profile.currentRunDrinkCount || 0;

    return (
        <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '-100%', opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="pb-20"
        >
            {/* Header Section */}
            <div className="flex flex-col items-center gap-6 text-center py-6">
                <div className="flex flex-col items-center gap-3">
                    <Avatar
                        emoji={profile.profileEmoji}
                        gradient={profile.profileGradient || profile.avatarGradient}
                        initials={profile.initials}
                        className="h-24 w-24 text-5xl shadow-lg"
                    />
                    <div>
                        <h1 className="text-2xl font-bold leading-tight" style={{ color: 'var(--ink)' }}>{displayName}</h1>
                        {displayUsername && <p className="text-sm font-medium" style={{ color: 'var(--muted)' }}>@{displayUsername}</p>}
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3 w-full">
                    <div className="rounded-2xl border border-[var(--line)] bg-[var(--subtle)] p-4 flex flex-col items-center justify-center gap-1">
                        <span className="text-3xl font-bold tabular-nums" style={{ color: 'var(--ink)' }}>{totalDrinks.toLocaleString('da-DK')}</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Total i Sladesh-tid</span>
                    </div>
                    <div className="rounded-2xl border border-[var(--line)] bg-[var(--subtle)] p-4 flex flex-col items-center justify-center gap-1">
                        <span className="text-3xl font-bold tabular-nums" style={{ color: 'var(--ink)' }}>{currentRun.toLocaleString('da-DK')}</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Loggede drinks i dag</span>
                    </div>
                </div>

                {/* Achievements Section */}
                <div className="w-full space-y-3 pt-2">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-left pl-1" style={{ color: 'var(--muted)' }}>Achievements</h2>
                    {unlockedAchievements.length > 0 ? (
                        <div className="flex flex-wrap gap-3 justify-center bg-[var(--subtle)] rounded-2xl p-4 border border-[var(--line)]">
                            {unlockedAchievements.map(ach => (
                                <div key={ach.id} className="relative group" title={ach.title}>
                                    <img
                                        src={ach.image}
                                        alt={ach.title}
                                        className="w-14 h-14 object-contain drop-shadow-sm transition-transform hover:scale-110"
                                    />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex items-center justify-center rounded-2xl border border-dashed border-[var(--line)] p-6">
                            <p className="text-sm font-medium" style={{ color: 'var(--muted)' }}>Ingen achievements endnu</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Drink Breakdown */}
            <div className="space-y-3 pt-4">
                <h2 className="text-xs font-bold uppercase tracking-widest text-left pl-1" style={{ color: 'var(--muted)' }}>Top Drinks</h2>
                {drinkBreakdown.length > 0 ? (
                    <div className="space-y-4">
                        {drinkBreakdown.map(item => {
                            const percentage = breakdownTotal ? Math.round((item.count / breakdownTotal) * 100) : 0;
                            return (
                                <div key={item.id} className="flex flex-col gap-1">
                                    <div className="flex items-end justify-between text-sm">
                                        <span className="font-medium text-[var(--ink)]">{item.label}</span>
                                        <div className="flex items-center gap-1.5 tabular-nums">
                                            <span className="text-xs font-medium text-[var(--muted)]">{percentage}%</span>
                                            <span className="font-bold text-[var(--ink)]">{item.count}</span>
                                        </div>
                                    </div>
                                    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--subtle)]">
                                        <div
                                            className="h-full rounded-full transition-all duration-500 ease-out"
                                            style={{
                                                width: `${percentage}%`,
                                                backgroundColor: 'var(--brand)',
                                                opacity: 0.8 + (percentage / 100) * 0.2
                                            }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="flex items-center justify-center rounded-2xl border border-dashed border-[var(--line)] p-8">
                        <p className="text-sm font-medium" style={{ color: 'var(--muted)' }}>Ingen drinks registreret endnu</p>
                    </div>
                )}
            </div>
        </motion.div>
    );
}

function Avatar({ emoji, gradient, initials, className = 'h-12 w-12 text-xl' }) {
    if (emoji && gradient) {
        return (
            <div
                className={`flex items-center justify-center rounded-full bg-gradient-to-br ${gradient} shadow-sm ${className}`}
            >
                {emoji}
            </div>
        );
    }

    return (
        <div
            className={`flex items-center justify-center rounded-full bg-gradient-to-br ${gradient || 'from-gray-400 to-gray-600'} font-semibold uppercase text-white shadow-sm ${className}`}
        >
            {initials || '??'}
        </div>
    );
}
