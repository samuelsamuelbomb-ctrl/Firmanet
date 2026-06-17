import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/swish/AppShell";
import { TrustBar } from "@/components/swish/TrustBar";
import { Locate, Layers, ShieldCheck } from "lucide-react";
import { useSignals, useSignalsRealtime } from "@/lib/swish-store";
import { Signal, SignalCategory } from "@/lib/swish-mock";
import { getMapboxToken } from "@/lib/mapbox.functions";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

export const Route = createFileRoute("/map")({
  head: () => ({
    meta: [
      { title: "Firmanet — Live Map" },
      { name: "description", content: "Live incident clusters, safe zones, and verified alerts across your area." },
    ],
  }),
  component: MapPage,
});

const LAYERS = [
  { id: "crime",    label: "Crime",    dot: "bg-danger" },
  { id: "fire",     label: "Fire",     dot: "bg-peach" },
  { id: "flood",    label: "Flood",    dot: "bg-primary" },
  { id: "accident", label: "Accident", dot: "bg-warn" },
  { id: "sos",      label: "SOS",      dot: "bg-danger" },
  { id: "missing",  label: "Missing",  dot: "bg-foreground" },
  { id: "other",    label: "Other",    dot: "bg-muted-foreground" },
] as const;

const CATEGORY_COLOR: Record<SignalCategory, string> = {
  crime:    "oklch(0.62 0.22 25)",
  fire:     "oklch(0.7 0.2 45)",
  flood:    "oklch(0.6 0.18 235)",
  accident: "oklch(0.78 0.15 75)",
  sos:      "oklch(0.55 0.26 25)",
  missing:  "oklch(0.45 0.04 270)",
  other:    "oklch(0.65 0.02 270)",
};

function MapPage() {
  useSignalsRealtime();
  const navigate = useNavigate();
  const signals = useSignals();
  const [active, setActive] = useState<SignalCategory[]>([
    "crime", "fire", "flood", "accident", "sos", "missing", "other",
  ]);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const geolocateRef = useRef<mapboxgl.GeolocateControl | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await getMapboxToken();
        if (!res.token) setTokenError("Mapbox token not configured.");
        else setToken(res.token);
      } catch (e) {
        setTokenError(e instanceof Error ? e.message : "Failed to load map token");
      }
    })();
  }, []);

  // Init map once token is ready
  useEffect(() => {
    if (!token || !containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: coords ? [coords.lng, coords.lat] : [3.3515, 6.6018],
      zoom: 14,
      attributionControl: false,
      dragPan: true,
      scrollZoom: true,
      touchZoomRotate: true,
      doubleClickZoom: true,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    const geo = new mapboxgl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showUserHeading: true,
      fitBoundsOptions: { maxZoom: 14 },
    });
    map.addControl(geo, "top-right");
    geolocateRef.current = geo;
    map.on("load", () => {
      map.resize();
      // Auto-request user location once map is ready
      try { geo.trigger(); } catch { /* user gesture may be required */ }
    });
    geo.on("geolocate", (e: GeolocationPosition) => {
      setCoords({ lat: e.coords.latitude, lng: e.coords.longitude });
      setGeoError(null);
    });
    geo.on("error", (e: GeolocationPositionError) => {
      setGeoError(e?.message || "Location unavailable. Enable GPS & permissions.");
    });
    mapRef.current = map;
    // Keep canvas sized to container (handles iframe / device-rotation / late layout).
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(containerRef.current);
    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      geolocateRef.current = null;
      markersRef.current.clear();
    };
  }, [token]);

  // Sync signals → markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const visible = signals.filter((s) => {
      if (!active.includes(s.category)) return false;
      if (verifiedOnly && s.state !== "verified") return false;
      return true;
    });
    const seen = new Set<string>();
    for (const s of visible) {
      seen.add(s.id);
      const color = CATEGORY_COLOR[s.category] ?? CATEGORY_COLOR.other;
      const existing = markersRef.current.get(s.id);
      if (existing) {
        existing.setLngLat([s.lng, s.lat]);
        continue;
      }
      const el = document.createElement("button");
      el.className = "swish-marker";
      el.style.cssText = `
        width: 30px; height: 30px; border-radius: 16px;
        background: ${color}; color: white;
        font: 700 11px/30px ui-sans-serif, system-ui;
        text-align: center; border: 3px solid white;
        box-shadow: 0 6px 14px rgba(0,0,0,0.18); cursor: pointer;
      `;
      el.textContent = String(s.reports);
      el.onclick = (e) => {
        e.stopPropagation();
        setSelectedId(s.id);
        map.flyTo({ center: [s.lng, s.lat], zoom: 14, duration: 600 });
      };
      const m = new mapboxgl.Marker({ element: el }).setLngLat([s.lng, s.lat]).addTo(map);
      markersRef.current.set(s.id, m);
    }
    // remove stale markers
    for (const [id, marker] of markersRef.current) {
      if (!seen.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    }
  }, [signals, active, verifiedOnly]);

  const selected: Signal | null = signals.find((s) => s.id === selectedId) ?? null;

  // Continuous high-accuracy watch — keeps coords fresh even if user pans away from
  // the geolocate marker, and surfaces a clear error if permission is denied.
  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setGeoError("This device has no GPS / geolocation API.");
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setCoords({ lat: p.coords.latitude, lng: p.coords.longitude });
        setGeoError(null);
      },
      (err) => {
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied. Enable it in your browser settings."
            : err.message || "Couldn't get location.",
        );
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 15_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // When fresh coords arrive and the map is ready, recenter (only the first time)
  const didCenterRef = useRef(false);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !coords || didCenterRef.current) return;
    map.flyTo({ center: [coords.lng, coords.lat], zoom: 14, duration: 800 });
    didCenterRef.current = true;
  }, [coords]);

  return (
    <AppShell hideSos>
      {/* Full-bleed map (uses dynamic viewport units so iframes / mobile chrome don't collapse it) */}
      <div
        className="relative w-full overflow-hidden bg-surface-elev"
        style={{ height: "100dvh", minHeight: "560px" }}
      >
        <div ref={containerRef} className="absolute inset-0" style={{ width: "100%", height: "100%" }} />

        {!token && !tokenError && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            Loading map…
          </div>
        )}
        {tokenError && (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-danger">
            {tokenError}
          </div>
        )}

        {/* Top overlay: title + layer pills */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-background/90 to-transparent pb-6 pt-3">
          <div className="mx-auto max-w-md px-4">
            <div className="pointer-events-auto flex items-center justify-between">
              <div>
                <h1 className="font-display text-xl font-semibold">Live Map</h1>
                <p className="text-[11px] text-muted-foreground">Real-time signals near you</p>
              </div>
              <span className="glass inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold shadow-soft">
                <Layers className="h-3.5 w-3.5" /> Live
              </span>
            </div>
            <div className="pointer-events-auto mt-3 flex gap-2 overflow-x-auto pb-1">
              <button
                onClick={() => setVerifiedOnly((v) => !v)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold shadow-soft transition-all ${
                  verifiedOnly ? "bg-mint/70 text-mint-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                <ShieldCheck className="h-3.5 w-3.5" /> Verified
              </button>
              {LAYERS.map((l) => {
                const on = active.includes(l.id);
                return (
                  <button
                    key={l.id}
                    onClick={() =>
                      setActive((a) => (on ? a.filter((x) => x !== l.id) : [...a, l.id]))
                    }
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold shadow-soft transition-all ${
                      on ? "bg-card" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${l.dot}`} />
                    {l.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Recenter / locate me */}
        <button
          onClick={() => geolocateRef.current?.trigger()}
          className="absolute bottom-28 right-4 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-card text-foreground shadow-pop active:scale-95"
          aria-label="Center on my location"
        >
          <Locate className="h-5 w-5" />
        </button>

        {/* Coord pill + error banner */}
        {coords && (
          <div className="pointer-events-none absolute bottom-44 right-4 z-10 rounded-full bg-card/95 px-3 py-1.5 text-[10px] font-semibold text-muted-foreground shadow-soft backdrop-blur">
            {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
          </div>
        )}
        {geoError && (
          <div className="absolute inset-x-0 bottom-44 z-10 px-4">
            <div className="mx-auto max-w-md rounded-2xl bg-danger/15 px-3 py-2 text-center text-[11px] font-semibold text-danger shadow-soft">
              {geoError}
            </div>
          </div>
        )}

        {/* Bottom selected-signal sheet */}
        {selected && (
          <div className="absolute inset-x-0 bottom-24 z-10 px-4">
            <div className="mx-auto max-w-md rounded-3xl bg-card p-4 shadow-pop">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold capitalize">
                  {selected.category} · {selected.state.replace("_", " ")}
                </span>
                <button
                  onClick={() => setSelectedId(null)}
                  className="text-[11px] font-semibold text-muted-foreground"
                >
                  Close
                </button>
              </div>
              <h3 className="mt-2 font-display text-lg font-semibold">{selected.title}</h3>
              <p className="text-sm text-muted-foreground">
                {selected.location} · {selected.reports} report{selected.reports === 1 ? "" : "s"} · {selected.minutesAgo} min ago
              </p>
              <div className="mt-3"><TrustBar value={selected.trust} /></div>
              <button
                onClick={() => navigate({ to: "/incident/$id", params: { id: selected.id } })}
                className="mt-3 w-full rounded-2xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground shadow-soft active:scale-[0.98]"
              >
                Open incident detail
              </button>
            </div>
          </div>
        )}

        {signals.length === 0 && !selected && (
          <div className="pointer-events-none absolute inset-x-0 bottom-28 z-10 px-4">
            <div className="mx-auto max-w-md rounded-3xl bg-card/90 p-3 text-center text-xs text-muted-foreground shadow-soft backdrop-blur">
              No signals yet — be the first to report from the Feed.
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}