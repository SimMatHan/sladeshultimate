import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { getUser, ensureFreshCheckInStatus } from '../services/userService';
import { ACHIEVEMENTS } from '../config/achievements';
import { USE_MOCK_DATA } from '../config/env';
import { DRINK_CATEGORY_ID_SET } from '../constants/drinks';

function buildVariationBreakdown(variations, fallback = []) {
  const breakdown = [];

  Object.entries(variations || {}).forEach(([type, typeVariations]) => {
    if (!DRINK_CATEGORY_ID_SET.has(type)) {
      return;
    }
    if (typeVariations && typeof typeVariations === 'object') {
      const totalForType = Object.values(typeVariations).reduce((sum, value) => sum + (value || 0), 0);
      if (totalForType > 0) {
        breakdown.push({
          id: type,
          label: formatDrinkTypeLabel(type),
          type,
          count: totalForType,
        });
      }
    }
  });

  if (breakdown.length > 0) {
    return breakdown;
  }

  return (fallback || []).map((item) => (item.type ? { ...item, label: formatDrinkTypeLabel(item.type) } : item));
}

function buildTypeBreakdown(drinkTypes) {
  const breakdown = [];

  Object.entries(drinkTypes || {}).forEach(([type, count]) => {
    if (!DRINK_CATEGORY_ID_SET.has(type)) {
      return;
    }
    if (count > 0) {
      breakdown.push({
        id: type,
        label: formatDrinkTypeLabel(type),
        type,
        count,
      });
    }
  });

  return breakdown.sort((a, b) => b.count - a.count);
}

function formatDrinkTypeLabel(type) {
  const labels = {
    beer: 'Øl',
    cider: 'Cider',
    wine: 'Vin',
    cocktail: 'Cocktails',
    shot: 'Shots',
    spritz: 'Spritz',
    soda: 'Sodavand',
    other: 'Andet'
  };
  return labels[type] || type.charAt(0).toUpperCase() + type.slice(1);
}

function filterDrinkVariations(variations = {}) {
  return Object.fromEntries(
    Object.entries(variations || {}).filter(([type]) => DRINK_CATEGORY_ID_SET.has(type))
  );
}

function filterDrinkTypes(drinkTypes = {}) {
  return Object.fromEntries(
    Object.entries(drinkTypes || {}).filter(([type]) => DRINK_CATEGORY_ID_SET.has(type))
  );
}

function getOtherVariations(allTimeDrinkVariations = {}) {
  return allTimeDrinkVariations?.other || {};
}

function getOtherTotals(otherVariations = {}) {
  return Object.values(otherVariations || {}).reduce((sum, count) => sum + (count || 0), 0);
}

function sortBreakdownByPercentage(items = [], total = 0) {
  return [...items].sort((a, b) => {
    const aPct = total ? a.count / total : 0;
    const bPct = total ? b.count / total : 0;
    if (bPct !== aPct) return bPct - aPct;
    if (b.count !== a.count) return b.count - a.count;
    return (a.label || '').localeCompare(b.label || '', 'da');
  });
}

export default function ProfileDetails() {
  const { userId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(location.state?.profile || null);
  const [loading, setLoading] = useState(!profile);
  const [error, setError] = useState(null);
  const [activeAchievement, setActiveAchievement] = useState(null);
  const [breakdownScope, setBreakdownScope] = useState('current');

  // Lock body scroll when modal is open
  useEffect(() => {
    if (!activeAchievement) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [activeAchievement]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!userId) return;

      try {
        if (USE_MOCK_DATA) {
          if (!profile) {
            setError('Kan ikke indloese profil i mock mode uden navigation');
          }
          setLoading(false);
          return;
        }

        setLoading(true);
        const userData = await getUser(userId);

        if (userData) {
          setProfile((prev) => ({
            ...prev,
            ...userData,
            name: userData.fullName,
            username: userData.username,
            initials: userData.initials,
            profileEmoji: userData.profileEmoji,
            profileGradient: userData.avatarGradient || userData.profileGradient,
            profileImageUrl: userData.profileImageUrl,
          }));
        } else {
          setError('Bruger ikke fundet');
        }
      } catch (err) {
        console.error('Error fetching user profile:', err);
        setError('Der skete en fejl ved indloesning af profilen');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [userId]);

  // REALTIME UPDATES: Subscribe to user document changes for live currentRunDrinkCount updates
  // This ensures ProfileDetails.jsx shows the same realtime data as Leaderboard.jsx and Home.jsx
  useEffect(() => {
    if (!userId || USE_MOCK_DATA) return;

    console.log('[ProfileDetails] Setting up realtime listener for user:', userId);

    const userRef = doc(db, 'users', userId);

    // Subscribe to user document changes
    const unsubscribe = onSnapshot(
      userRef,
      async (docSnap) => {
        if (!docSnap.exists()) {
          console.warn('[ProfileDetails] User document not found:', userId);
          return;
        }

        let userData = docSnap.data();

        // Refresh check-in status to ensure it's current (same as leaderboardService)
        try {
          userData = await ensureFreshCheckInStatus(userId, userData);
        } catch (statusError) {
          console.warn('[ProfileDetails] Unable to refresh check-in status:', statusError);
        }

        console.log('[ProfileDetails] Realtime update received:', {
          userId,
          currentRunDrinkCount: userData.currentRunDrinkCount,
          totalDrinks: userData.totalDrinks
        });

        // Update profile with fresh data from Firestore
        setProfile((prev) => ({
          ...prev,
          ...userData,
          id: userId,
          name: userData.fullName,
          username: userData.username,
          initials: userData.initials,
          profileEmoji: userData.profileEmoji,
          profileGradient: userData.avatarGradient || userData.profileGradient,
          profileImageUrl: userData.profileImageUrl,
        }));
      },
      (error) => {
        console.error('[ProfileDetails] Realtime listener error:', error);
      }
    );

    // Cleanup: unsubscribe when component unmounts or userId changes
    return () => {
      console.log('[ProfileDetails] Cleaning up realtime listener for user:', userId);
      unsubscribe();
    };
  }, [userId]);

  // Build drink breakdown
  const currentRun = profile?.currentRunDrinkCount || 0;

  const currentRunVariations = useMemo(
    () => filterDrinkVariations(profile?.currentRunDrinkVariations || profile?.drinkVariations || {}),
    [profile?.currentRunDrinkVariations, profile?.drinkVariations]
  );
  const allTimeVariations = useMemo(() => {
    // Use the new allTimeDrinkVariations field which tracks lifetime variations
    // This field is never reset and accumulates all drink variations over time
    // Format: { "beer": { "Lager": 50, "IPA": 30 }, "cocktail": { "Mojito": 20 } }
    return filterDrinkVariations(profile?.allTimeDrinkVariations || {});
  }, [profile?.allTimeDrinkVariations]);

  const currentRunBreakdown = useMemo(
    () => buildVariationBreakdown(currentRunVariations, profile?.drinkBreakdown),
    [currentRunVariations, profile?.drinkBreakdown]
  );

  // For all-time view, use drinkTypes (type-level aggregation) instead of allTimeDrinkVariations
  // This shows drink type percentages (Beer: 60%, Wine: 40%) instead of variation percentages
  const allTimeBreakdown = useMemo(
    () => buildTypeBreakdown(filterDrinkTypes(profile?.drinkTypes)),
    [profile?.drinkTypes]
  );

  // “Andet” (non-drink) stats
  const otherVariations = useMemo(
    () => getOtherVariations(profile?.allTimeDrinkVariations),
    [profile?.allTimeDrinkVariations]
  );
  const otherTotal = useMemo(() => getOtherTotals(otherVariations), [otherVariations]);
  const otherBreakdown = useMemo(() => {
    return Object.entries(otherVariations || {})
      .filter(([, count]) => count > 0)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  }, [otherVariations]);

  const getTotalCount = (items) => items.reduce((sum, item) => sum + item.count, 0);

  const breakdownByScope = {
    current: currentRunBreakdown,
    'all-time': allTimeBreakdown,
  };

  const selectedBreakdown = breakdownByScope[breakdownScope] || currentRunBreakdown;

  const percentageBase = useMemo(() => {
    if (breakdownScope === 'current') {
      return currentRun || getTotalCount(currentRunBreakdown);
    }
    return profile?.totalDrinks || getTotalCount(allTimeBreakdown);
  }, [breakdownScope, currentRun, currentRunBreakdown, allTimeBreakdown, profile?.totalDrinks]);

  const sortedBreakdown = useMemo(
    () => sortBreakdownByPercentage(selectedBreakdown, percentageBase),
    [selectedBreakdown, percentageBase]
  );

  const favoriteType = useMemo(() => {
    // For current run, use variations; for all-time, use drinkTypes
    if (breakdownScope === 'current') {
      const variations = currentRunVariations;
      let topType = null;
      let topCount = 0;

      Object.entries(variations).forEach(([type, typeVariations]) => {
        if (typeVariations && typeof typeVariations === 'object') {
          const typeTotal = Object.values(typeVariations).reduce((sum, value) => sum + (value || 0), 0);
          if (typeTotal > topCount) {
            topType = type;
            topCount = typeTotal;
          }
        }
      });

      return topType
        ? {
          type: topType,
          count: topCount,
          percentage: percentageBase ? Math.round((topCount / percentageBase) * 100) : 0,
        }
        : null;
    } else {
      // All-time: use drinkTypes directly
      const drinkTypes = filterDrinkTypes(profile?.drinkTypes || {});
      let topType = null;
      let topCount = 0;

      Object.entries(drinkTypes).forEach(([type, count]) => {
        if (count > topCount) {
          topType = type;
          topCount = count;
        }
      });

      return topType
        ? {
          type: topType,
          count: topCount,
          percentage: percentageBase ? Math.round((topCount / percentageBase) * 100) : 0,
        }
        : null;
    }
  }, [percentageBase, breakdownScope, currentRunVariations, profile?.drinkTypes]);

  const favoriteVariation = sortedBreakdown[0] || null;

  // Get unlocked achievements
  const unlockedAchievements = useMemo(() => {
    if (!profile || !profile.achievements) return [];
    return ACHIEVEMENTS.filter((achievement) => {
      const userAchievement = profile.achievements[achievement.id];
      return !!userAchievement;
    }).map((achievement) => ({
      ...achievement,
      userData: profile.achievements[achievement.id],
    }));
  }, [profile]);

  if (loading && !profile) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          Indloeser profil...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          {error}
        </p>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-sm font-semibold text-[var(--brand)]"
        >
          Gaa tilbage
        </button>
      </div>
    );
  }

  if (!profile) return null;

  const displayName = profile.name || profile.username || 'Ukendt';
  const displayUsername = profile.username;
  const totalDrinks = profile.totalDrinks || 0;
  const sladeshSent = profile?.sladeshSent || 0;
  const sladeshReceived = profile?.sladeshReceived || 0;
  const sladeshCompleted = profile?.sladeshCompletedCount || 0;
  const sladeshFailed = profile?.sladeshFailedCount || 0;
  const scopeLabel = breakdownScope === 'current' ? 'nuværende run' : 'hele Sladesh-historikken';

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
            image={profile.profileImageUrl}
            emoji={profile.profileEmoji}
            gradient={profile.profileGradient || profile.avatarGradient}
            initials={profile.initials}
            className="h-24 w-24 text-5xl shadow-lg"
          />
          <div>
            <h1 className="text-2xl font-bold leading-tight" style={{ color: 'var(--ink)' }}>
              {displayName}
            </h1>
            {displayUsername && (
              <p className="text-sm font-medium" style={{ color: 'var(--muted)' }}>
                @{displayUsername}
              </p>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 w-full">
          <StatTile value={totalDrinks} label="Total i Sladesh-tid" />
          <StatTile value={currentRun} label="Loggede drinks i dag" />
          <StatTile value={sladeshReceived} label="Sladesh modtaget" />
          <StatTile value={sladeshSent} label="Sladesh sendt" />
          <StatTile value={sladeshCompleted} label="Sladesh completed" />
          <StatTile value={sladeshFailed} label="Sladesh failed" />
        </div>

        {/* Achievements Section */}
        <div className="w-full space-y-3 pt-2">
          <h2 className="text-xs font-bold uppercase tracking-widest text-left pl-1" style={{ color: 'var(--muted)' }}>
            Achievements
          </h2>
          {unlockedAchievements.length > 0 ? (
            <div className="flex flex-wrap gap-3 justify-center bg-[var(--subtle)] rounded-2xl p-4 border border-[var(--line)]">
              {unlockedAchievements.map((ach) => (
                <button
                  key={ach.id}
                  type="button"
                  className="relative group transition-transform hover:scale-105 active:scale-100"
                  title={ach.title}
                  onClick={() => setActiveAchievement(ach)}
                >
                  <img
                    src={ach.image}
                    alt={ach.title}
                    className="w-14 h-14 object-contain drop-shadow-sm rounded-xl"
                  />
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center rounded-2xl border border-dashed border-[var(--line)] p-6">
              <p className="text-sm font-medium" style={{ color: 'var(--muted)' }}>
                Ingen achievements endnu
              </p>
            </div>
          )}
        </div>

        {/* Nuværende Run Section - REALTIME UPDATES */}
        <div className="w-full space-y-3 pt-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-left pl-1" style={{ color: 'var(--muted)' }}>
            Nuværende Run
          </h2>
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--subtle)] p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase font-semibold tracking-wide" style={{ color: "var(--muted)" }}>
                  Drinks i dag
                </p>
                <p className="text-3xl font-bold tabular-nums" style={{ color: "var(--ink)" }}>
                  {Number(currentRun).toLocaleString('da-DK')}
                </p>
              </div>
              <span className="text-[11px] font-semibold rounded-full px-3 py-1.5 bg-[var(--brand)] text-white">
                Live opdateret
              </span>
            </div>

            {/* Current Run Drink Types Breakdown */}
            {currentRunBreakdown.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-[var(--line)]">
                <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                  Drink typer i dag
                </p>
                <div className="space-y-2">
                  {currentRunBreakdown.map((item) => {
                    const percentage = currentRun ? Math.round((item.count / currentRun) * 100) : 0;
                    return (
                      <div key={item.id} className="flex items-center justify-between text-sm">
                        <span className="font-medium text-[var(--ink)]">{item.label}</span>
                        <div className="flex items-center gap-2 tabular-nums">
                          <span className="text-xs font-medium text-[var(--muted)]">{percentage}%</span>
                          <span className="font-bold text-[var(--ink)]">{item.count}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Drink Breakdown */}
      <div className="space-y-3 pt-4">
        <div className="flex flex-col gap-2 pl-1">
          <h2 className="text-xs font-bold uppercase tracking-widest text-left" style={{ color: 'var(--muted)' }}>
            Favorit i {scopeLabel}
          </h2>
          <BreakdownScopeToggle value={breakdownScope} onChange={setBreakdownScope} />
          <p className="text-[11px] text-left" style={{ color: 'var(--muted)' }}>
            {favoriteVariation
              ? `${favoriteVariation.label} (${favoriteType?.type || 'mix'}) er mest logget i ${scopeLabel}${favoriteType?.percentage != null ? ` \u2014 ${favoriteType.percentage}% af dine valgte drinks` : ''}.`
              : `Ingen favorit endnu \u2014 log en drink i ${breakdownScope === 'current' ? 'dette run' : 'Sladesh'} for at se din favorit.`}
          </p>
        </div>
        {sortedBreakdown.length > 0 ? (
          <div className="space-y-4">
            {sortedBreakdown.map((item) => {
              const percentage = percentageBase ? Math.round((item.count / percentageBase) * 100) : 0;
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
                        opacity: 0.8 + (percentage / 100) * 0.2,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center justify-center rounded-2xl border border-dashed border-[var(--line)] p-8">
            <p className="text-sm font-medium" style={{ color: 'var(--muted)' }}>
              {breakdownScope === 'current'
                ? 'Ingen drinks registreret i dette run endnu'
                : 'Ingen drinks registreret endnu i din Sladesh-historik'}
            </p>
          </div>
        )}
      </div>

      {/* “Andet” (non-drink) overview */}
      <div className="space-y-2 pt-6">
        <h2 className="text-xs font-bold uppercase tracking-widest text-left pl-1" style={{ color: 'var(--muted)' }}>
          Andet (all-time)
        </h2>
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--subtle)] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-semibold tracking-wide" style={{ color: "var(--muted)" }}>
                Total Andet
              </p>
              <p className="text-2xl font-semibold" style={{ color: "var(--ink)" }}>
                {Number(otherTotal).toLocaleString('da-DK')}
              </p>
            </div>
            <span className="text-[11px] font-semibold rounded-full px-3 py-1" style={{ backgroundColor: "var(--surface)", color: "var(--muted)" }}>
              Logget events
            </span>
          </div>

          {otherBreakdown.length > 0 ? (
            <div className="space-y-2">
              {otherBreakdown.map((item) => {
                const percentageBase = otherTotal || 0;
                const percentage = percentageBase ? Math.round((item.count / percentageBase) * 100) : 0;
                return (
                  <div key={item.label} className="flex flex-col gap-1">
                    <div className="flex items-end justify-between text-sm">
                      <span className="font-medium text-[var(--ink)] break-words">{item.label}</span>
                      <div className="flex items-center gap-1.5 tabular-nums">
                        <span className="text-xs font-medium text-[var(--muted)]">{percentage}%</span>
                        <span className="font-bold text-[var(--ink)]">{item.count}</span>
                      </div>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface)]">
                      <div
                        className="h-full rounded-full transition-all duration-500 ease-out"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: 'var(--brand)',
                          opacity: 0.8 + (percentage / 100) * 0.2,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              Ingen “Andet”-events endnu.
            </p>
          )}
        </div>
      </div>

      {activeAchievement && (
        <AchievementModal achievement={activeAchievement} onClose={() => setActiveAchievement(null)} />
      )}
    </motion.div>
  );
}

function BreakdownScopeToggle({ value, onChange }) {
  const options = [
    { id: 'current', label: 'Nuværende run' },
    { id: 'all-time', label: 'All-time' },
  ];

  return (
    <div className="w-full rounded-2xl border border-[var(--line)] bg-[var(--subtle)] p-1">
      <div className="grid grid-cols-2 gap-1 w-full">
        {options.map((option) => {
          const isActive = option.id === value;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id)}
              className={`rounded-xl px-3 py-2 text-[11px] font-semibold transition ${isActive ? 'shadow-sm' : ''}`}
              style={
                isActive
                  ? { backgroundColor: 'var(--surface)', color: 'var(--brand)' }
                  : { color: 'var(--muted)' }
              }
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.target.style.color = 'var(--ink)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.target.style.color = 'var(--muted)';
                }
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StatTile({ value = 0, label }) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--subtle)] p-4 flex flex-col items-center justify-center gap-1">
      <span className="text-3xl font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
        {Number(value).toLocaleString('da-DK')}
      </span>
      <span className="text-[10px] font-bold uppercase tracking-wider text-center" style={{ color: 'var(--muted)' }}>
        {label}
      </span>
    </div>
  );
}

function Avatar({ image, emoji, gradient, initials, className = 'h-12 w-12 text-xl' }) {
  if (image) {
    return (
      <img
        src={image}
        alt="Profil"
        className={`rounded-full object-cover shadow-sm ${className}`}
      />
    );
  }

  if (emoji && gradient) {
    return (
      <div className={`flex items-center justify-center rounded-full bg-gradient-to-br ${gradient} shadow-sm ${className}`}>
        {emoji}
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-center rounded-full bg-gradient-to-br ${gradient || 'from-gray-400 to-gray-600'
        } font-semibold uppercase text-white shadow-sm ${className}`}
    >
      {initials || '??'}
    </div>
  );
}

function AchievementModal({ achievement, onClose }) {
  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/50 backdrop-blur-sm px-6 overflow-hidden"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4">
          <div className="flex items-center justify-center">
            <img
              src={achievement.image}
              alt={achievement.title}
              className="max-h-[70vh] w-full max-w-xs rounded-xl object-contain"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
