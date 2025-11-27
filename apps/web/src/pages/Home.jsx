import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { MapContainer, Marker, TileLayer } from "react-leaflet";
import L from "leaflet";
import Card from "../components/Card";
import { useLocation } from "../contexts/LocationContext";
import { useCheckInGate } from "../contexts/CheckInContext";
import { useUserData } from "../contexts/UserDataContext";
import { useAuth } from "../hooks/useAuth";
import { getNextResetBoundary } from "../services/userService";
import { CATEGORIES } from "../constants/drinks";
import { useDrinkLog } from "../contexts/DrinkLogContext";
import { MAP_TILE_LAYER_PROPS } from "../utils/mapTiles";
import "leaflet/dist/leaflet.css";

const DEFAULT_MAP_CENTER = [55.6761, 12.5683];
const mapPreviewMarkerIcon = L.divIcon({
  className: "",
  html: `
    <span style="
      display:flex;
      align-items:center;
      justify-content:center;
      width:28px;
      height:28px;
      border-radius:9999px;
      background:rgba(255,56,92,0.9);
      box-shadow:0 0 0 4px rgba(255,255,255,0.85);
    ">
      <span style="
        width:10px;
        height:10px;
        border-radius:9999px;
        background:white;
        display:block;
      "></span>
    </span>
  `,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

function Countdown({ target, onExpire }) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, target.getTime() - Date.now())
  );
  const expiredRef = useRef(false);

  useEffect(() => {
    expiredRef.current = false;
    setRemaining(Math.max(0, target.getTime() - Date.now()));
    const tick = () => {
      setRemaining(Math.max(0, target.getTime() - Date.now()));
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);

  useEffect(() => {
    if (remaining === 0 && !expiredRef.current) {
      expiredRef.current = true;
      onExpire?.();
    }
  }, [remaining, onExpire]);

  const totalSeconds = Math.ceil(remaining / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value) => value.toString().padStart(2, "0");

  return (
    <div className="mt-3 flex items-center gap-2 text-[11px] uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      <span>
        Nulstiller om {pad(hours)}:{pad(minutes)}:{pad(seconds)}
      </span>
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const { updateLocation, userLocation } = useLocation();
  const { currentUser } = useAuth();
  const { checkedIn, checkIn: globalCheckIn, checkOut: handleCheckOut } = useCheckInGate();
  const { userData } = useUserData();
  const { currentRunDrinkCount, resetRun, isResetting } = useDrinkLog();
  const [expiresAt, setExpiresAt] = useState(() => getNextResetBoundary(new Date()));
  const [isCheckInBusy, setIsCheckInBusy] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const mapPreviewCenter = userLocation
    ? [userLocation.lat, userLocation.lng]
    : DEFAULT_MAP_CENTER;
  const mapPreviewKey = mapPreviewCenter.join(",");

  // Get values from context with fallbacks
  const userTotalDrinks = userData?.totalDrinks || 0;

  const handleCheckInClick = useCallback(async () => {
    if (!currentUser) {
      console.error("User not authenticated");
      return;
    }
    if (checkedIn || isCheckInBusy) return;

    try {
      setIsCheckInBusy(true);
      const success = await globalCheckIn();
      if (success) {
        setExpiresAt(getNextResetBoundary(new Date()));
      }
    } finally {
      setIsCheckInBusy(false);
    }
  }, [checkedIn, currentUser, globalCheckIn, isCheckInBusy]);

  const defaultCategoryId = CATEGORIES[0]?.id;
  const handleDrinkNavigate = () => {
    if (defaultCategoryId) {
      navigate(`/drink/${defaultCategoryId}`);
      return;
    }
    navigate("/drink/beer");
  };

  const handleMapNavigate = () => {
    navigate("/map");
  };

  const isCheckInDisabled = checkedIn || isCheckInBusy;

  // Update expiresAt when it expires to show the next reset boundary
  useEffect(() => {
    const updateExpiresAt = () => {
      const nextBoundary = getNextResetBoundary(new Date());
      setExpiresAt(nextBoundary);
    };

    // Update immediately on mount and whenever checked in
    updateExpiresAt();

    // Set up interval to update every minute to keep it accurate
    const interval = setInterval(updateExpiresAt, 60000);

    return () => clearInterval(interval);
  }, [checkedIn]);

  return (
    <>
      <motion.div
      // ... (keep motion props)
      >
        {/* Header */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Card
              bare
              className={`px-5 py-4 transition-colors ${isCheckInDisabled ? "cursor-default" : "cursor-pointer"}`}
              style={checkedIn ? {
                borderColor: 'rgba(16,185,129,0.6)',
                backgroundColor: 'color-mix(in srgb, rgb(16,185,129) 12%, var(--surface) 88%)'
              } : {}}
              role="button"
              tabIndex={isCheckInDisabled ? -1 : 0}
              aria-disabled={isCheckInDisabled}
              onClick={!isCheckInDisabled ? handleCheckInClick : undefined}
              onKeyDown={(event) => {
                if (isCheckInDisabled) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  event.currentTarget.click();
                }
              }}
            >
              <div className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
                Check-in-status
              </div>
              <div
                className={`mt-2 flex items-center gap-2 text-sm font-semibold ${checkedIn
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-[color:var(--brand,#FF385C)]"
                  }`}
              >
                <span
                  className={`h-2.5 w-2.5 rounded-full ${checkedIn
                    ? "bg-emerald-500"
                    : "bg-[color:var(--brand,#FF385C)]"
                    }`}
                />
                {checkedIn ? "Checket ind" : "Ikke checket ind"}
              </div>

              {checkedIn && expiresAt && (
                <Countdown
                  target={expiresAt}
                  onExpire={() => {
                    if (checkedIn) {
                      handleCheckOut();
                    }
                    // Update to next reset boundary after expiration
                    setExpiresAt(getNextResetBoundary(new Date()));
                  }}
                />
              )}
            </Card>

            <Card bare className="px-5 py-4">
              <div className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
                Loggede drinks
              </div>
              <div className="mt-2 flex items-end gap-2">
                <span className="text-3xl font-semibold" style={{ color: 'var(--ink)' }}>
                  {currentRunDrinkCount}
                </span>
                <span className="pb-1 text-xs uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
                  i dag
                </span>
              </div>
              <p className="mt-3 text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
                {userTotalDrinks > 0
                  ? `${userTotalDrinks} i din Sladesh-tid`
                  : "Registrer hver variation med drinkvælgeren nedenfor."}
              </p>
            </Card>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          <Card
            bare
            className="group px-6 py-5 cursor-pointer rounded-2xl transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand,#FF385C)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent hover:-translate-y-0.5 hover:bg-[color:var(--surface-hover,#f8f9fb)] active:scale-[0.99]"
            onClick={handleDrinkNavigate}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handleDrinkNavigate();
              }
            }}
            role="button"
            tabIndex={0}
            aria-label="Vælg drink"
          >
            <div className="flex items-center justify-between gap-6">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
                  Drink vælger
                </div>
                <div className="mt-2 text-2xl font-semibold text-[color:var(--ink)]">
                  Vælg drink
                </div>
                <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--brand,#FF385C)] transition-colors group-hover:text-[color:var(--ink)]">
                  <span>Gå til drink variationer</span>
                  <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
                    →
                  </span>
                </div>
              </div>
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[color:var(--brand,#FF385C)]/15 to-orange-400/20 text-6xl">
                <span role="img" aria-hidden="true">
                  🍹
                </span>
                <span className="absolute inset-0 rounded-2xl bg-white/5 opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-4">
            <Card bare className="px-5 py-4">
              <div className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
                Achievements
              </div>
              <div className="mt-2 text-lg font-semibold" style={{ color: 'var(--ink)' }}>
                Coming soon... ✨
              </div>
              <p className="mt-2 text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
                Coming soon...
              </p>
            </Card>

            <Card
              bare
              className="relative row-span-2 min-h-[260px] cursor-pointer overflow-hidden p-0 transition-all hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand,#FF385C)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
              onClick={handleMapNavigate}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleMapNavigate();
                }
              }}
              role="button"
              tabIndex={0}
              aria-label="Åbn kortet"
            >
              <div className="pointer-events-none absolute inset-0 z-0">
                <MapContainer
                  key={mapPreviewKey}
                  center={mapPreviewCenter}
                  zoom={14}
                  style={{ height: "100%", width: "100%" }}
                  zoomControl={false}
                  dragging={false}
                  doubleClickZoom={false}
                  scrollWheelZoom={false}
                  attributionControl={false}
                  keyboard={false}
                  tap={false}
                  touchZoom={false}
                  className="h-full w-full"
                >
                  <TileLayer {...MAP_TILE_LAYER_PROPS} />
                  {userLocation && (
                    <Marker position={[userLocation.lat, userLocation.lng]} icon={mapPreviewMarkerIcon} />
                  )}
                </MapContainer>
              </div>
              <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[85%] bg-gradient-to-b from-white/75 via-white/60 to-white/20 dark:from-black/75 dark:via-black/60 dark:to-black/2">
                <div className="px-5 py-4">
                  <div className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
                    Map
                  </div>
                  <div className="mt-2 text-lg font-semibold" style={{ color: 'var(--ink)' }}>
                    Find nærmeste bar
                  </div>
                  <p className="mt-2 text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
                    Navigér til kortet for at se hotspots og venner i nærheden.
                  </p>
                </div>
              </div>
            </Card>

            <Card bare className="px-5 py-4">
              <div className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
                Stats
              </div>
              <p className="mt-3 text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
                Coming soon...
              </p>
            </Card>
          </div>
        </div>

      </motion.div>

      {/* Reset Confirmation Dialog */}

      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowResetConfirm(false)}
          />
          <motion.div
            className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Vil du nulstille dagens drikke?
            </h3>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Dette nulstiller dit nuværende løb til 0. Handlingen kan ikke fortrydes.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                Annuller
              </button>
              <button
                type="button"
                onClick={async () => {
                  const success = await resetRun();
                  if (success) {
                    setShowResetConfirm(false);
                  }
                }}
                disabled={isResetting}
                className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
              >
                {isResetting ? "Nulstiller..." : "Bekræft"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

    </>
  );
}
