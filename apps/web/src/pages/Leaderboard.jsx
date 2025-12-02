import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDoc, doc } from 'firebase/firestore';
import { ACHIEVEMENTS } from '../config/achievements';
import Page from '../components/Page';
import PageTransition from '../components/PageTransition';
import { useChannel } from '../hooks/useChannel';
import { useAuth } from '../hooks/useAuth';
import { USE_MOCK_DATA } from '../config/env';
import { fetchLeaderboardProfiles, fetchUserRecentDrinks, clearLeaderboardCache, subscribeToLeaderboardProfiles } from '../services/leaderboardService';
import { db } from '../firebase';
import { resolveMockChannelKey, isMemberOfMockChannel, MOCK_CHANNEL_KEYS } from '../utils/mockChannels';

const leaderboardProfiles = [
  {
    id: 'sara-holm',
    username: 'saraholm',
    name: 'Sara Holm',
    initials: 'SH',
    profileEmoji: '🍹',
    profileGradient: 'from-rose-400 to-orange-500',
    avatarGradient: 'from-rose-400 to-orange-500',
    totalDrinks: 148,
    currentRunDrinkCount: 12,
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
    mockChannels: [MOCK_CHANNEL_KEYS.OPEN],
  },
  {
    id: 'mads-larsen',
    username: 'madslarsen',
    name: 'Mads Larsen',
    initials: 'ML',
    profileEmoji: '🍺',
    profileGradient: 'from-sky-400 to-indigo-500',
    avatarGradient: 'from-sky-400 to-indigo-500',
    totalDrinks: 131,
    currentRunDrinkCount: 8,
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
    mockChannels: [MOCK_CHANNEL_KEYS.OPEN],
  },
  {
    id: 'camilla-beck',
    username: 'camillabeck',
    name: 'Camilla Beck',
    initials: 'CB',
    profileEmoji: '🍸',
    profileGradient: 'from-purple-400 to-fuchsia-500',
    avatarGradient: 'from-purple-400 to-fuchsia-500',
    totalDrinks: 118,
    currentRunDrinkCount: 15,
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
    mockChannels: [MOCK_CHANNEL_KEYS.BALLADE],
  },
  {
    id: 'jonas-mikkelsen',
    username: 'jonasmikkelsen',
    name: 'Jonas Mikkelsen',
    initials: 'JM',
    profileEmoji: '🥃',
    profileGradient: 'from-emerald-400 to-teal-500',
    avatarGradient: 'from-emerald-400 to-teal-500',
    totalDrinks: 104,
    currentRunDrinkCount: 5,
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
    mockChannels: [MOCK_CHANNEL_KEYS.BALLADE],
  },
  {
    id: 'aline-thomsen',
    username: 'alinethomsen',
    name: 'Aline Thomsen',
    initials: 'AT',
    profileEmoji: '🍷',
    profileGradient: 'from-amber-400 to-red-500',
    avatarGradient: 'from-amber-400 to-red-500',
    totalDrinks: 97,
    currentRunDrinkCount: 7,
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
    mockChannels: [MOCK_CHANNEL_KEYS.OPEN],
  },
  {
    id: 'frederik-olsen',
    username: 'frederikolsen',
    name: 'Frederik Olsen',
    initials: 'FO',
    profileEmoji: '☕',
    profileGradient: 'from-slate-400 to-slate-600',
    avatarGradient: 'from-slate-400 to-slate-600',
    totalDrinks: 86,
    currentRunDrinkCount: 3,
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
    mockChannels: [MOCK_CHANNEL_KEYS.BALLADE],
  },
  {
    id: 'cecilie-knudsen',
    username: 'cecilieknudsen',
    name: 'Cecilie Knudsen',
    initials: 'CK',
    profileEmoji: '🍾',
    profileGradient: 'from-pink-400 to-rose-500',
    avatarGradient: 'from-pink-400 to-rose-500',
    totalDrinks: 82,
    currentRunDrinkCount: 6,
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
    mockChannels: [MOCK_CHANNEL_KEYS.OPEN],
  },
  {
    id: 'mathias-hansen',
    username: 'mathiashansen',
    name: 'Mathias Hansen',
    initials: 'MH',
    profileEmoji: '🍺',
    profileGradient: 'from-cyan-400 to-blue-500',
    avatarGradient: 'from-cyan-400 to-blue-500',
    totalDrinks: 75,
    currentRunDrinkCount: 4,
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
    mockChannels: [MOCK_CHANNEL_KEYS.BALLADE],
  },
];

const sortOptions = [
  { id: 'current-run-most', label: 'Topslugere' },
  { id: 'current-run-least', label: 'Letvægtere' },
];

const sortComparators = {
  'current-run-most': (a, b) => (b.currentRunDrinkCount || 0) - (a.currentRunDrinkCount || 0),
  'current-run-least': (a, b) => (a.currentRunDrinkCount || 0) - (b.currentRunDrinkCount || 0),
};

export default function Leaderboard() {
  // CHANNEL FILTERING: All data on this page is filtered by the active channel.
  // The activeChannelId comes from useChannel() hook, which provides selectedChannel?.id.
  // Only users who are members of the active channel (via joinedChannelIds array) are shown.
  const { selectedChannel } = useChannel();
  const { currentUser } = useAuth();
  const activeChannelId = selectedChannel?.id || null;
  const [sortMode, setSortMode] = useState('current-run-most');
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(!USE_MOCK_DATA);
  const [error, setError] = useState(null);
  const topSectionRef = useRef(null);
  const listContainerRef = useRef(null);

  // FIXED: Removed scroll locking logic. The .scroll-region is now the single scroll container.
  // This eliminates double-scroll conflicts and scroll lock issues on iOS.

  // CHANNEL FILTERING: Real-time subscription to leaderboard updates, scoped to activeChannelId.
  // The subscribeToLeaderboardProfiles function filters users by channel membership using
  // Firestore query: where('joinedChannelIds', 'array-contains', activeChannelId).
  // This ensures currentRunDrinkCount updates immediately when drinks are logged,
  // and only shows users from the currently selected channel.
  useEffect(() => {
    if (USE_MOCK_DATA) {
      const channelKey = resolveMockChannelKey(selectedChannel);
      const filteredProfiles = leaderboardProfiles.filter(
        (profile) =>
          profile.checkedIn !== false &&
          isMemberOfMockChannel(profile.mockChannels, channelKey)
      );
      setProfiles(filteredProfiles);
      setLoading(false);
      return;
    }

    if (!activeChannelId) {
      setProfiles([]);
      setLoading(true);
      setError(null);
      return;
    }

    let isMounted = true;
    let unsubscribe = null;

    // Set up real-time subscription to user documents in the channel
    // This ensures currentRunDrinkCount updates live when drinks are logged
    const currentUserId = currentUser?.uid || null;

    setLoading(true);
    setError(null);
    setProfiles([]);

    // CHANNEL FILTERING: subscribeToLeaderboardProfiles filters by activeChannelId.
    // The subscription uses Firestore query with where('joinedChannelIds', 'array-contains', activeChannelId)
    // to ensure only users from the active channel are included in the leaderboard.
    unsubscribe = subscribeToLeaderboardProfiles(
      activeChannelId,
      currentUserId,
      (updatedProfiles) => {
        // Callback called whenever user documents change (e.g., when drinks are logged)
        // All profiles in updatedProfiles are already filtered to the active channel
        if (isMounted) {
          setProfiles(updatedProfiles);
          setLoading(false);
          setError(null);
        }
      },
      (err) => {
        // Error callback for subscription errors
        console.error('Error in leaderboard subscription:', err);
        if (isMounted) {
          setError('Kunne ikke indlæse leaderboard');
          setProfiles([]);
          setLoading(false);
        }
      }
    );

    // Cleanup: unsubscribe when component unmounts or channel changes
    return () => {
      isMounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [activeChannelId, selectedChannel?.name, selectedChannel?.isDefault, currentUser?.uid]);

  // Visibility-based refresh: refresh leaderboard when page becomes visible if cache is stale
  // This catches edge cases where user switches tabs and comes back, ensuring fresh data
  useEffect(() => {
    if (USE_MOCK_DATA || !activeChannelId) return;

    const handleVisibilityChange = () => {
      // Only refresh if page becomes visible and we have a subscription
      // The subscription will automatically update, but this ensures we don't miss updates
      // that happened while the tab was hidden
      if (document.visibilityState === 'visible') {
        // Clear cache to force fresh data on next subscription update
        clearLeaderboardCache(activeChannelId);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [activeChannelId]);

  const sortedProfiles = useMemo(() => {
    const comparator = sortComparators[sortMode] || sortComparators['current-run-most'];
    return [...profiles].sort(comparator);
  }, [profiles, sortMode]);

  return (
    <PageTransition>
      <Page title="Topliste">
        <div className="flex flex-col gap-4">
          <div ref={topSectionRef} className="shrink-0 space-y-4 pt-1">
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              Følg med i hvem der har tracket flest drinks i Sladesh Crew. Tryk på et kort for at se deres
              seneste aktivitet.
            </p>

            <SortToggle options={sortOptions} active={sortMode} onChange={setSortMode} />
          </div>

          <div
            ref={listContainerRef}
            className="-mr-3 pr-3 pb-6"
          >
            <div className="space-y-3">
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
                    onSelect={(p) => navigate(`/profile/${p.id}`, { state: { profile: p, from: 'leaderboard' } })}
                    isActive={false}
                    sortMode={sortMode}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </Page>
    </PageTransition>
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
              className={`rounded-2xl px-3 py-2 text-sm font-medium transition ${isActive ? 'shadow-sm' : ''
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

function ProfileCard({ profile, rank, onSelect, isActive, sortMode }) {
  const rankBadge = `#${rank}`;
  const displayName = profile.username || profile.name || 'Ukendt';

  // DATA FLOW: currentRunDrinkCount is displayed here
  // It comes from the profile object, which is built in leaderboardService.js buildProfileFromUserData()
  // The profile is updated in real-time via subscribeToLeaderboardProfiles() when user documents change
  // Defensive check: fallback to 0 if value is missing (prevents "stuck at 0" from showing undefined/null)
  // The value originates from userService.js addDrink() where it's computed using Firestore increment
  const displayValue = profile.currentRunDrinkCount || 0;

  const valueFormatted = displayValue.toLocaleString('da-DK');

  return (
    <button
      type="button"
      onClick={() => onSelect(profile)}
      className={`w-full text-left transition ${isActive ? '-translate-y-0.5' : 'hover:-translate-y-0.5'}`}
    >
      <div
        className={`relative grid grid-cols-[auto_auto_1fr_auto] items-center gap-4 rounded-3xl border border-[var(--line)] p-4 shadow-sm transition ${isActive ? 'ring-2 ring-[var(--brand)] ring-offset-2' : 'hover:shadow-md'
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

        <Avatar
          emoji={profile.profileEmoji}
          gradient={profile.profileGradient || profile.avatarGradient}
          initials={profile.initials}
        />

        <span className="min-w-0 truncate text-sm font-semibold" style={{ color: 'var(--ink)' }}>{displayName}</span>

        <div className="text-right leading-tight">
          <span className="block text-base font-semibold tabular-nums" style={{ color: 'var(--ink)' }}>{valueFormatted}</span>
          <span className="block text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Drikke</span>
        </div>
      </div>
    </button>
  );
}

function Avatar({ emoji, gradient, initials, className = 'h-12 w-12 text-xl' }) {
  // Use emoji if available, otherwise fall back to initials
  if (emoji && gradient) {
    return (
      <div
        className={`flex items-center justify-center rounded-full bg-gradient-to-br ${gradient} shadow-sm ${className}`}
      >
        {emoji}
      </div>
    );
  }

  // Fallback to initials if emoji/gradient not available
  return (
    <div
      className={`flex items-center justify-center rounded-full bg-gradient-to-br ${gradient || 'from-gray-400 to-gray-600'} font-semibold uppercase text-white shadow-sm ${className}`}
    >
      {initials || '??'}
    </div>
  );
}
