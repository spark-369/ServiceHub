/**
 * Pure geospatial helpers for the map views.
 *
 * IMPORTANT: this module must stay free of any `leaflet` / `react-leaflet`
 * imports. `LocationMap.tsx` imports these helpers, and that component is part
 * of the normal (server-renderable) tree — pulling in Leaflet here would drag
 * its `window`-touching code into the server bundle and crash SSR with
 * "window is not defined". Leaflet itself is still loaded only via
 * `next/dynamic({ ssr: false })` from `LocationMap.tsx`.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

/** Accuracy quality band used for colour-coding the reported GPS radius. */
export interface AccuracyQuality {
  label: "high" | "good" | "fair" | "low" | "unknown";
  /** Tailwind text-colour class tuned for the dark map surface. */
  className: string;
  /** Raw hex used for the accuracy ring drawn on the map. */
  hex: string;
}

/**
 * Categorises a reported accuracy radius (metres) into a coarse quality band.
 *
 * Lives here (not in the Leaflet bundle) so the colour vocabulary can be shared
 * by the map overlays and any server-renderable UI, and unit-tested without
 * pulling in Leaflet.
 */
export function accuracyQuality(metres?: number | null): AccuracyQuality {
  if (typeof metres !== "number" || !Number.isFinite(metres)) {
    return { label: "unknown", className: "text-slate-400", hex: "#94a3b8" };
  }
  if (metres <= 25)
    return { label: "high", className: "text-emerald-400", hex: "#34d399" };
  if (metres <= 100)
    return { label: "good", className: "text-lime-400", hex: "#a3e635" };
  if (metres <= 500)
    return { label: "fair", className: "text-amber-400", hex: "#fbbf24" };
  return { label: "low", className: "text-red-400", hex: "#f87171" };
}

/** Great-circle distance in metres between two coordinates (haversine). */
export function distanceInMetres(a: LatLng, b: LatLng): number {
  const R = 6371e3; // Earth radius in metres
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Human-readable distance (m / km). */
export function formatDistance(metres: number): string {
  if (!Number.isFinite(metres)) return "";
  if (metres < 1000) return `${Math.round(metres)} m`;
  return `${(metres / 1000).toFixed(metres < 10000 ? 2 : 1)} km`;
}

/** Human-readable accuracy radius (metres). */
export function formatAccuracy(metres?: number | null): string {
  if (typeof metres !== "number" || !Number.isFinite(metres)) return "";
  if (metres < 1000) return `±${Math.round(metres)} m`;
  return `±${(metres / 1000).toFixed(1)} km`;
}

/**
 * Builds an OpenStreetMap deep-link for a coordinate — lets users open the exact
 * position in a full map app (handy on mobile where a tooltip is small).
 */
export function osmLink(latlng: LatLng): string {
  return `https://www.openstreetmap.org/?mlat=${latlng.lat}&mlon=${latlng.lng}#map=17/${latlng.lat}/${latlng.lng}`;
}

/**
 * Builds a Google Maps turn-by-turn directions deep-link from `a` to `b`, so the
 * viewer can actually navigate to the other person rather than just see them.
 */
export function directionsLink(a: LatLng, b: LatLng): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${a.lat},${a.lng}&destination=${b.lat},${b.lng}&travelmode=driving`;
}

/** Initial bearing (degrees, 0 = north, clockwise) from `a` to `b`. */
export function bearing(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Compass label (N, NE, …) for a bearing in degrees. */
export function compassLabel(degrees: number): string {
  const points = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const index = Math.round((((degrees % 360) + 360) % 360) / 45) % 8;
  return points[index];
}

/** Geographic midpoint of two coordinates (good enough for a badge anchor). */
export function midpoint(a: LatLng, b: LatLng): LatLng {
  return { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
}

/**
 * Human-friendly "time since" label for a timestamp (ms epoch). Used to show how
 * fresh the counterparty's shared position is — a stale marker is the difference
 * between a useful map and a misleading one.
 */
export function formatRelativeTime(timestamp: number, now = Date.now()): string {
  if (!Number.isFinite(timestamp)) return "";
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
