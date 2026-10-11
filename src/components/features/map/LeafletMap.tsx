"use client";

/**
 * Client-only Leaflet map.
 *
 * This module statically imports `react-leaflet` (and `leaflet`), so it must
 * ONLY ever be loaded through `next/dynamic` with `{ ssr: false }` — see
 * `LocationMap.tsx`. That keeps Leaflet's browser-only globals (`window`) out
 * of the server bundle while still letting us use hooks like `useMap`.
 */

// Leaflet's stylesheet is imported once, globally, in `components/layout/Layout.tsx`.
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import L from "leaflet";
import {
  Circle,
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
  ZoomControl,
} from "react-leaflet";
import {
  accuracyQuality,
  bearing,
  compassLabel,
  directionsLink,
  distanceInMetres,
  formatAccuracy,
  formatDistance,
  formatRelativeTime,
  type LatLng,
} from "./geo";

// Re-export the pure geo helpers/types so existing `import ... from
// "./map/LeafletMap"` consumers keep working — but prefer importing from
// `./map/geo` directly in anything that is NOT the dynamically-loaded map, to
// avoid pulling Leaflet into the server bundle.
export {
  distanceInMetres,
  formatAccuracy,
  formatDistance,
  accuracyQuality,
} from "./geo";
export type { LatLng };

/** A selectable base map. Kept tiny on purpose — two legible, no-key options. */
export type MapTheme = "dark" | "streets";

interface TileConfig {
  url: string;
  /** Tiles are pre-multiplied darkest first; the CSS class tints the container. */
  containerClass: string;
}

/**
 * Base maps.
 *
 * IMPORTANT: both themes intentionally use the standard OpenStreetMap tile
 * server, which needs **no API key**. Several otherwise-nice dark basemaps
 * (CARTO, Mapbox, MapTiler…) now require an access token and silently return a
 * grey "API key required" tile without one. The dark theme therefore reuses the
 * exact same OSM tiles and applies a CSS filter (`.app-map-dark`) to keep the
 * app's dark aesthetic — zero keys, zero cost, and it can never break on a
 * missing secret.
 */
const OSM_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

const TILES: Record<MapTheme, TileConfig> = {
  dark: {
    url: OSM_URL,
    containerClass: "app-map-dark",
  },
  streets: {
    url: OSM_URL,
    containerClass: "app-map-light",
  },
};

interface LeafletMapProps {
  center: LatLng;
  zoom: number;
  userLocation: LatLng | null;
  targetLocation: LatLng | null;
  targetName?: string;
  targetPhone?: string;
  targetRole?: string;
  targetUpdatedAt?: number | null;
  /** Reported accuracy in metres for the target position (lower is better). */
  targetAccuracy?: number | null;
  /** Reported accuracy in metres for the viewer's own position. */
  userAccuracy?: number | null;
  userLabel?: string;
  /** Callback that receives the current map scale label (e.g. "50 m") to render
      in the header. */
  onScale?: (label: string) => void;
}

/** Renders a compact labelled row used inside the marker tooltips. */
function TooltipRow({
  label,
  children,
  tone,
}: {
  label: string;
  children: ReactNode;
  tone?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-slate-400">{label}</span>
      <span className={tone ?? "text-slate-200"}>{children}</span>
    </div>
  );
}


/**
 * The tooltip that currently has its details open. `null` means none are open.
 * A single value (rather than a boolean per marker) guarantees only one detail
 * card is ever visible, so the two pins can never show overlapping tooltips.
 */
export type OpenTooltipId = "user" | "target" | null;

/**
 * A marker whose detailed (dark) tooltip **toggles** on click.
 *
 * The open state is *controlled* by the parent (`LeafletMap`). Only when `open`
 * is true do we render a `Tooltip`, because we render it as a **permanent**
 * tooltip. That matters: Leaflet's `Layer._initTooltipInteractions` binds
 * `mouseover`/`mouseout`/`click` handlers ONLY for *non-permanent* tooltips; a
 * permanent tooltip has no built-in interaction and simply shows while it is
 * mounted. So the sequence is fully deterministic:
 *
 *   - click the pin  → parent flips `open` → the tooltip mounts (permanent shows
 *     immediately) or unmounts (hides);
 *   - click the map  → `MapClickCloser` clears `open` → the tooltip unmounts;
 *   - hover does nothing, so React state can never desync from Leaflet's own
 *     open/close bookkeeping (the old bug: hover-close left state saying "open").
 *
 * `bubblingMouseEvents={false}` keeps the pin's own click from reaching the map,
 * so the background closer does not immediately undo it.
 */
function ClickTooltipMarker({
  id,
  open,
  onToggle,
  position,
  icon,
  children,
  zIndexOffset = 0,
}: {
  id: Exclude<OpenTooltipId, null>;
  open: boolean;
  onToggle: (id: Exclude<OpenTooltipId, null>) => void;
  position: LatLng;
  icon: L.DivIcon;
  children: ReactNode;
  zIndexOffset?: number;
}) {
  return (
    <Marker
      position={[position.lat, position.lng]}
      icon={icon}
      zIndexOffset={zIndexOffset}
      bubblingMouseEvents={false}
      eventHandlers={{
        // Flip the controlled open state. Because this marker does not bubble
        // its click, the map's background `MapClickCloser` does not also run.
        click: () => onToggle(id),
      }}
    >
      {open && (
        <Tooltip
          permanent
          interactive
          direction="top"
          offset={[0, -46]}
          opacity={1}
          className="app-detail-tooltip"
        >
          {/* Stop pointer clicks inside the card from reaching the map, so the
              phone/OSM/directions links stay usable without closing the card. */}
          <div
            onClick={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
          >
            {children}
          </div>
        </Tooltip>
      )}
    </Marker>
  );
}

/**
 * Closes any open tooltip when the user clicks the map background. Rendered once
 * inside the `MapContainer`, so it is the single authority for "tap away to
 * dismiss" instead of each marker juggling its own map listener.
 */
function MapClickCloser({ onClose }: { onClose: () => void }) {
  useMapEvents({
    click: () => onClose(),
  });
  return null;
}

/**
 * Draws the reported GPS accuracy as a translucent ring under a pin. This turns
 * a bare "point" into an honest region — a ±600 m fix should not look as
 * precise as a ±8 m one.
 *
 * Leaflet paints all `Circle`s in the shared SVG overlay pane in mount order,
 * so these are rendered *before* the polylines and markers, which keeps the
 * rings safely behind the pins without needing a custom pane.
 */
function AccuracyRing({
  center,
  radius,
  hex,
}: {
  center: LatLng;
  radius: number;
  hex: string;
}) {
  const radiusMetres = Math.min(Math.max(radius, 5), 5000);
  return (
    <Circle
      center={[center.lat, center.lng]}
      radius={radiusMetres}
      interactive={false}
      pathOptions={{
        color: hex,
        weight: 1.5,
        opacity: 0.7,
        fillColor: hex,
        fillOpacity: 0.12,
      }}
    />
  );
}

/**
 * Binds the distance badge to the polyline **imperatively**.
 *
 * react-leaflet v4's `Polyline` does NOT support a `<Tooltip>` rendered as a
 * child (only `Marker` does). A `<Tooltip>` inside a `<Polyline>` is instead
 * treated as a top-level map layer and anchored at Leaflet's default tooltip
 * position — the map's bottom-left corner — which is exactly the off-target
 * badge this fixes. Binding through the ref lands the tooltip on the line's
 * `getCenter()` (the route midpoint) so it stays glued to the line on every
 * pan/zoom, just as the visible `Polyline` does.
 */
function DistanceBadge({
  label,
  lineRef,
}: {
  label: string;
  lineRef: RefObject<L.Polyline | null>;
}) {
  useEffect(() => {
    const line = lineRef.current;
    if (!line) return;

    const tooltip = L.tooltip({
      permanent: true,
      direction: "center",
      opacity: 1,
      className: "distance-badge-tooltip",
    });

    const pill = document.createElement("span");
    pill.className = "distance-badge-tooltip__pill";
    pill.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2.5" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round"
              d="M12 21s7-6.1 7-11a7 7 0 10-14 0c0 4.9 7 11 7 11z" />
      </svg>
      <span></span>
    `;
    // Set the text safely via textContent (not innerHTML) for user-sourced labels.
    pill.querySelector("span")!.textContent = label;

    tooltip.setContent(pill);
    line.bindTooltip(tooltip);

    return () => {
      line.unbindTooltip();
    };
  }, [label, lineRef]);

  return null;
}

/**
 * Headless bridge that exposes Leaflet's imperative camera API to the overlay
 * controls rendered *outside* the `MapContainer`.
 *
 * React-leaflet's `useMap`/`useMapEvents` only work for components inside the
 * map's React context, but our floating controls must be DOM siblings of the
 * map container (not children of it) or Leaflet's own pane layout is disturbed.
 * This tiny in-map component closes that gap: it owns the `moved` state and
 * reports a stable `fit` callback up via `onReady`.
 */
function MapBridge({
  points,
  onState,
}: {
  points: Array<[number, number]>;
  onState: (state: {
    moved: boolean;
    fit: () => void;
  }) => void;
}) {
  const map = useMap();
  const [moved, setMoved] = useState(false);

  const pointsKey = points.map((p) => p.join(",")).join("|");
  const fit = useCallback(() => {
    if (points.length === 2) {
      map.fitBounds(L.latLngBounds(points), { padding: [70, 70], maxZoom: 17 });
    } else if (points.length === 1) {
      map.setView(points[0], Math.max(map.getZoom(), 15), { animate: true });
    }
    setMoved(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, pointsKey]);

  // A user gesture (drag/zoom) flips the recenter button into its "follow"
  // affordance, inviting the user back to the auto-framed view.
  useMapEvents({
    dragstart: () => setMoved(true),
    zoomstart: () => setMoved(true),
  });

  useEffect(() => {
    onState({ moved, fit });
  }, [onState, moved, fit]);

  return null;
}

/**
 * Headless bridge that surfaces the current map *scale* to the header, which
 * renders it as a compact badge. `ScaleControl` lived in the map's bottom-left
 * corner; it has been removed in favour of this header readout. Leaflet's own
 * scale formula (metres per pixel) is reproduced here so the label always
 * matches what the old control would have shown, and it updates on zoom and
 * move.
 */
function MapScaleBridge({ onScale }: { onScale: (label: string) => void }) {
  const map = useMap();

  // Same rounding helper Leaflet's Control.Scale uses to produce a "nice" number.
  const getRoundNum = (num: number): number => {
    const pow10 = Math.pow(10, (Math.floor(num) + "").length - 1);
    let d = num / pow10;
    d = d >= 10 ? 10 : d >= 5 ? 5 : d >= 3 ? 3 : d >= 2 ? 2 : 1;
    return pow10 * d;
  };

  const computeLabel = useCallback(() => {
    // Metres across a 100px span at the current centre/zoom — Leaflet's own
    // scale basis (`containerPointToLatLng` factors in latitude + zoom).
    const maxMeters = map
      .containerPointToLatLng([0, 0])
      .distanceTo(map.containerPointToLatLng([100, 0]));
    // Prefer a power-of-ten result, mirroring Leaflet's _updateScale logic.
    const meters = getRoundNum(maxMeters);

    let label: string;
    if (meters < 1000) {
      label = `${meters} m`;
    } else {
      const kilometres = meters / 1000;
      label = `${kilometres.toFixed(kilometres < 10 ? 1 : 0)} km`;
    }
    onScale(label);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, onScale]);

  useEffect(() => {
    computeLabel();
    map.on("zoomend moveend", computeLabel);
    return () => {
      map.off("zoomend moveend", computeLabel);
    };
  }, [map, computeLabel]);

  return null;
}

/**
 * Keeps the Leaflet canvas correctly sized AND owns the camera when a single
 * point is known.
 *
 * A `ResizeObserver` catches the modal opening, the window resizing AND the
 * parent flex container settling — the old timeout-only approach missed the
 * latter and left grey/blank tiles. The camera is only re-fitted when the
 * marker positions actually change and the user hasn't taken over the view.
 */
function MapCamera({
  center,
  zoom,
  follow,
}: {
  center: LatLng;
  zoom: number;
  follow: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    const invalidate = () => map.invalidateSize({ animate: false });
    const timer = window.setTimeout(invalidate, 220);
    window.addEventListener("resize", invalidate);

    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined" && map.getContainer()) {
      observer = new ResizeObserver(invalidate);
      observer.observe(map.getContainer());
    }
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", invalidate);
      observer?.disconnect();
    };
  }, [map]);

  // Only take the camera when this component owns it (a single known point and
  // the user hasn't panned away). The stringified key avoids `setView` firing on
  // every unrelated parent re-render, which previously yanked the map back.
  const viewKey = `${center.lat},${center.lng},${zoom},${follow}`;
  useEffect(() => {
    if (!follow) return;
    map.setView([center.lat, center.lng], zoom, { animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, viewKey]);

  return null;
}

/**
 * Floating map control stack (rendered as an overlay above Leaflet's own
 * controls): a recenter/follow button and a base-map theme toggle. Kept as DOM
 * buttons — not Leaflet controls — so they inherit the app's design tokens.
 */
function MapControls({
  moved,
  onFit,
  theme,
  onToggleTheme,
  tilesUnavailable,
  onRetryTiles,
}: {
  moved: boolean;
  onFit: () => void;
  theme: MapTheme;
  onToggleTheme: () => void;
  tilesUnavailable: boolean;
  onRetryTiles: () => void;
}) {
  return (
    <div className="pointer-events-none absolute right-3 top-3 z-[500] flex flex-col items-end gap-2">
      {tilesUnavailable && (
        <button
          type="button"
          onClick={onRetryTiles}
          className="pointer-events-auto inline-flex items-center gap-2 rounded-lg border border-amber-500/40 bg-slate-900/95 px-3 py-2 text-xs font-medium text-amber-300 shadow-lg backdrop-blur transition hover:bg-slate-800"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M20 9A8 8 0 006.3 5.7L4 8m16 8l-2.3 2.3A8 8 0 014 15" />
          </svg>
          Map tiles unavailable — Retry
        </button>
      )}

      <div className="pointer-events-auto flex overflow-hidden rounded-lg border border-slate-700 bg-slate-900/95 shadow-lg backdrop-blur">
        <button
          type="button"
          onClick={onFit}
          title="Recenter on the markers"
          aria-label="Recenter map on the markers"
          className={`inline-flex h-10 w-10 items-center justify-center transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 ${
            moved ? "text-indigo-300" : "text-slate-200"
          }`}
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v3m0 14v3M2 12h3m14 0h3" />
            <circle cx="12" cy="12" r="7" />
            <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
          </svg>
        </button>
        <span className="w-px bg-slate-700" aria-hidden="true" />
        <button
          type="button"
          onClick={onToggleTheme}
          title={theme === "dark" ? "Switch to street map" : "Switch to dark map"}
          aria-label="Toggle base map style"
          className="inline-flex h-10 w-10 items-center justify-center text-slate-200 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
        >
          {theme === "dark" ? (
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <circle cx="12" cy="12" r="4" />
              <path strokeLinecap="round" d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" />
            </svg>
          ) : (
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

/** Watches for tile load failures so the UI can offer a retry. */
function TileErrorWatcher({ onError }: { onError: () => void }) {
  const map = useMap();
  useEffect(() => {
    const handler = () => onError();
    map.on("tileerror", handler);
    return () => {
      map.off("tileerror", handler);
    };
  }, [map, onError]);
  return null;
}

/**
 * Icons are built as inline SVG pins (client-only) so the two markers have
 * explicitly different colours — the viewer's ("You") pin is indigo and the
 * selected person's pin is emerald. Using SVG avoids Leaflet's broken default
 * marker path and the unreliable CSS-filter tinting of a shared blue image.
 *
 * The viewer's pin carries a pulsing halo (see `.app-map-pin--live` in
 * globals.css) to signal "this is your live position"; the target's is a solid,
 * calm teardrop so the two never read as the same thing.
 */
function useIcons() {
  return useMemo(() => {
    const makePin = (color: string, label: string, live = false) =>
      new L.DivIcon({
        className: `app-map-pin${live ? " app-map-pin--live" : ""}`,
        html: `
          <svg width="34" height="46" viewBox="0 0 34 46" fill="none" xmlns="http://www.w3.org/2000/svg">
            ${
              live
                ? `<circle class="app-map-pin__halo" cx="17" cy="17" r="13" fill="${color}" opacity="0.35"/>`
                : ""
            }
            <path d="M17 1C8.7 1 2 7.7 2 16c0 10.5 15 26 15 26s15-15.5 15-26C32 7.7 25.3 1 17 1z"
              fill="${color}" stroke="#ffffff" stroke-width="2"/>
            <text x="17" y="21" text-anchor="middle" font-size="13" font-weight="700" fill="#ffffff" font-family="system-ui, sans-serif">${label}</text>
          </svg>`,
        iconSize: [34, 46],
        iconAnchor: [17, 46],
        popupAnchor: [0, -40],
      });

    return {
      // Viewer ("You") — indigo, with a live halo.
      user: makePin("#4338ca", "Y", true),
      // Selected person — emerald.
      target: makePin("#047857", "T"),
    };
  }, []);
}

export default function LeafletMap({
  center,
  zoom,
  userLocation,
  targetLocation,
  targetName,
  targetPhone,
  targetRole,
  targetUpdatedAt,
  targetAccuracy,
  userAccuracy,
  userLabel,
  onScale,
}: LeafletMapProps) {
  const icons = useIcons();

  // Base-map selection + tile-failure state (retry re-mounts the TileLayer via
  // a fresh `key` so Leaflet re-requests every visible tile).
  const [theme, setTheme] = useState<MapTheme>("dark");
  const [tilesUnavailable, setTilesUnavailable] = useState(false);
  const [tileKey, setTileKey] = useState(0);
  const tiles = TILES[theme];

  // Points to fit the viewport around.
  const points = useMemo(() => {
    const pts: Array<[number, number]> = [];
    if (userLocation) pts.push([userLocation.lat, userLocation.lng]);
    if (targetLocation) pts.push([targetLocation.lat, targetLocation.lng]);
    return pts;
  }, [userLocation, targetLocation]);

  // Distance between the two positions (metres) — shown on the connecting line.
  const distance = useMemo(
    () =>
      userLocation && targetLocation
        ? distanceInMetres(userLocation, targetLocation)
        : null,
    [userLocation, targetLocation],
  );

  // Compass bearing from the viewer to the target, shown on the route badge and
  // in the marker tooltips.
  const direction = useMemo(
    () =>
      userLocation && targetLocation
        ? compassLabel(bearing(userLocation, targetLocation))
        : null,
    [userLocation, targetLocation],
  );

  // Ref to the dashed connecting line, used to imperatively bind the distance
  // badge tooltip (react-leaflet's Polyline has no child-tooltip support).
  const distanceLineRef = useRef<L.Polyline>(null);

  const handleRetryTiles = useCallback(() => {
    setTilesUnavailable(false);
    setTileKey((k) => k + 1);
  }, []);

  // Which marker's detail tooltip is open. A single value means at most one
  // tooltip is ever shown, and the MapClickCloser can dismiss it with one call.
  const [openTooltip, setOpenTooltip] = useState<OpenTooltipId>(null);
  const toggleTooltip = useCallback((id: Exclude<OpenTooltipId, null>) => {
    setOpenTooltip((current) => (current === id ? null : id));
  }, []);
  const closeTooltips = useCallback(() => setOpenTooltip(null), []);

  // If a marker disappears (e.g. the counterparty stops sharing, or our own fix
  // is cleared), drop any tooltip state pointing at it — otherwise a stale id
  // would linger and block reopening the other marker's card.
  useEffect(() => {
    if (openTooltip === "user" && !userLocation) setOpenTooltip(null);
    if (openTooltip === "target" && !targetLocation) setOpenTooltip(null);
  }, [openTooltip, userLocation, targetLocation]);

  // Camera/`moved` state lives in the in-map `MapBridge` (which has access to
  // Leaflet's hooks) and is surfaced here so the overlay controls — rendered
  // outside the map container — can drive/repoint the camera.
  const [viewport, setViewport] = useState<{
    moved: boolean;
    fit: () => void;
  }>({ moved: false, fit: () => {} });
  const handleViewport = useCallback(
    (state: { moved: boolean; fit: () => void }) => setViewport(state),
    [],
  );

  return (
    <div className={`relative h-full w-full ${tiles.containerClass}`}>
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        className="h-full w-full"
        style={{ width: "100%", height: "100%" }}
        scrollWheelZoom
        zoomControl={false}
        attributionControl={false}
      >
        {/* `detectRetina` is deliberately OFF: the OSM tile server does not
            serve @2x tiles, so requesting them 404s and blanks the map. The
            attribution control is hidden too — this app presents the map as an
            ambient visual, not a data source users cite. */}
        <TileLayer
          key={`${theme}-${tileKey}`}
          url={tiles.url}
          maxZoom={19}
          subdomains="abc"
        />

        <MapCamera center={center} zoom={zoom} follow={points.length < 2} />
        <MapBridge points={points} onState={handleViewport} />
        {onScale && <MapScaleBridge onScale={onScale} />}
        <MapClickCloser onClose={closeTooltips} />
        <TileErrorWatcher onError={() => setTilesUnavailable(true)} />

        {/* Leaflet's own controls, repositioned so they don't collide with the
            app's floating overlay stack (top-right) or the status card. The
            scale readout now lives in the header (see `MapScaleBridge`). */}
        <ZoomControl position="bottomright" />

      {/* Accuracy halos — drawn first (lowest in the pane) so they never cover
          the pins or the connecting line. Only shown when the device reported
          a radius, since a made-up circle would be misleading. */}
      {userLocation && typeof userAccuracy === "number" && userAccuracy > 0 && (
        <AccuracyRing
          center={userLocation}
          radius={userAccuracy}
          hex={accuracyQuality(userAccuracy).hex}
        />
      )}
      {targetLocation &&
        typeof targetAccuracy === "number" &&
        targetAccuracy > 0 && (
          <AccuracyRing
            center={targetLocation}
            radius={targetAccuracy}
            hex={accuracyQuality(targetAccuracy).hex}
          />
        )}

      {/* Connecting line + distance between the two positions. Rendered before
          the markers so the pins sit visually on top of it. A soft "casing"
          line under a brighter dash gives the route a readable, premium feel
          on both light and dark basemaps. */}
      {userLocation && targetLocation && (
        <>
          <Polyline
            positions={[
              [userLocation.lat, userLocation.lng],
              [targetLocation.lat, targetLocation.lng],
            ]}
            pathOptions={{
              color: "#1e1b4b",
              weight: 8,
              opacity: 0.35,
              lineCap: "round",
            }}
          />
          <Polyline
            ref={distanceLineRef}
            positions={[
              [userLocation.lat, userLocation.lng],
              [targetLocation.lat, targetLocation.lng],
            ]}
            pathOptions={{
              color: "#6366f1",
              weight: 3.5,
              opacity: 0.95,
              dashArray: "1, 9",
              lineCap: "round",
            }}
          />
          {/* The badge is bound imperatively to the dashed line via its ref, so
              Leaflet anchors it to the route midpoint and keeps it glued to the
              line on every pan and zoom. */}
          {distance !== null && (
            <DistanceBadge
              label={`${formatDistance(distance)}${direction ? ` · ${direction}` : ""}`}
              lineRef={distanceLineRef}
            />
          )}
        </>
      )}

      {/* The viewer's own position — click the pin to open its details. */}
      {userLocation && (
        <ClickTooltipMarker
          id="user"
          open={openTooltip === "user"}
          onToggle={toggleTooltip}
          position={userLocation}
          icon={icons.user}
          zIndexOffset={100}
        >
          <div className="min-w-[11rem] space-y-1 text-xs leading-snug">
            <div className="mb-1 flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-indigo-500 ring-2 ring-indigo-500/30" />
              <strong className="text-slate-100">
                {userLabel || "You are here"}
              </strong>
            </div>

            <TooltipRow label="Latitude" tone="text-slate-300">
              {userLocation.lat.toFixed(5)}
            </TooltipRow>
            <TooltipRow label="Longitude" tone="text-slate-300">
              {userLocation.lng.toFixed(5)}
            </TooltipRow>

            {typeof userAccuracy === "number" && (
              <TooltipRow
                label="Accuracy"
                tone={accuracyQuality(userAccuracy).className}
              >
                {formatAccuracy(userAccuracy)} (
                {accuracyQuality(userAccuracy).label})
              </TooltipRow>
            )}

            {distance !== null && (
              <TooltipRow label="To other" tone="text-indigo-300">
                {formatDistance(distance)}
                {direction ? ` · ${direction}` : ""}
              </TooltipRow>
            )}

            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-slate-700/70 pt-2">
              {targetLocation && (
                <a
                  href={directionsLink(userLocation, targetLocation)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-400 underline hover:text-indigo-300"
                >
                  Directions
                </a>
              )}
            </div>
          </div>
        </ClickTooltipMarker>
      )}

      {/* The selected target's position — click the pin to open its details. */}
      {targetLocation && (
        <ClickTooltipMarker
          id="target"
          open={openTooltip === "target"}
          onToggle={toggleTooltip}
          position={targetLocation}
          icon={icons.target}
          zIndexOffset={200}
        >
          <div className="min-w-[12rem] space-y-1 text-xs leading-snug">
            <div className="mb-1 flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-500/30" />
              <strong className="text-slate-100">
                {targetName || "Customer"}
              </strong>
              {targetRole ? (
                <span className="text-slate-400">· {targetRole}</span>
              ) : null}
            </div>

            {targetPhone ? (
              <TooltipRow label="Phone" tone="text-slate-200">
                <a
                  href={`tel:${targetPhone}`}
                  className="text-indigo-400 underline hover:text-indigo-300"
                >
                  {targetPhone}
                </a>
              </TooltipRow>
            ) : (
              <TooltipRow label="Phone" tone="text-slate-500">
                Not on file
              </TooltipRow>
            )}

            {distance !== null && (
              <TooltipRow label="Distance" tone="text-indigo-300">
                {formatDistance(distance)}
                {direction ? ` · ${direction}` : ""}
              </TooltipRow>
            )}

            {typeof targetAccuracy === "number" && (
              <TooltipRow
                label="Accuracy"
                tone={accuracyQuality(targetAccuracy).className}
              >
                {formatAccuracy(targetAccuracy)} (
                {accuracyQuality(targetAccuracy).label})
              </TooltipRow>
            )}

            {typeof targetUpdatedAt === "number" && (
              <TooltipRow label="Updated" tone="text-slate-400">
                {formatRelativeTime(targetUpdatedAt)} ·{" "}
                {new Date(targetUpdatedAt).toLocaleTimeString()}
              </TooltipRow>
            )}

            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-slate-700/70 pt-2">
              {userLocation && (
                <a
                  href={directionsLink(userLocation, targetLocation)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-400 underline hover:text-indigo-300"
                >
                  Directions
                </a>
              )}
            </div>
          </div>
        </ClickTooltipMarker>
      )}
      </MapContainer>

      {/* Floating app controls, as DOM siblings of the map container so they sit
          above Leaflet's panes and inherit the design system. */}
      <MapControls
        moved={viewport.moved}
        onFit={viewport.fit}
        theme={theme}
        onToggleTheme={() =>
          setTheme((t) => (t === "dark" ? "streets" : "dark"))
        }
        tilesUnavailable={tilesUnavailable}
        onRetryTiles={handleRetryTiles}
      />

    </div>
  );
}
