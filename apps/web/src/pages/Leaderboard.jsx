import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDoc, doc } from 'firebase/firestore';
import { ACHIEVEMENTS } from '../config/achievements';
import { useSladesh, SLADESH_STATUS } from '../contexts/SladeshContext';
import Page from '../components/Page';
import PageTransition from '../components/PageTransition';
import { useChannel } from '../hooks/useChannel';
import { useAuth } from '../hooks/useAuth';
import { USE_MOCK_DATA } from '../config/env';
import { fetchLeaderboardProfiles, fetchUserRecentDrinks, clearLeaderboardCache, subscribeToLeaderboardProfiles } from '../services/leaderboardService';
import { db } from '../firebase';
import { resolveMockChannelKey, isMemberOfMockChannel, MOCK_CHANNEL_KEYS } from '../utils/mockChannels';

const ACHIEVEMENT_LOOKUP = ACHIEVEMENTS.reduce((acc, achievement) => {
  acc[achievement.id] = achievement;
  return acc;
}, {});

const leaderboardProfiles = [
  {
    id: 'sara-holm',
    username: 'saraholm',
    name: 'Sara Holm',
    initials: 'SH',
    profileEmoji: '­ƒì╣',
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
    achievements: {
      reset_confirmed: { count: 3 },
      obeerma: { count: 5 },
      full_bender: { count: 2 },
      like_fine_wine: { count: 4 },
    },
    recentDrinks: [
      { id: 'sara-recent-1', label: 'Sladesh shot', timestamp: 'I dag ÔÇó 20:14' },
      { id: 'sara-recent-2', label: 'Passion spritz', timestamp: 'I g├Ñr ÔÇó 23:02' },
      { id: 'sara-recent-3', label: 'Cold IPA', timestamp: 'I g├Ñr ÔÇó 21:38' },
    ],
    mockChannels: [MOCK_CHANNEL_KEYS.OPEN],
  },
  {
    id: 'mads-larsen',
    username: 'madslarsen',
    name: 'Mads Larsen',
    initials: 'ML',
    profileEmoji: '­ƒì║',
    profileGradient: 'from-sky-400 to-indigo-500',
    avatarGradient: 'from-sky-400 to-indigo-500',
    totalDrinks: 131,
    currentRunDrinkCount: 8,
    weeklyAverage: 15,
    streakDays: 5,
    topDrink: 'Kolde ├©l',
    favoriteSpot: '├ÿlbaren',
    drinkBreakdown: [
      { id: 'mads-lager', label: 'Lager', count: 58 },
      { id: 'mads-ipa', label: 'IPA', count: 36 },
      { id: 'mads-shot', label: 'Sladesh shots', count: 21 },
      { id: 'mads-other', label: 'Andre', count: 16 },
    ],
    achievements: {
      obeerma: { count: 2 },
      full_bender: { count: 1 },
      like_fine_wine: { count: 1 },
    },
    recentDrinks: [
      { id: 'mads-recent-1', label: 'Pilsner', timestamp: 'I dag ÔÇó 19:45' },
      { id: 'mads-recent-2', label: 'Mosaik IPA', timestamp: 'I g├Ñr ÔÇó 22:10' },
      { id: 'mads-recent-3', label: 'Sladesh shot', timestamp: 'I g├Ñr ÔÇó 21:58' },
    ],
    mockChannels: [MOCK_CHANNEL_KEYS.OPEN],
  },
  {
    id: 'camilla-beck',
    username: 'camillabeck',
    name: 'Camilla Beck',
    initials: 'CB',
    profileEmoji: '­ƒì©',
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
    achievements: {
      full_bender: { count: 3 },
      obeerma: { count: 1 },
    },
    recentDrinks: [
      { id: 'camilla-recent-1', label: 'Raspberry sour', timestamp: 'I dag ÔÇó 18:55' },
      { id: 'camilla-recent-2', label: 'Sladesh shot', timestamp: 'I g├Ñr ÔÇó 23:40' },
      { id: 'camilla-recent-3', label: 'Mango seltzer', timestamp: 'I g├Ñr ÔÇó 21:12' },
    ],
    mockChannels: [MOCK_CHANNEL_KEYS.BALLADE],
  },
  {
    id: 'jonas-mikkelsen',
    username: 'jonasmikkelsen',
    name: 'Jonas Mikkelsen',
    initials: 'JM',
    profileEmoji: '­ƒÑâ',
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
    achievements: {
      reset_confirmed: { count: 1 },
      like_fine_wine: { count: 2 },
    },
    recentDrinks: [
      { id: 'jonas-recent-1', label: 'Gin & tonic', timestamp: 'I dag ÔÇó 19:05' },
      { id: 'jonas-recent-2', label: 'Classic pilsner', timestamp: 'I g├Ñr ÔÇó 22:47' },
      { id: 'jonas-recent-3', label: 'Cucumber cooler', timestamp: 'I g├Ñr ÔÇó 17:30' },
    ],
    mockChannels: [MOCK_CHANNEL_KEYS.BALLADE],
  },
  {
    id: 'aline-thomsen',
    username: 'alinethomsen',
    name: 'Aline Thomsen',
    initials: 'AT',
    profileEmoji: '­ƒìÀ',
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
      { id: 'aline-rose', label: 'Ros├®', count: 26 },
      { id: 'aline-shot', label: 'Sladesh shots', count: 17 },
      { id: 'aline-beer', label: 'Lette ├©l', count: 12 },
    ],
    recentDrinks: [
      { id: 'aline-recent-1', label: 'Aperol spritz', timestamp: 'I dag ÔÇó 17:20' },
      { id: 'aline-recent-2', label: 'Ros├®', timestamp: 'I g├Ñr ÔÇó 20:35' },
      { id: 'aline-recent-3', label: 'Sladesh shot', timestamp: 'I g├Ñr ÔÇó 19:55' },
    ],
    mockChannels: [MOCK_CHANNEL_KEYS.OPEN],
  },
  {
    id: 'frederik-olsen',
    username: 'frederikolsen',
    name: 'Frederik Olsen',
    initials: 'FO',
    profileEmoji: 'Ôÿò',
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
      { id: 'frederik-recent-1', label: 'Irish coffee', timestamp: 'I dag ÔÇó 16:45' },
      { id: 'frederik-recent-2', label: 'Nitro stout', timestamp: 'I g├Ñr ÔÇó 21:17' },
      { id: 'frederik-recent-3', label: 'Sladesh shot', timestamp: 'I g├Ñr ÔÇó 20:11' },
    ],
    mockChannels: [MOCK_CHANNEL_KEYS.BALLADE],
  },
  {
    id: 'cecilie-knudsen',
    username: 'cecilieknudsen',
    name: 'Cecilie Knudsen',
    initials: 'CK',
    profileEmoji: '­ƒì¥',
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
      { id: 'cecilie-recent-1', label: 'Paloma', timestamp: 'I dag ÔÇó 18:10' },
      { id: 'cecilie-recent-2', label: 'Celebration bubbles', timestamp: 'I g├Ñr ÔÇó 22:41' },
      { id: 'cecilie-recent-3', label: 'Sladesh shot', timestamp: 'I g├Ñr ÔÇó 21:03' },
    ],
    mockChannels: [MOCK_CHANNEL_KEYS.OPEN],
  },
  {
    id: 'mathias-hansen',
    username: 'mathiashansen',
    name: 'Mathias Hansen',
    initials: 'MH',
    profileEmoji: '­ƒì║',
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
      { id: 'mathias-recent-1', label: 'Hop Shop IPA', timestamp: 'I dag ÔÇó 17:55' },
      { id: 'mathias-recent-2', label: 'Summer lager', timestamp: 'I g├Ñr ÔÇó 19:22' },
      { id: 'mathias-recent-3', label: 'Sladesh shot', timestamp: 'I g├Ñr ÔÇó 18:49' },
    ],
    mockChannels: [MOCK_CHANNEL_KEYS.BALLADE],
  },
];

const sortOptions = [
  { id: 'current-run-most', label: 'Topslugere' },
  { id: 'current-run-least', label: 'Letv├ªgtere' },
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
  const [achievementsReady, setAchievementsReady] = useState(false);
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
          setError('Kunne ikke indl├ªse leaderboard');
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

  useEffect(() => {
    // Defer achievement rendering to avoid initial layout shift when the page mounts
    if (!loading) {
      const id = requestAnimationFrame(() => setAchievementsReady(true));
      return () => {
        cancelAnimationFrame(id);
        setAchievementsReady(false);
      };
    }
    setAchievementsReady(false);
  }, [loading]);

  return (
    <PageTransition>
      <Page title="Topliste">
        <div className="flex flex-col gap-4">
          <div ref={topSectionRef} className="shrink-0 space-y-4 pt-1">
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              Følg med i hvem der har tracket flest drinks i Sladesh Crew. Tryk på en bruger for at se deres
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
                    achievementsReady={achievementsReady}
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

function ProfileCard({ profile, rank, onSelect, isActive, sortMode, achievementsReady }) {
  const rankBadge = `#${rank}`;
  const displayName = profile.username || profile.name || 'Ukendt';

  // DATA FLOW: currentRunDrinkCount is displayed here
  // It comes from the profile object, which is built in leaderboardService.js buildProfileFromUserData()
  // The profile is updated in real-time via subscribeToLeaderboardProfiles() when user documents change
  // Defensive check: fallback to 0 if value is missing (prevents "stuck at 0" from showing undefined/null)
  // The value originates from userService.js addDrink() where it's computed using Firestore increment
  const displayValue = profile.currentRunDrinkCount || 0;
  const valueFormatted = displayValue.toLocaleString('da-DK');

  const { getUserSladeshStatus } = useSladesh();
  const sladeshStatus = getUserSladeshStatus(profile.id);

  const getSladeshBadge = () => {
    if (!sladeshStatus) return null;

    // If completed/failed, maybe we don't show it prominently, or we show "Last Sladesh: Won"
    // For now, let's focus on active ones or recent ones

    const isSender = sladeshStatus.senderId === profile.id;
    const isReceiver = sladeshStatus.receiverId === profile.id;

    if (sladeshStatus.status === SLADESH_STATUS.IN_PROGRESS) {
      if (isReceiver) {
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">
            Sladeshed
          </span>
        );
      }
      if (isSender) {
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
            ­Sender
          </span>
        );
      }
    }

    if (sladeshStatus.status === SLADESH_STATUS.COMPLETED) {
      // Only show if recent (e.g. < 1 hour ago) - for now just show it
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
          Sladesh Won
        </span>
      );
    }

    if (sladeshStatus.status === SLADESH_STATUS.FAILED) {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-600 dark:bg-gray-800 dark:text-gray-400">
          Sladesh Lost
        </span>
      );
    }

    return null;
  };

  return (
    <button
      type="button"
      onClick={() => onSelect(profile)}
      className={`w-full text-left transition ${isActive ? '-translate-y-0.5' : 'hover:-translate-y-0.5'}`}
    >
      <div
        className={`relative grid grid-cols-[auto_auto_1fr_auto] grid-rows-[auto_auto] items-start gap-x-4 gap-y-2 rounded-3xl border border-[var(--line)] p-4 shadow-sm transition ${isActive ? 'ring-2 ring-[var(--brand)] ring-offset-2' : 'hover:shadow-md'
          }`}
        style={{
          backgroundColor: 'var(--surface)',
        }}
      >
        <div className="row-span-2 flex items-center self-stretch">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-full border bg-[var(--subtle)] text-[13px] font-semibold"
            style={{
              borderColor: 'var(--line)',
              color: 'var(--ink)'
            }}
          >
            {rankBadge}
          </span>
        </div>

        <div className="row-span-2 flex items-center self-stretch">
          <Avatar
            emoji={profile.profileEmoji}
            gradient={profile.profileGradient || profile.avatarGradient}
            initials={profile.initials}
          />
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="block truncate text-sm font-semibold" style={{ color: 'var(--ink)' }}>{displayName}</span>
            {getSladeshBadge()}
          </div>
        </div>

        <div className="row-span-2 self-stretch text-right leading-tight flex flex-col items-end justify-center">
          <span className="block text-base font-semibold tabular-nums" style={{ color: 'var(--ink)' }}>{valueFormatted}</span>
          <span className="block text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Drikke</span>
        </div>

        <AchievementEmblems
          achievements={profile.achievements}
          ready={achievementsReady}
          className="col-start-3 col-span-1 w-full pt-1"
        />
      </div>
    </button>
  );
}

function AchievementEmblems({ achievements, ready, className = '' }) {
  const containerClassName = ['flex flex-wrap items-center gap-1.5', className].filter(Boolean).join(' ');
  const placeholderClassName = ['min-h-[28px]', className].filter(Boolean).join(' ');

  // Keep layout stable even before achievements render or when none exist
  if (!ready) {
    return <div className={placeholderClassName} aria-hidden="true" />;
  }

  const entries = Object.entries(achievements || {})
    .map(([id, data]) => {
      const achievement = ACHIEVEMENT_LOOKUP[id];
      const count = data?.count || 0;
      if (!achievement || count <= 0) return null;

      return {
        id,
        count,
        image: achievement.image,
        title: achievement.title,
      };
    })
    .filter(Boolean);

  if (entries.length === 0) {
    return <div className={placeholderClassName} aria-hidden="true" />;
  }

  entries.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.title.localeCompare(b.title);
  });

  const maxVisible = 1;
  const topEntries = entries.slice(0, maxVisible);
  const remainingCount = entries.length - topEntries.length;
  const showOverflow = remainingCount > 0;

  return (
    <div className={containerClassName}>
      {topEntries.map((item) => (
        <div
          key={item.id}
          className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 shadow-sm"
          style={{
            borderColor: 'var(--line)',
            backgroundColor: 'var(--subtle)',
          }}
          aria-label={`${item.title} x${item.count}`}
          title={`${item.title} x${item.count}`}
        >
          <span
            className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border bg-white"
            style={{ borderColor: 'var(--line)' }}
          >
            <img src={item.image} alt="" className="h-6 w-6 object-contain" loading="lazy" />
          </span>
          {item.count > 1 && (
            <span className="text-[11px] font-semibold leading-none" style={{ color: 'var(--muted)' }}>
              x{item.count}
            </span>
          )}
        </div>
      ))}
      {showOverflow && (
        <div
          className="inline-flex items-center justify-center rounded-full border px-2 py-1 text-[11px] font-semibold leading-none"
          style={{
            borderColor: 'var(--line)',
            color: 'var(--muted)',
            backgroundColor: 'var(--surface)',
          }}
          title={`+${remainingCount} flere badges`}
          aria-label={`+${remainingCount} flere badges`}
        >
          +{remainingCount}
        </div>
      )}
    </div>
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