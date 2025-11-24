import { useEffect, useMemo, useRef, useState } from 'react';
import { getDoc, doc } from 'firebase/firestore';
import Page from '../components/Page';
import { useChannel } from '../hooks/useChannel';
import { USE_MOCK_DATA } from '../config/env';
import { fetchLeaderboardProfiles, fetchUserRecentDrinks, clearLeaderboardCache } from '../services/leaderboardService';
import { db } from '../firebase';

const leaderboardProfiles = [
  {
    id: 'sara-holm',
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
  },
  {
    id: 'mads-larsen',
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
  },
  {
    id: 'camilla-beck',
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
  },
  {
    id: 'jonas-mikkelsen',
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
  },
  {
    id: 'aline-thomsen',
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
  },
  {
    id: 'frederik-olsen',
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
  },
  {
    id: 'cecilie-knudsen',
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
  },
  {
    id: 'mathias-hansen',
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
  },
];

const sortOptions = [
  { id: 'current-run-most', label: 'Nuværende runde – flest' },
  { id: 'current-run-least', label: 'Nuværende runde – færrest' },
  { id: 'all-time-total', label: 'Alle tiders drinks' },
];

const sortComparators = {
  'current-run-most': (a, b) => (b.currentRunDrinkCount || 0) - (a.currentRunDrinkCount || 0),
  'current-run-least': (a, b) => (a.currentRunDrinkCount || 0) - (b.currentRunDrinkCount || 0),
  'all-time-total': (a, b) => (b.totalDrinks || 0) - (a.totalDrinks || 0),
};

export default function Leaderboard() {
  const { selectedChannel } = useChannel();
  const [sortMode, setSortMode] = useState('all-time-total');
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(!USE_MOCK_DATA);
  const [error, setError] = useState(null);
  const topSectionRef = useRef(null);
  const listContainerRef = useRef(null);
  const [listMaxHeight, setListMaxHeight] = useState(null);

  // Fetch leaderboard data from Firestore when not using mock data
  useEffect(() => {
    if (USE_MOCK_DATA) {
      setProfiles(leaderboardProfiles.filter((profile) => profile.checkedIn !== false));
      setLoading(false);
      return;
    }

    const loadProfiles = async () => {
      try {
        setLoading(true);
        setError(null);
        const channelId = selectedChannel && !selectedChannel.isDefault ? selectedChannel.id : null;
        // Clear cache when channel changes
        clearLeaderboardCache(channelId);
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
    const comparator = sortComparators[sortMode] || sortComparators['all-time-total'];
    return [...profiles].sort(comparator);
  }, [profiles, sortMode]);

  // Calculate available height for the scrollable list
  useEffect(() => {
    const updateListHeight = () => {
      if (!topSectionRef.current) return;

      const topSectionRect = topSectionRef.current.getBoundingClientRect();
      // Get CSS variables for bar heights
      const rootStyles = getComputedStyle(document.documentElement);
      const topbarHeight = parseFloat(rootStyles.getPropertyValue('--topbar-height')) || 64;
      const tabbarHeight = parseFloat(rootStyles.getPropertyValue('--tabbar-height')) || 64;
      
      // Calculate: viewport height - topbar - tabbar - top section bottom position - padding
      // The top section bottom is relative to viewport, so we subtract it from viewport height
      // Then subtract the tabbar height and padding
      const scrollRegionPadding = 24; // py-3 = 12px top + 12px bottom
      const listBottomPadding = 24; // pb-6 = 24px
      const gap = 16; // gap-4 = 16px between top section and list
      
      const availableHeight = window.innerHeight 
        - topSectionRect.bottom 
        - (tabbarHeight - scrollRegionPadding) 
        - listBottomPadding 
        - gap;
      
      setListMaxHeight(Math.max(200, availableHeight));
    };

    // Use requestAnimationFrame to ensure DOM is ready
    const frame = requestAnimationFrame(() => {
      updateListHeight();
    });

    window.addEventListener('resize', updateListHeight);
    window.addEventListener('orientationchange', updateListHeight);

    // Also update when sort mode changes (in case it affects top section height)
    const timeout = setTimeout(updateListHeight, 150);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', updateListHeight);
      window.removeEventListener('orientationchange', updateListHeight);
      clearTimeout(timeout);
    };
  }, [sortMode]);

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

  // Disable scrolling on the list container and main scroll region when overlay is open
  useEffect(() => {
    if (!selectedProfile) return undefined;

    const scrollRegion = document.querySelector('.scroll-region');
    const originalScrollRegionOverflow = scrollRegion ? scrollRegion.style.overflow : null;
    
    const container = listContainerRef.current;
    const originalContainerOverflow = container ? container.style.overflow : null;
    
    if (container) {
      container.style.overflow = 'hidden';
    }
    
    if (scrollRegion) {
      scrollRegion.style.overflow = 'hidden';
    }
    
    return () => {
      if (container) {
        container.style.overflow = originalContainerOverflow || '';
      }
      if (scrollRegion) {
        scrollRegion.style.overflow = originalScrollRegionOverflow || '';
      }
    };
  }, [selectedProfile]);

  return (
    <Page title="Leaderboard">
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
          className="overflow-y-auto -mr-3 pr-3 pb-6"
          style={{
            maxHeight: listMaxHeight ? `${listMaxHeight}px` : 'none',
            scrollBehavior: 'smooth'
          }}
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
                  onSelect={setSelectedProfile}
                  isActive={selectedProfile?.id === profile.id}
                  sortMode={sortMode}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {selectedProfile ? (
        <ProfileDetailSheet 
          profile={selectedProfile} 
          sortMode={sortMode}
          onClose={() => setSelectedProfile(null)} 
        />
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

function ProfileCard({ profile, rank, onSelect, isActive, sortMode }) {
  const rankBadge = `#${rank}`;
  
  // Determine which value to display based on sort mode
  const displayValue = sortMode === 'all-time-total' 
    ? (profile.totalDrinks || 0)
    : (profile.currentRunDrinkCount || 0);
  
  const valueFormatted = displayValue.toLocaleString('da-DK');

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

        <Avatar 
          emoji={profile.profileEmoji} 
          gradient={profile.profileGradient || profile.avatarGradient}
          initials={profile.initials}
        />

        <span className="min-w-0 truncate text-sm font-semibold" style={{ color: 'var(--ink)' }}>{profile.name}</span>

        <div className="text-right leading-tight">
          <span className="block text-base font-semibold tabular-nums" style={{ color: 'var(--ink)' }}>{valueFormatted}</span>
          <span className="block text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Drinks</span>
        </div>
      </div>
    </button>
  );
}

function Avatar({ emoji, gradient, initials }) {
  // Use emoji if available, otherwise fall back to initials
  if (emoji && gradient) {
    return (
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br ${gradient} text-xl shadow-sm`}
      >
        {emoji}
      </div>
    );
  }
  
  // Fallback to initials if emoji/gradient not available
  return (
    <div
      className={`flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br ${gradient || 'from-gray-400 to-gray-600'} text-sm font-semibold uppercase text-white shadow-sm`}
    >
      {initials || '??'}
    </div>
  );
}

function ProfileDetailSheet({ profile, sortMode, onClose }) {
  const [isVisible, setIsVisible] = useState(false);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  // Lock body scroll when overlay is open
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  // Fetch user data from Firestore when overlay opens
  useEffect(() => {
    if (USE_MOCK_DATA) {
      // Use mock data from profile
      setUserData({
        totalDrinks: profile.totalDrinks || 0,
        currentRunDrinkCount: profile.currentRunDrinkCount || 0,
        drinkTypes: profile.drinkBreakdown ? 
          profile.drinkBreakdown.reduce((acc, item) => {
            // Convert drinkBreakdown to drinkTypes format
            const type = item.label.toLowerCase().replace(/\s+/g, '');
            acc[type] = item.count;
            return acc;
          }, {}) : {},
        drinkVariations: {},
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days ago for mock
      });
      setLoading(false);
      return;
    }

    const fetchUserData = async () => {
      try {
        setLoading(true);
        const userRef = doc(db, 'users', profile.id);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const data = userSnap.data();
          setUserData({
            totalDrinks: data.totalDrinks || 0,
            currentRunDrinkCount: data.currentRunDrinkCount || 0,
            drinkTypes: data.drinkTypes || {},
            drinkVariations: data.drinkVariations || {},
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date())
          });
        } else {
          // Fallback to profile data if user not found
          setUserData({
            totalDrinks: profile.totalDrinks || 0,
            currentRunDrinkCount: profile.currentRunDrinkCount || 0,
            drinkTypes: {},
            drinkVariations: {},
            createdAt: new Date()
          });
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        // Fallback to profile data on error
        setUserData({
          totalDrinks: profile.totalDrinks || 0,
          currentRunDrinkCount: profile.currentRunDrinkCount || 0,
          drinkTypes: {},
          drinkVariations: {},
          createdAt: new Date()
        });
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [profile.id]);

  // Calculate weekly average for all-time view
  const calculateWeeklyAverage = (totalDrinks, createdAt) => {
    if (!totalDrinks || totalDrinks === 0 || !createdAt) return 0;
    
    const now = new Date();
    const created = createdAt instanceof Date ? createdAt : new Date(createdAt);
    const diffMs = now - created;
    const diffWeeks = diffMs / (7 * 24 * 60 * 60 * 1000);
    
    if (diffWeeks < 1) return totalDrinks; // Less than 1 week, return total
    
    return Math.round((totalDrinks / diffWeeks) * 10) / 10; // Round to 1 decimal
  };

  // Build drink breakdown based on sortMode
  const buildDrinkBreakdown = () => {
    if (!userData) return [];

    const isCurrentRun = sortMode === 'current-run-most' || sortMode === 'current-run-least';
    
    if (isCurrentRun) {
      // Current run: use drinkVariations
      const breakdown = [];
      const variations = userData.drinkVariations || {};
      
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
    } else {
      // All time: use drinkTypes
      const breakdown = [];
      const drinkTypes = userData.drinkTypes || {};
      
      // Format drink type labels
      const formatDrinkTypeLabel = (type) => {
        const labels = {
          beer: 'Øl',
          cider: 'Cider',
          wine: 'Vin',
          cocktail: 'Cocktails',
          shot: 'Shots',
          spritz: 'Spritz',
          soda: 'Sodavand',
          other: 'Andre'
        };
        return labels[type] || type.charAt(0).toUpperCase() + type.slice(1);
      };
      
      Object.entries(drinkTypes).forEach(([type, count]) => {
        if (count > 0) {
          breakdown.push({
            id: type,
            label: formatDrinkTypeLabel(type),
            count: count
          });
        }
      });
      
      return breakdown.sort((a, b) => b.count - a.count);
    }
  };

  const drinkBreakdown = userData ? buildDrinkBreakdown() : [];
  const breakdownTotal = drinkBreakdown.reduce((sum, item) => sum + item.count, 0);
  
  // Determine main number and description based on sortMode
  const isCurrentRun = sortMode === 'current-run-most' || sortMode === 'current-run-least';
  const mainNumber = userData 
    ? (isCurrentRun ? userData.currentRunDrinkCount : userData.totalDrinks)
    : 0;
  const weeklyAverage = userData && !isCurrentRun 
    ? calculateWeeklyAverage(userData.totalDrinks, userData.createdAt)
    : null;

  if (loading) {
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
            <div className="flex items-center justify-center h-full">
              <p className="text-sm" style={{ color: 'var(--muted)' }}>Indlæser...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
            className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-6 pb-4"
            style={{ 
              backgroundColor: 'var(--surface)',
              paddingTop: 'calc(70px + env(safe-area-inset-top, 0px))'
            }}
          >
            <div>
              <h2 className="text-lg font-semibold" style={{ color: 'var(--ink)' }}>{profile.name}</h2>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                {isCurrentRun ? (
                  <>
                    {mainNumber.toLocaleString('da-DK')} drinks i nuværende runde
                  </>
                ) : (
                  <>
                    {mainNumber.toLocaleString('da-DK')} drinks totalt
                    {weeklyAverage !== null && weeklyAverage > 0 && (
                      <> · {weeklyAverage.toLocaleString('da-DK', { maximumFractionDigits: 1 })} pr. uge</>
                    )}
                  </>
                )}
              </p>
            </div>
          </header>

          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
            {drinkBreakdown.length > 0 && breakdownTotal > 0 ? (
              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
                  {isCurrentRun ? 'Fordeling af nuværende drinks' : 'Fordeling af drinks'}
                </h3>
                <ul className="space-y-3">
                  {drinkBreakdown.map((item) => {
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
            ) : null}
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
