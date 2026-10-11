"use client";

import dynamic from "next/dynamic";
import { useAuth } from "@/context/AuthContext";
import { useCallback, useEffect, useRef, useState } from "react";
import type { LatLng } from "./map/geo";
import { Button, EmptyState, Spinner } from "@/components/ui";

// The Leaflet map is client-only. Loading the whole map through a single
// dynamic import keeps `react-leaflet`/`leaflet` out of the server bundle.
const LeafletMap = dynamic(() => import("./map/LeafletMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-slate-950">
      <Spinner size="md" label="Loading map" />
    </div>
  ),
});

const FOCUSED_ZOOM = 15;

/**
 * How often to re-read the counterparty's shared position while the map is open.
 * Ten seconds balances "feels live" against battery/data use; combined with the
 * visibility pause it costs nothing while the tab is backgrounded.
 */
const POLL_INTERVAL_MS = 10_000;

interface LocationMapProps {
  showLocationMap?: boolean;
  targetId?: string;
  onClose: () => void;
  selectedBookingForMap: any;
}

const ROLE_LABELS: Record<string, string> = {
  user: "Customer",
  customer: "Customer",
  provider: "Provider",
  admin: "Admin",
};

/**
 * Human-friendly role label. Defaults to "Customer" because the "user" role is
 * the customer and it is the common counterparty shown on the location map —
 * showing "User" there was confusing.
 */
function roleLabel(role?: string): string {
  if (!role) return "Customer";
  return ROLE_LABELS[role] ?? "Customer";
}

/**
 * Resolve who the map is about from whichever shape the caller passed:
 *  - admin UserManagement passes a user object: `{ id, name, role, ... }`
 *  - the bookings dashboard passes a booking: `{ user: {...}, provider: {...} }`
 *
 * `viewerId` is used to make sure the viewer's own record is never chosen as
 * the target when the payload contains both parties.
 */
function resolveTarget(
  selected: any,
  targetId?: string,
  viewerId?: string
): {
  role?: string;
  name?: string;
  phone?: string;
} {
  if (!selected) return {};

  // A booking carries both parties; pick the one that matches `targetId`, and
  // never the viewer themselves.
  if (selected.user || selected.provider) {
    const candidates = [selected.user, selected.provider].filter(Boolean);
    const match =
      candidates.find((c: any) => c?.id && c.id === targetId) ??
      candidates.find((c: any) => c?.id === selected.targetId) ??
      candidates.find((c: any) => c?.id && c.id !== viewerId) ??
      candidates.find((c: any) => c?.id) ??
      null;
    if (match) {
      return { role: match.role, name: match.name, phone: match.phone };
    }
  }

  // Plain user object — but never surface the viewer as the target.
  if (viewerId && selected.id === viewerId) {
    return {};
  }
  return { role: selected.role, name: selected.name, phone: selected.phone };
}

/**
 * In-map alert ("toast").
 *
 * Rendered as an overlay inside the map view so every warning/information
 * message appears in context, without native browser dialogs or layout-shifting
 * inline banners.
 */
function AlertToast({
  variant,
  title,
  message,
  onClose,
}: {
  variant: "info" | "success" | "warning" | "error";
  title: string;
  message: string;
  onClose: () => void;
}) {
  const styles: Record<
    string,
    { container: string; icon: string; title: string; body: string }
  > = {
    info: {
      container: "border-blue-500/30 bg-slate-900/95",
      icon: "text-blue-400",
      title: "text-blue-200",
      body: "text-blue-300",
    },
    success: {
      container: "border-emerald-500/30 bg-slate-900/95",
      icon: "text-emerald-400",
      title: "text-emerald-200",
      body: "text-emerald-300",
    },
    warning: {
      container: "border-amber-500/30 bg-slate-900/95",
      icon: "text-amber-400",
      title: "text-amber-200",
      body: "text-amber-300",
    },
    error: {
      container: "border-red-500/30 bg-slate-900/95",
      icon: "text-red-400",
      title: "text-red-200",
      body: "text-red-300",
    },
  };

  const paths: Record<string, string> = {
    info: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    success: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
    warning:
      "M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z",
    error: "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z",
  };

  const s = styles[variant] ?? styles.info;

  return (
    <div
      role="alert"
      className={`pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-lg border ${s.container} p-3.5 shadow-lg backdrop-blur`}
    >
      <svg
        className={`mt-0.5 h-5 w-5 shrink-0 ${s.icon}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d={paths[variant] ?? paths.info}
        />
      </svg>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold ${s.title}`}>{title}</p>
        <p className={`mt-0.5 text-xs leading-relaxed ${s.body}`}>{message}</p>
      </div>
      <button
        onClick={onClose}
        aria-label="Dismiss"
        className={`shrink-0 rounded p-0.5 ${s.icon} transition hover:opacity-70`}
      >
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}

/**
 * Compact legend explaining the two pin colours. The dots in the header are the
 * only key otherwise, which is easy to miss on small screens.
 */
function MapLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-400">
      <span className="inline-flex items-center gap-2">
        <span
          className="h-3 w-3 rounded-full border-2 border-white/70 bg-indigo-600"
          aria-hidden="true"
        />
        You
      </span>
      <span className="inline-flex items-center gap-2">
        <span
          className="h-3 w-3 rounded-full border-2 border-white/70 bg-emerald-700"
          aria-hidden="true"
        />
        Other person
      </span>
      <span className="inline-flex items-center gap-2">
        <span
          className="h-0.5 w-4 rounded-full bg-indigo-500"
          aria-hidden="true"
        />
        Distance
      </span>
    </div>
  );
}

export function describeGeolocationError(
  error: GeolocationPositionError,
): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "Location permission blocked. Enable it in your browser settings.";
    case error.POSITION_UNAVAILABLE:
      return "Location signal unavailable. Turn on location services.";
    case error.TIMEOUT:
      return "Location timed out. Move near a window and retry.";
    default:
      return "Couldn't determine your location. Please retry.";
  }
}

export default function LocationMap({
  targetId,
  onClose,
  selectedBookingForMap,
}: LocationMapProps) {
  const { user, token } = useAuth();

  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [targetLocation, setTargetLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  // When the target last reported their position (ms epoch), for the tooltip.
  const [targetUpdatedAt, setTargetUpdatedAt] = useState<number | null>(null);
  // Reported accuracy of each position, in metres (lower is better).
  const [userAccuracy, setUserAccuracy] = useState<number | null>(null);
  const [targetAccuracy, setTargetAccuracy] = useState<number | null>(null);
  // Profile of the selected person, fetched fresh from the API so the map
  // tooltip shows accurate information even if the caller passed a partial
  // object (e.g. a booking list entry without a role).
  const [targetProfile, setTargetProfile] = useState<{
    name?: string;
    phone?: string | null;
    role?: string;
  } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  // True while a geolocation request started from the Share Location button is
  // in flight. Starts false: we do not locate automatically on open.
  const [locating, setLocating] = useState(false);
  // True while a manual fetch of the target's location is in flight.
  const [refreshing, setRefreshing] = useState(false);
  // True while we're publishing our own location (Share Location button).
  const [sharing, setSharing] = useState(false);
  // In-map alerts. All warnings/info for the map are surfaced here (overlaid on
  // the map) instead of as inline banners or native browser alerts.
  const [alerts, setAlerts] = useState<
    Array<{
      id: number;
      key?: string;
      variant: "info" | "success" | "warning" | "error";
      title: string;
      message: string;
      sticky?: boolean;
    }>
  >([]);
  const alertIdRef = useRef(0);
  const alertTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  // Current map scale label (e.g. "50 m"), reported up from the map's in-map
  // scale bridge and rendered as a badge in the header.
  const [scaleLabel, setScaleLabel] = useState<string | null>(null);
  const handleScale = useCallback((label: string) => setScaleLabel(label), []);

  // Work out who this map is about so the title/labels are dynamic rather than
  // a static "Find Your User/Provider". Prefer the profile fetched from the API
  // (authoritative), falling back to what the caller passed in.
  //
  // Declared here — above the effects below — so those effects can safely
  // reference the target's name/label.
  const resolved = resolveTarget(selectedBookingForMap, targetId, user?.id);
  const target = {
    name: targetProfile?.name ?? resolved.name,
    phone: targetProfile?.phone ?? resolved.phone,
    role: targetProfile?.role ?? resolved.role,
  };
  const viewerRole = user?.role;
  // When the payload doesn't carry the target's role (e.g. booking lists only
  // expose the counterparty's name/phone), infer it from the viewer: a customer
  // is looking at a provider and vice-versa.
  const inferredRole =
    target.role ??
    (viewerRole === "customer"
      ? "provider"
      : viewerRole === "provider"
        ? "customer"
        : undefined);
  const targetLabel = roleLabel(inferredRole);

  /** Remove an alert and cancel its auto-dismiss timer. */
  const dismissAlert = useCallback((id: number) => {
    setAlerts((current) => current.filter((alert) => alert.id !== id));
    const timer = alertTimersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      alertTimersRef.current.delete(id);
    }
  }, []);

  /** Remove every alert with the given key (used when a condition clears). */
  const dismissAlertByKey = useCallback((key: string) => {
    setAlerts((current) => {
      const remaining: typeof current = [];
      for (const alert of current) {
        if (alert.key === key) {
          const timer = alertTimersRef.current.get(alert.id);
          if (timer) {
            clearTimeout(timer);
            alertTimersRef.current.delete(alert.id);
          }
        } else {
          remaining.push(alert);
        }
      }
      return remaining;
    });
  }, []);

  /**
   * Show an in-map alert. Non-sticky alerts auto-dismiss; sticky ones stay
   * until the user closes them (used for actionable problems).
   *
   * Passing a `key` makes the alert a singleton: re-pushing the same key
   * replaces the previous one instead of stacking duplicates.
   */
  const pushAlert = useCallback(
    (
      alert: {
        key?: string;
        variant: "info" | "success" | "warning" | "error";
        title: string;
        message: string;
        sticky?: boolean;
      },
      options: { durationMs?: number } = {},
    ) => {
      const id = ++alertIdRef.current;
      setAlerts((current) => {
        // A keyed alert replaces any existing alert with the same key.
        const withoutDuplicate = current.filter(
          (existing) =>
            !(alert.key && existing.key === alert.key) &&
            !(existing.title === alert.title && existing.message === alert.message),
        );
        return [...withoutDuplicate, { id, ...alert }].slice(-3);
      });

      if (!alert.sticky) {
        const duration = options.durationMs ?? 4000;
        const timer = setTimeout(() => dismissAlert(id), duration);
        alertTimersRef.current.set(id, timer);
      }
    },
    [dismissAlert],
  );

  // Clean up any pending auto-dismiss timers on unmount.
  useEffect(() => {
    const timers = alertTimersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  // Surface our own geolocation problems as an in-map alert.
  useEffect(() => {
    if (locationError) {
      pushAlert({
        key: "self-location-error",
        variant: "warning",
        title: "Can't locate you",
        message: locationError,
        sticky: true,
      });
    } else {
      dismissAlertByKey("self-location-error");
    }
  }, [locationError, pushAlert, dismissAlertByKey]);

  // The "counterparty hasn't shared" case is intentionally NOT surfaced as an
  // in-map alert: the map already renders a centred "No locations to show"
  // empty state, and a duplicate toast in the top-right corner was redundant.

  // Confirm once, the first time the counterparty's location is shown.
  const announcedShareRef = useRef(false);
  useEffect(() => {
    if (targetLocation && !announcedShareRef.current) {
      announcedShareRef.current = true;
      pushAlert({
        key: "target-location-available",
        variant: "success",
        title: "Location received",
        message: target.name
          ? `Showing ${target.name}'s latest location on the map.`
          : "Showing the latest shared location on the map.",
      });
    }
    if (!targetLocation) {
      announcedShareRef.current = false;
    }
  }, [targetLocation, target.name, pushAlert]);

  // Guard against overlapping requests.
  const refreshingRef = useRef(false);
  const sharingRef = useRef(false);
  // True while the background poll is mid-request — prevents overlapping ticks.
  const pollingRef = useRef(false);

  /**
   * Resolve the viewer's position as fast as possible, then keep refining it.
   *
   * Two lookups run **in parallel**:
   *   A. a cached/coarse fix (`maximumAge` up to 30s) — returns almost
   *      instantly when the browser already has a recent position;
   *   B. a fresh high-accuracy fix.
   *
   * Whichever arrives first is used immediately (so the map appears fast), and
   * if B later returns a *more precise* reading the callback is invoked again to
   * upgrade the marker. This avoids the old sequential fallback that could take
   * ~27 seconds when GPS was slow.
   *
   * `onUpdate` is called with each improving result; `onError` only fires when
   * *both* lookups fail (a transient failure of one is not an error).
   */
  const locateWithRefinement = (
    onUpdate: (result: {
      latitude: number;
      longitude: number;
      accuracy: number | null;
      precise: boolean;
    }) => void,
    onError: (message: string) => void,
  ): (() => void) => {
    let settled = false;
    let bestAccuracy = Number.POSITIVE_INFINITY;
    let pendingA = true;
    let pendingB = true;

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      onError("Geolocation is not supported by this browser.");
      return () => undefined;
    }

    const report = (result: {
      latitude: number;
      longitude: number;
      accuracy: number | null;
      precise: boolean;
    }) => {
      const accuracy = result.accuracy ?? Number.POSITIVE_INFINITY;
      // Only emit when this reading is at least as good as the best so far.
      if (settled && accuracy >= bestAccuracy) return;
      bestAccuracy = Math.min(bestAccuracy, accuracy);
      settled = true;
      onUpdate(result);
    };

    const fail = (error: GeolocationPositionError) => {
      // Surface the failure only once both strategies have given up.
      if (pendingA || pendingB) return;
      if (!settled) onError(describeGeolocationError(error));
    };

    // Strategy A: fast, possibly cached/coarse fix.
    navigator.geolocation.getCurrentPosition(
      (position) => {
        pendingA = false;
        report({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: Number.isFinite(position.coords.accuracy)
            ? position.coords.accuracy
            : null,
          precise: false,
        });
      },
      (error) => {
        pendingA = false;
        fail(error);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 30000 },
    );

    // Strategy B: precise GPS fix (started immediately, runs in parallel).
    navigator.geolocation.getCurrentPosition(
      (position) => {
        pendingB = false;
        report({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: Number.isFinite(position.coords.accuracy)
            ? position.coords.accuracy
            : null,
          precise: true,
        });
      },
      (error) => {
        pendingB = false;
        fail(error);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 },
    );

    // No cancellation handle is exposed by the API; callers stop listening by
    // ignoring updates once their effect is torn down.
    return () => undefined;
  };

  // Store the caller's *own* location on the backend (Redis). This is a pure
  // write — it must never read or mutate the target's location. The caller owns
  // the corresponding local state.
  const updateUserLocation = async (
    authToken: string,
    latitude: number,
    longitude: number,
    accuracy: number | null = null,
  ) => {
    try {
      const response = await fetch("/api/location", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ latitude, longitude, accuracy }),
      });
      if (!response.ok) {
        throw new Error(`Location update failed (${response.status})`);
      }
    } catch (error) {
      console.error("Failed to update user location:", error);
    }
  };

  // Read the *target* user's location + profile from the backend. This is a pure
  // read — it must never write the caller's own location.
  const fetchTargetLocation = async (target: string) => {
    // Never treat the viewer's own id as a "target" — doing so renders the
    // viewer's position/details a second time as the other person's marker.
    if (!target || (user?.id && target === user.id)) {
      setTargetLocation(null);
      setTargetProfile(null);
      setTargetUpdatedAt(null);
      return;
    }

    try {
      // `no-store` + a cache-busting timestamp guarantee we always read the
      // freshest stored position rather than a browser-cached response.
      const res = await fetch(
        `/api/location?targetId=${encodeURIComponent(target)}&_=${Date.now()}`,
        {
          method: "GET",
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      // A non-OK response is a *request* failure (not "not sharing"). Don't
      // claim the person isn't sharing — leave the previous state and let the
      // next poll retry (transient 401s happen before the token is loaded).
      if (!res.ok) {
        console.error(
          `Failed to fetch target location (status ${res.status})`,
        );
        return;
      }

      const data = await res.json();

      // The API returns the target's profile even when they are not sharing a
      // location, so keep it for the tooltip/labels.
      if (data.target) {
        setTargetProfile({
          name: data.target.name,
          phone: data.target.phone,
          role: data.target.role,
        });
      }

      // The target may not be sharing a location yet (location: null).
      if (data.location) {
        setTargetLocation({
          lat: data.location.latitude,
          lng: data.location.longitude,
        });
        setTargetUpdatedAt(
          typeof data.location.updatedAt === "number"
            ? data.location.updatedAt
            : null,
        );
        setTargetAccuracy(
          typeof data.location.accuracy === "number"
            ? data.location.accuracy
            : null,
        );
      } else {
        setTargetLocation(null);
        setTargetUpdatedAt(null);
        setTargetAccuracy(null);
      }
    } catch (error) {
      // Network error — leave any previously-shown position untouched rather
      // than asserting the person isn't sharing.
      console.error("Error fetching target location:", error);
    }
  };

  /**
   * Resolve the viewer's own position and **publish it to the backend (Redis)**.
   *
   * This is the only path that writes a location; it is triggered solely by the
   * "Share Location" button. Resolves on the first fix (fast or precise) and
   * never hangs: if neither strategy reports within `timeoutMs` it resolves
   * `null`.
   */
  const resolveAndPublishOwnLocation = useCallback(
    (
      timeoutMs = 15000,
    ): Promise<{
      latitude: number;
      longitude: number;
      accuracy: number | null;
    } | null> => {
      return new Promise((resolve) => {
        let done = false;

        const finish = (
          value: {
            latitude: number;
            longitude: number;
            accuracy: number | null;
          } | null,
        ) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          resolve(value);
        };

        const timer = setTimeout(() => finish(null), timeoutMs);

        locateWithRefinement(
          (result) => {
            // Show it immediately and publish to Redis under our own id.
            setLocating(false);
            setLocationError(null);
            setUserLocation({ lat: result.latitude, lng: result.longitude });
            setUserAccuracy(result.accuracy);
            if (token) {
              void updateUserLocation(
                token,
                result.latitude,
                result.longitude,
                result.accuracy,
              );
            }
            finish({
              latitude: result.latitude,
              longitude: result.longitude,
              accuracy: result.accuracy,
            });
          },
          (message) => {
            setLocating(false);
            setLocationError(message);
            finish(null);
          },
        );
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token],
  );

  /**
   * "Share Location" — resolve the viewer's own position and write it to Redis
   * so the counterparty can see us.
   *
   * Writes ONLY the caller's own location. It never reads or mutates the
   * target's location. Nothing is written automatically on open/close.
   */
  const shareLocation = useCallback(async () => {
    if (sharingRef.current) return;
    sharingRef.current = true;
    setSharing(true);
    setLocating(true);
    setLocationError(null);
    try {
      const own = await resolveAndPublishOwnLocation();
      if (own) {
        pushAlert({
          key: "location-shared",
          variant: "success",
          title: "Location shared",
          message: `Your live position was shared at ${new Date().toLocaleTimeString()}.`,
        });
      }
    } finally {
      sharingRef.current = false;
      setSharing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, pushAlert]);

  /**
   * "Refresh" — fetch ONLY the counterparty's latest stored location from the
   * backend. Performs a GET; it never reads or writes the caller's own location.
   */
  const refreshLocation = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    try {
      if (targetId) {
        await fetchTargetLocation(String(targetId));
      }
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId, token]);

  useEffect(() => {
    // When the target changes, clear the previous target's position immediately
    // so a stale marker from the previously-viewed person is never shown while
    // the new one is being fetched.
    setTargetLocation(null);
    setTargetProfile(null);
    setTargetUpdatedAt(null);
    setTargetAccuracy(null);

    // Fetch the counterparty's location on open. We never publish our own
    // location here — that only happens when "Share Location" is pressed.
    void refreshLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId, token]);

  /**
   * Live polling of the counterparty's position.
   *
   * A "Live Location" view that only updates on a manual Refresh press is not
   * actually live — this keeps the marker moving. The poll is deliberately
   * conservative:
   *   - it only runs while the component is mounted (i.e. the modal is open),
   *   - it pauses when the tab is hidden (no wasted requests in the background),
   *   - it never overlaps itself (guarded by `pollingRef`), and
   *   - it stops permanently after an auth failure so we don't hammer a 401.
   *
   * Our own position is never re-read here; only the target endpoint is hit.
   */
  useEffect(() => {
    if (!targetId || !token) return;
    // Don't treat the viewer as their own target (mirrors fetchTargetLocation).
    if (user?.id && String(targetId) === user.id) return;

    let cancelled = false;

    const tick = async () => {
      if (cancelled || pollingRef.current) return;
      // Skip while the tab is hidden or a manual refresh is already in flight.
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "hidden"
      ) {
        return;
      }
      if (refreshingRef.current) return;

      pollingRef.current = true;
      try {
        await fetchTargetLocation(String(targetId));
      } finally {
        pollingRef.current = false;
      }
    };

    const interval = window.setInterval(tick, POLL_INTERVAL_MS);

    // Refresh immediately when the tab becomes visible again so a user who
    // returns to the tab sees the current position without waiting a full tick.
    const onVisibility = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId, token, user?.id]);

  // Center on whichever position is available (target takes priority so the
  // viewer is taken straight to the person they asked about). There is
  // deliberately no "default" centre: until a real coordinate is known we show
  // a loading state rather than a meaningless world view.
  const center: LatLng | null = targetLocation ?? userLocation ?? null;
  const hasPosition = center !== null;
  const zoom = FOCUSED_ZOOM;

  // Work out who this map is about so the title/labels are dynamic rather than
  // a static "Find Your User/Provider". (Computed near the top of the component
  // so the alert effects below can reference the target's name/label.)

  // Escape closes the map (matches the app's `Modal` primitive and every other
  // overlay, so the whole product behaves the same way).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Live location map"
        className="flex h-screen w-screen flex-col bg-slate-950"
      >
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-slate-800 bg-slate-950 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-slate-100">
                Live Location
              </h2>
              {/* Signals that the counterparty's marker auto-refreshes, so users
                  don't assume they must keep pressing Refresh. */}
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                Live
              </span>
              {/* Map scale — moved up from the map's bottom-left corner into the
                  header so it lives with the other view metadata. */}
              {scaleLabel && (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900/70 px-2 py-0.5 text-[11px] font-medium text-slate-300"
                  title="Map scale"
                >
                  <svg
                    className="h-3.5 w-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 21h12M6 18h12M6 15h12M6 12h12M6 9h12M6 6h12M4 3h16a1 1 0 011 1v16a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1z"
                    />
                  </svg>
                  {scaleLabel}
                </span>
              )}
            </div>
            <div className="mt-1">
              <MapLegend />
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {/* Share Location — publishes our position to the backend. */}
            <Button
              onClick={() => void shareLocation()}
              loading={sharing}
              title="Share your current location"
            >
              {!sharing && (
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 21s7-6.1 7-11a7 7 0 10-14 0c0 4.9 7 11 7 11z"
                  />
                  <circle cx="12" cy="10" r="2.5" />
                </svg>
              )}
              {sharing ? "Sharing…" : "Share Location"}
            </Button>

            {/* Refresh — fetches the counterparty's latest position only. */}
            <Button
              variant="secondary"
              onClick={() => void refreshLocation()}
              loading={refreshing}
              title="Fetch the latest location"
            >
              {!refreshing && (
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 4v5h5M20 20v-5h-5M20 9A8 8 0 006.3 5.7L4 8m16 8l-2.3 2.3A8 8 0 014 15"
                  />
                </svg>
              )}
              {refreshing ? "Refreshing…" : "Refresh"}
            </Button>

            <button
              onClick={onClose}
              aria-label="Close map"
              title="Close"
              className="rounded-md p-2 text-slate-400 transition hover:bg-slate-800 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </header>

        {/* Map — only rendered once we actually have a coordinate. While the
            position is being resolved we show a loading state instead of a
            default (meaningless) world view. */}
        <div className="flex-1 relative">
          {hasPosition && center ? (
            <LeafletMap
              center={center}
              zoom={zoom}
              userLocation={userLocation}
              targetLocation={targetLocation}
              targetName={target.name || ""}
              targetPhone={target.phone || ""}
              targetRole={targetLabel}
              targetUpdatedAt={targetUpdatedAt}
              targetAccuracy={targetAccuracy}
              userAccuracy={userAccuracy}
              userLabel={user?.name ? `You are here (${user.name})` : "You are here"}
              onScale={handleScale}
            />
          ) : (
            <div className="absolute inset-0 bg-slate-950">
              {locating ? (
                <div className="flex h-full flex-col items-center justify-center gap-3">
                  <Spinner size="lg" label="Locating" />
                  <p className="text-sm font-medium text-slate-300">Locating…</p>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center p-4">
                  <EmptyState
                    title="No locations to show"
                    description={
                      locationError ||
                      "Share your location, or wait for the other person to share theirs, then press Refresh."
                    }
                    action={
                      <div className="flex items-center gap-2">
                        <Button onClick={() => void shareLocation()}>
                          Share Location
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => void refreshLocation()}
                        >
                          Refresh
                        </Button>
                      </div>
                    }
                    icon={
                      <svg
                        className="h-6 w-6"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 21s7-6.1 7-11a7 7 0 10-14 0c0 4.9 7 11 7 11z"
                        />
                        <circle cx="12" cy="10" r="2.5" />
                      </svg>
                    }
                  />
                </div>
              )}
            </div>
          )}


          {/* In-map alerts. Every warning/info for this view is surfaced here,
              over the map, rather than as inline banners or native alerts. */}
          {alerts.length > 0 && (
            <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col items-center gap-2 p-3 sm:items-end sm:p-4">
              {alerts.map((alert) => (
                <AlertToast
                  key={alert.id}
                  variant={alert.variant}
                  title={alert.title}
                  message={alert.message}
                  onClose={() => dismissAlert(alert.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
