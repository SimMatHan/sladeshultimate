import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Page from '../components/Page';
import { useChannel } from '../hooks/useChannel';
import { USE_MOCK_DATA } from '../config/env';
import { fetchLeaderboardProfiles, fetchUserRecentDrinks } from '../services/leaderboardService';

const leaderboardProfiles = [
  {
    id: 'sara-holm',
    name: 'Sara Holm',
    initials: 'SH',
    avatarGradient: 'from-rose-400 to-orange-500',
    totalDrinks: 148,
    weeklyAverage: 17,
    streakDays: 8,
    topDrink: 'Sladesh shot',
    favoriteSpot: 'HQ Bar',
    drinkBreakdown: [
      { id: 'sara-shot', label: 'Sladesh shots', count: 62 },
      { id: 'sara-beer', label: 'Craft beers', count: 44 },
      { id: 'sara-cocktail', label: 'Cocktails', count: 27 },
      { id: 'sara-wine', label: 'Natural wine', count: 15 },
    ],
    recentDrinks: [
      { id: 'sara-recent-1', label: 'Sladesh shot', timestamp: 'I dag • 20:14' },
      { id: 'sara-recent-2', label: 'Passion spritz', timestamp: 'I går • 23:02' },
      { id: 'sara-recent-3', label: 'Cold IPA', timestamp: 'I går • 21:38' },
    ],
  },
  {
    id: 'mads-larsen',
    name: 'Mads Larsen',
    initials: 'ML',
    avatarGradient: 'from-sky-400 to-indigo-500',
    totalDrinks: 131,
    weeklyAverage: 15,
    streakDays: 5,
    topDrink: 'Kolde øl',
    favoriteSpot: 'Ølbaren',
    drinkBreakdown: [
      { id: 'mads-lager', label: 'Lager', count: 58 },
      { id: 'mads-ipa', label: 'IPA', count: 36 },
      { id: 'mads-shot', label: 'Sladesh shots', count: 21 },
      { id: 'mads-other', label: 'Andre', count: 16 },
    ],
    recentDrinks: [
      { id: 'mads-recent-1', label: 'Pilsner', timestamp: 'I dag • 19:45' },
      { id: 'mads-recent-2', label: 'Mosaik IPA', timestamp: 'I går • 22:10' },
      { id: 'mads-recent-3', label: 'Sladesh shot', timestamp: 'I går • 21:58' },
    ],
  },
  {
    id: 'camilla-beck',
    name: 'Camilla Beck',
    initials: 'CB',
    avatarGradient: 'from-purple-400 to-fuchsia-500',
    totalDrinks: 118,
    weeklyAverage: 11,
    streakDays: 9,
    topDrink: 'Sour cocktails',
    favoriteSpot: 'Bar Nexus',
    drinkBreakdown: [
      { id: 'camilla-cocktail', label: 'Cocktails', count: 54 },
      { id: 'camilla-shot', label: 'Sladesh shots', count: 28 },
      { id: 'camilla-seltzer', label: 'Hard seltzer', count: 20 },
      { id: 'camilla-bubbles', label: 'Bobler', count: 16 },
    ],
    recentDrinks: [
      { id: 'camilla-recent-1', label: 'Raspberry sour', timestamp: 'I dag • 18:55' },
      { id: 'camilla-recent-2', label: 'Sladesh shot', timestamp: 'I går • 23:40' },
      { id: 'camilla-recent-3', label: 'Mango seltzer', timestamp: 'I går • 21:12' },
    ],
  },
  {
    id: 'jonas-mikkelsen',
    name: 'Jonas Mikkelsen',
    initials: 'JM',
    avatarGradient: 'from-emerald-400 to-teal-500',
    totalDrinks: 104,
    weeklyAverage: 10,
    streakDays: 6,
    topDrink: 'Gin & tonic',
    favoriteSpot: 'Stuen',
    drinkBreakdown: [
      { id: 'jonas-gt', label: 'Gin & tonic', count: 38 },
      { id: 'jonas-beer', label: 'Pilsner', count: 32 },
      { id: 'jonas-shot', label: 'Sladesh shots', count: 18 },
      { id: 'jonas-other', label: 'Mocktails', count: 16 },
    ],
    recentDrinks: [
      { id: 'jonas-recent-1', label: 'Gin & tonic', timestamp: 'I dag • 19:05' },
      { id: 'jonas-recent-2', label: 'Classic pilsner', timestamp: 'I går • 22:47' },
      { id: 'jonas-recent-3', label: 'Cucumber cooler', timestamp: 'I går • 17:30' },
    ],
  },
  {
    id: 'aline-thomsen',
    name: 'Aline Thomsen',
    initials: 'AT',
    avatarGradient: 'from-amber-400 to-red-500',
    totalDrinks: 97,
    weeklyAverage: 9,
    streakDays: 4,
    topDrink: 'Aperol spritz',
    favoriteSpot: 'Tagterrassen',
    drinkBreakdown: [
      { id: 'aline-spritz', label: 'Spritz cocktails', count: 42 },
      { id: 'aline-rose', label: 'Rosé', count: 26 },
      { id: 'aline-shot', label: 'Sladesh shots', count: 17 },
      { id: 'aline-beer', label: 'Lette øl', count: 12 },
    ],
    recentDrinks: [
      { id: 'aline-recent-1', label: 'Aperol spritz', timestamp: 'I dag • 17:20' },
      { id: 'aline-recent-2', label: 'Rosé', timestamp: 'I går • 20:35' },
      { id: 'aline-recent-3', label: 'Sladesh shot', timestamp: 'I går • 19:55' },
    ],
  },
  {
    id: 'frederik-olsen',
    name: 'Frederik Olsen',
    initials: 'FO',
    avatarGradient: 'from-slate-400 to-slate-600',
    totalDrinks: 86,
    weeklyAverage: 8,
    streakDays: 3,
    topDrink: 'Irish coffee',
    favoriteSpot: 'Lounge',
    drinkBreakdown: [
      { id: 'frederik-coffee', label: 'Specialty coffee', count: 31 },
      { id: 'frederik-stout', label: 'Stouts', count: 22 },
      { id: 'frederik-shot', label: 'Sladesh shots', count: 18 },
      { id: 'frederik-other', label: 'Andre', count: 15 },
    ],
    recentDrinks: [
      { id: 'frederik-recent-1', label: 'Irish coffee', timestamp: 'I dag • 16:45' },
      { id: 'frederik-recent-2', label: 'Nitro stout', timestamp: 'I går • 21:17' },
      { id: 'frederik-recent-3', label: 'Sladesh shot', timestamp: 'I går • 20:11' },
    ],
  },
  {
    id: 'cecilie-knudsen',
    name: 'Cecilie Knudsen',
    initials: 'CK',
    avatarGradient: 'from-pink-400 to-rose-500',
    totalDrinks: 82,
    weeklyAverage: 7,
    streakDays: 5,
    topDrink: 'Paloma',
    favoriteSpot: 'Vinterhaven',
    drinkBreakdown: [
      { id: 'cecilie-cocktail', label: 'Cocktails', count: 36 },
      { id: 'cecilie-bubbles', label: 'Bobler', count: 24 },
      { id: 'cecilie-shot', label: 'Sladesh shots', count: 12 },
      { id: 'cecilie-seltzer', label: 'Hard seltzer', count: 10 },
    ],
    recentDrinks: [
      { id: 'cecilie-recent-1', label: 'Paloma', timestamp: 'I dag • 18:10' },
      { id: 'cecilie-recent-2', label: 'Celebration bubbles', timestamp: 'I går • 22:41' },
      { id: 'cecilie-recent-3', label: 'Sladesh shot', timestamp: 'I går • 21:03' },
    ],
  },
  {
    id: 'mathias-hansen',
    name: 'Mathias Hansen',
    initials: 'MH',
    avatarGradient: 'from-cyan-400 to-blue-500',
    totalDrinks: 75,
    weeklyAverage: 6,
    streakDays: 2,
    topDrink: 'Mikkeller IPA',
    favoriteSpot: 'Taproom',
    drinkBreakdown: [
      { id: 'mathias-ipa', label: 'IPA', count: 34 },
      { id: 'mathias-lager', label: 'Lager', count: 20 },
      { id: 'mathias-shot', label: 'Sladesh shots', count: 11 },
      { id: 'mathias-other', label: 'Alkoholfri', count: 10 },
    ],
    recentDrinks: [
      { id: 'mathias-recent-1', label: 'Hop Shop IPA', timestamp: 'I dag • 17:55' },
      { id: 'mathias-recent-2', label: 'Summer lager', timestamp: 'I går • 19:22' },
      { id: 'mathias-recent-3', label: 'Sladesh shot', timestamp: 'I går • 18:49' },
    ],
  },
];

const sortOptions = [
  { id: 'total-desc', label: 'Flest drinks' },
  { id: 'total-asc', label: 'Færrest drinks' },
  { id: 'name-asc', label: 'Navn A-Å' },
];

const sortComparators = {
  'total-desc': (a, b) => b.totalDrinks - a.totalDrinks,
  'total-asc': (a, b) => a.totalDrinks - b.totalDrinks,
  'name-asc': (a, b) => a.name.localeCompare(b.name, 'da'),
};

export default function Leaderboard() {
  const { selectedChannel } = useChannel();
  const [sortMode, setSortMode] = useState('total-desc');
  const [selectedProfile, setSelectedProfile] = useState(null);
  const topSectionRef = useRef(null);
  const [listHeight, setListHeight] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(!USE_MOCK_DATA);
  const [error, setError] = useState(null);

  // Fetch leaderboard data from Firestore when not using mock data
  useEffect(() => {
    if (USE_MOCK_DATA) {
      setProfiles(leaderboardProfiles);
      setLoading(false);
      return;
    }

    const loadProfiles = async () => {
      try {
        setLoading(true);
        setError(null);
        const channelId = selectedChannel && !selectedChannel.isDefault ? selectedChannel.id : null;
        const fetchedProfiles = await fetchLeaderboardProfiles(channelId);
        setProfiles(fetchedProfiles);
      } catch (err) {
        console.error('Error loading leaderboard:', err);
        setError('Kunne ikke indlæse leaderboard');
        setProfiles([]);
      } finally {
        setLoading(false);
      }
    };

    loadProfiles();
  }, [selectedChannel]);

  // Fetch recent drinks when a profile is selected (only in production mode)
  useEffect(() => {
    if (USE_MOCK_DATA || !selectedProfile) return;

    const loadRecentDrinks = async () => {
      try {
        const recentDrinks = await fetchUserRecentDrinks(selectedProfile.id, 3);
        setSelectedProfile(prev => ({
          ...prev,
          recentDrinks: recentDrinks.length > 0 ? recentDrinks : prev.recentDrinks
        }));
      } catch (err) {
        console.error('Error loading recent drinks:', err);
      }
    };

    loadRecentDrinks();
  }, [selectedProfile?.id, USE_MOCK_DATA]);

  const sortedProfiles = useMemo(() => {
    const comparator = sortComparators[sortMode] || sortComparators['total-desc'];
    return [...profiles].sort(comparator);
  }, [profiles, sortMode]);

  const updateListHeight = useCallback(() => {
    if (!topSectionRef.current) {
      return;
    }

    const rect = topSectionRef.current.getBoundingClientRect();
    // Account for bottom padding (16px) + safe area + extra spacing for visual comfort
    const safeAreaBottom = Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-bottom)')
    ) || 0;
    const reservedBottom = 16 + safeAreaBottom + 24; // 16px padding + safe area + 24px visual spacing
    const available = window.innerHeight - rect.bottom - reservedBottom;

    setListHeight(Math.max(160, available));
  }, []);

  useEffect(() => {
    if (!selectedProfile) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setSelectedProfile(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedProfile]);

  useEffect(() => {
    updateListHeight();

    window.addEventListener('resize', updateListHeight);
    window.addEventListener('orientationchange', updateListHeight);

    return () => {
      window.removeEventListener('resize', updateListHeight);
      window.removeEventListener('orientationchange', updateListHeight);
    };
  }, [updateListHeight]);

  useEffect(() => {
    const frame = requestAnimationFrame(updateListHeight);
    return () => cancelAnimationFrame(frame);
  }, [sortMode, updateListHeight]);

  return (
    <Page title="Leaderboard">
      <div className="flex flex-1 flex-col gap-4">
        <div ref={topSectionRef} className="shrink-0 space-y-4 pb-2 pt-1">
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Følg med i hvem der har tracket flest drinks i Sladesh Crew. Tryk på et kort for at se deres
            seneste aktivitet.
          </p>

          <SortToggle options={sortOptions} active={sortMode} onChange={setSortMode} />
        </div>

        <div className="min-h-0 flex-1 -mr-3 overflow-hidden pr-1">
          <div
            className="h-full space-y-3 overflow-y-auto pr-3 pb-6"
            style={{
              scrollBehavior: 'smooth',
              ...(listHeight ? { maxHeight: `${listHeight}px` } : {}),
            }}
          >
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-sm" style={{ color: 'var(--muted)' }}>Indlæser...</p>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-sm" style={{ color: 'var(--muted)' }}>{error}</p>
              </div>
            ) : sortedProfiles.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-sm" style={{ color: 'var(--muted)' }}>
                  Ingen data endnu. Vær den første til at tracke drinks!
                </p>
              </div>
            ) : (
              sortedProfiles.map((profile, index) => (
                <ProfileCard
                  key={profile.id}
                  profile={profile}
                  rank={index + 1}
                  onSelect={setSelectedProfile}
                  isActive={selectedProfile?.id === profile.id}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {selectedProfile ? (
        <ProfileDetailSheet profile={selectedProfile} onClose={() => setSelectedProfile(null)} />
      ) : null}
    </Page>
  );
}

function SortToggle({ options, active, onChange }) {
  return (
    <div className="rounded-3xl border border-[var(--line)] bg-[var(--subtle)] p-1">
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map((option) => {
          const isActive = option.id === active;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id)}
              className={`rounded-2xl px-3 py-2 text-sm font-medium transition ${
                isActive ? 'shadow-sm' : ''
              }`}
              style={isActive ? {
                backgroundColor: 'var(--surface)',
                color: 'var(--brand)'
              } : {
                color: 'var(--muted)'
              }}
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

function ProfileCard({ profile, rank, onSelect, isActive }) {
  const rankBadge = `#${rank}`;
  const totalFormatted = profile.totalDrinks.toLocaleString('da-DK');

  return (
    <button
      type="button"
      onClick={() => onSelect(profile)}
      className={`w-full text-left transition ${isActive ? '-translate-y-0.5' : 'hover:-translate-y-0.5'}`}
    >
      <div
        className={`relative grid grid-cols-[auto_auto_1fr_auto] items-center gap-4 rounded-3xl border border-[var(--line)] p-4 shadow-sm transition ${
          isActive ? 'ring-2 ring-[var(--brand)] ring-offset-2' : 'hover:shadow-md'
        }`}
        style={{
          backgroundColor: 'var(--surface)',
        }}
      >
        <span 
          className="flex h-10 w-10 items-center justify-center rounded-full border bg-[var(--subtle)] text-[13px] font-semibold"
          style={{ 
            borderColor: 'var(--line)',
            color: 'var(--ink)'
          }}
        >
          {rankBadge}
        </span>

        <Avatar initials={profile.initials} gradient={profile.avatarGradient} />

        <span className="min-w-0 truncate text-sm font-semibold" style={{ color: 'var(--ink)' }}>{profile.name}</span>

        <div className="text-right leading-tight">
          <span className="block text-base font-semibold tabular-nums" style={{ color: 'var(--ink)' }}>{totalFormatted}</span>
          <span className="block text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Drinks</span>
        </div>
      </div>
    </button>
  );
}

function Avatar({ initials, gradient }) {
  return (
    <div
      className={`flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br ${gradient} text-sm font-semibold uppercase text-white shadow-sm`}
    >
      {initials}
    </div>
  );
}

function ProfileDetailSheet({ profile, onClose }) {
  const breakdownTotal = profile.drinkBreakdown.reduce((sum, item) => sum + item.count, 0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center" onClick={onClose}>
      <div
        className={`absolute inset-0 bg-black/45 transition-opacity duration-200 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
      />

      <div className="relative z-10 flex w-full max-w-full justify-center">
        <div
          className={`relative flex h-full w-full flex-col overflow-hidden rounded-b-[32px] shadow-2xl transition-transform duration-300 ease-out ${
            isVisible ? 'translate-y-0' : '-translate-y-full'
          }`}
          style={{ 
            height: 'min(88vh, 640px)',
            backgroundColor: 'var(--surface)'
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <header 
            className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-6 pb-4 pt-6"
            style={{ backgroundColor: 'var(--surface)' }}
          >
            <div>
              <h2 className="text-lg font-semibold" style={{ color: 'var(--ink)' }}>{profile.name}</h2>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                {profile.totalDrinks.toLocaleString('da-DK')} drinks totalt · {profile.weeklyAverage} pr. uge ·{' '}
                {profile.streakDays} dages streak
              </p>
            </div>
            <button
              type="button"
              aria-label="Luk detaljer"
              onClick={onClose}
              className="rounded-full border border-transparent p-2 text-xl leading-none transition"
              style={{ 
                color: 'var(--muted)'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = 'var(--subtle)';
                e.target.style.color = 'var(--ink)';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = 'transparent';
                e.target.style.color = 'var(--muted)';
              }}
            >
              ×
            </button>
          </header>

          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Fordeling af drinks</h3>
              <ul className="space-y-3">
                {profile.drinkBreakdown.map((item) => {
                  const percentage = breakdownTotal ? Math.round((item.count / breakdownTotal) * 100) : 0;
                  return (
                    <li key={item.id} className="rounded-2xl border border-[var(--line)] bg-[var(--subtle)] p-3">
                      <div className="flex items-center justify-between text-sm font-medium" style={{ color: 'var(--ink)' }}>
                        <span>{item.label}</span>
                        <span>{item.count}</span>
                      </div>
                      <div className="mt-2 h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: 'var(--line)' }}>
                        <div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${percentage}%` }} />
                      </div>
                      <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>{percentage}% af trackede drinks</p>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Seneste aktivitet</h3>
              {profile.recentDrinks && profile.recentDrinks.length > 0 ? (
                <ul className="space-y-2">
                  {profile.recentDrinks.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between rounded-2xl border border-[var(--line)] px-3 py-2"
                      style={{ backgroundColor: 'var(--surface)' }}
                    >
                      <span className="text-sm" style={{ color: 'var(--ink)' }}>{item.label}</span>
                      <span className="text-xs" style={{ color: 'var(--muted)' }}>{item.timestamp}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm" style={{ color: 'var(--muted)' }}>Ingen seneste aktivitet</p>
              )}
            </section>
          </div>

          <div 
            className="border-t border-[var(--line)] px-6 py-5"
            style={{ backgroundColor: 'var(--surface)' }}
          >
            <button
              type="button"
              onClick={onClose}
              className="inline-flex w-full justify-center rounded-2xl px-4 py-3 text-sm font-semibold shadow-sm transition hover:opacity-90"
              style={{ 
                backgroundColor: 'var(--brand)',
                color: 'var(--brand-ink)'
              }}
            >
              Luk
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
