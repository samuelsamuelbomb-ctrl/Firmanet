/**
 * MapScreen — Live incident map.
 *
 * Strategy:
 * 1. Try @rnmapbox/maps (native) — works in dev builds
 * 2. Fallback to Mapbox GL JS in WebView — works in Expo Go
 *
 * Both use the same signal data from Supabase via signalStore.
 * Features: live markers, layer filters, verified toggle, selected signal sheet, geolocation
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Locate, ShieldCheck, Layers, Map as MapIcon, Navigation } from "lucide-react-native";
import { useSignals, useSignalsRealtime } from "../core/signalStore";
import { useIntensity, useRadius, intensityToMinTrust } from "../core/settingsStore";
import { getMapboxModule, getMapboxToken, MAP_DEFAULT_CENTER, MAP_DEFAULT_ZOOM } from "../core/mapbox";
import { useUserLocation } from "../hooks/useUserLocation";
import { WebView } from "react-native-webview";
import { TrustBar } from "../components/shared/TrustBar";
import type { Signal, SignalCategory } from "../core/types";
import { lightTap, mediumTap } from "../core/haptics";

const LAYERS = [
  { id: "crime" as SignalCategory, label: "Crime",    dot: "#E63946" },
  { id: "fire" as SignalCategory,  label: "Fire",     dot: "#FF8C42" },
  { id: "flood" as SignalCategory, label: "Flood",    dot: "#2D6A4F" },
  { id: "accident" as SignalCategory, label: "Accident", dot: "#F59E0B" },
  { id: "sos" as SignalCategory,   label: "SOS",      dot: "#E63946" },
  { id: "missing" as SignalCategory, label: "Missing", dot: "#1A1A2E" },
  { id: "other" as SignalCategory, label: "Other",    dot: "#6B7280" },
];

const CATEGORY_COLORS: Record<SignalCategory, string> = {
  crime: "#E63946", fire: "#FF8C42", flood: "#2D6A4F",
  accident: "#F59E0B", sos: "#E63946", missing: "#1A1A2E", other: "#6B7280",
};

// ─── Map HTML Generator (runs inside WebView) ───

/** Generate Mapbox GL JS HTML for the WebView fallback */
function generateMapHTML(
  token: string,
  signals: Signal[],
  active: SignalCategory[],
  verifiedOnly: boolean,
  centerLat: number,
  centerLng: number,
  userLat?: number | null,
  userLng?: number | null,
): string {
  const visible = signals.filter((s) => {
    if (!active.includes(s.category)) return false;
    if (verifiedOnly && s.state !== "verified") return false;
    return true;
  });

  const markers = visible.map((s) => ({
    id: s.id, lat: s.lat, lng: s.lng,
    color: CATEGORY_COLORS[s.category] ?? "#6B7280",
    reports: s.reports,
  }));

  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8" />
<meta name="viewport" content="initial-scale=1, maximum-scale=1, user-scalable=no" />
<script src="https://api.mapbox.com/mapbox-gl-js/v3.2.0/mapbox-gl.js"></script>
<link href="https://api.mapbox.com/mapbox-gl-js/v3.2.0/mapbox-gl.css" rel="stylesheet" />
<style>
*{margin:0;padding:0}
html,body,#map{width:100%;height:100%;overflow:hidden}
.mapboxgl-ctrl-group { box-shadow: 0 0 0 2px rgba(0,0,0,0.1)!important; }
</style></head><body>
<div id="map"></div>
<script>
mapboxgl.accessToken='${token}';
const initialCenter = ${userLat && userLng ? `[${userLng}, ${userLat}]` : `[${centerLng},${centerLat}]`};
const map=new mapboxgl.Map({
container:'map',style:'mapbox://styles/mapbox/light-v11',
center: initialCenter,
zoom: 14,
attributionControl:false
});
map.addControl(new mapboxgl.NavigationControl(),'top-right');
const geo=new mapboxgl.GeolocateControl({
positionOptions:{enableHighAccuracy:true,maximumAge:0,timeout:60000},
trackUserLocation:true,showUserHeading:true,showAccuracyCircle:true,
fitBoundsOptions:{maxZoom:17}
});
map.addControl(geo,'top-right');

let userLocation = null;
let userLocationSource = { type: 'geojson', data: { type: 'FeatureCollection', features: ${userLat && userLng ? `[{ type: 'Feature', geometry: { type: 'Point', coordinates: [${userLng}, ${userLat}] } }]` : `[]`} } };
let incidentSource = { type: 'geojson', data: { type: 'FeatureCollection', features: ${JSON.stringify(
  markers.map(m => ({
    type: 'Feature',
    id: m.id,
    geometry: { type: 'Point', coordinates: [m.lng, m.lat] },
    properties: { id: m.id, color: m.color, reports: m.reports }
  }))
)} } };

function updateCustomUserMarker(lng, lat) {
  if (!map) return;
  console.log('Updating custom marker to:', lng, lat);
  userLocation = [lng, lat];
  userLocationSource.data.features = [
    { type: 'Feature', geometry: { type: 'Point', coordinates: [lng, lat] } }
  ];
  
  if (map.getSource('user-location')) {
    map.getSource('user-location').setData(userLocationSource.data);
  } else {
    // If source doesn't exist yet, add it and the layers
    map.addSource('user-location', userLocationSource);
    // Pulsing accuracy ring
    map.addLayer({
      id: 'user-location-pulse',
      type: 'circle',
      source: 'user-location',
      paint: {
        'circle-radius': [
          'interpolate', ['exponential', 1.5], ['zoom'],
          8, 8, 12, 20, 16, 40
        ],
        'circle-color': '#3b82f6',
        'circle-opacity': 0.4,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#3b82f6'
      }
    });
    // User location dot
    map.addLayer({
      id: 'user-location-dot',
      type: 'circle',
      source: 'user-location',
      paint: {
        'circle-radius': [
          'interpolate', ['exponential', 1.5], ['zoom'],
          8, 6, 12, 12, 16, 20
        ],
        'circle-color': '#3b82f6',
        'circle-stroke-width': [
          'interpolate', ['exponential', 1.5], ['zoom'],
          8, 2, 12, 3, 16, 4
        ],
        'circle-stroke-color': '#ffffff'
      }
    });
  }
}

// Listen for all messages from React Native
let shouldFollowUser = true;
function handleMessage(e) {
  try {
    const d = JSON.parse(e.data);
    console.log('Received message from RN:', d);
    if (d.type === 'flyTo') {
      map.flyTo({ center: [d.lng, d.lat], zoom: 14, duration: 800 });
    }
    if (d.type === 'locate') {
      shouldFollowUser = true;
      geo.trigger();
    }
    if (d.type === 'updateUserLocation') {
      updateCustomUserMarker(d.lng, d.lat);
      if (shouldFollowUser) {
        map.easeTo({ center: [d.lng, d.lat], duration: 300 });
      }
    }
  } catch (e) {
    console.error('Error parsing message:', e);
  }
}
document.addEventListener('message', handleMessage);
window.addEventListener('message', handleMessage);

// Setup layers when map loads
map.on('load',function(){
console.log('Map loaded, triggering geolocate');

// Add user location source and layers
map.addSource('user-location', userLocationSource);
// Pulsing accuracy ring
map.addLayer({
  id: 'user-location-pulse',
  type: 'circle',
  source: 'user-location',
  paint: {
    'circle-radius': [
      'interpolate', ['exponential', 1.5], ['zoom'],
      8, 8, 12, 20, 16, 40
    ],
    'circle-color': '#3b82f6',
    'circle-opacity': 0.3,
    'circle-stroke-width': 2,
    'circle-stroke-color': '#3b82f6'
  }
});
// User location dot
map.addLayer({
  id: 'user-location-dot',
  type: 'circle',
  source: 'user-location',
  paint: {
    'circle-radius': [
      'interpolate', ['exponential', 1.5], ['zoom'],
      8, 6, 12, 12, 16, 20
    ],
    'circle-color': '#3b82f6',
    'circle-stroke-width': [
      'interpolate', ['exponential', 1.5], ['zoom'],
      8, 2, 12, 3, 16, 4
    ],
    'circle-stroke-color': '#ffffff'
  }
});

// Add incident markers source and layers
map.addSource('incidents', incidentSource);
// Incident circle background
map.addLayer({
  id: 'incident-circle',
  type: 'circle',
  source: 'incidents',
  paint: {
    'circle-radius': [
      'interpolate', ['exponential', 1.5], ['zoom'],
      8, 8, 12, 15, 16, 22
    ],
    'circle-color': ['get', 'color'],
    'circle-stroke-width': [
      'interpolate', ['exponential', 1.5], ['zoom'],
      8, 2, 12, 3, 16, 4
    ],
    'circle-stroke-color': '#ffffff'
  }
});
// Incident count text
map.addLayer({
  id: 'incident-text',
  type: 'symbol',
  source: 'incidents',
  layout: {
    'text-field': ['to-string', ['get', 'reports']],
    'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
    'text-size': [
      'interpolate', ['exponential', 1.5], ['zoom'],
      8, 9, 12, 11, 16, 13
    ],
    'text-anchor': 'center'
  },
  paint: {
    'text-color': '#ffffff'
  }
});

// Add click handler for incidents
map.on('click', 'incident-circle', (e) => {
  if (e.features.length > 0) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'select',
      id: e.features[0].properties.id
    }));
  }
});

// Change cursor on hover
map.on('mouseenter', 'incident-circle', () => {
  map.getCanvas().style.cursor = 'pointer';
});
map.on('mouseleave', 'incident-circle', () => {
  map.getCanvas().style.cursor = '';
});

try{
geo.trigger();
setTimeout(function(){geo.trigger();},1000);
setTimeout(function(){geo.trigger();},2000);
setTimeout(function(){geo.trigger();},5000);
}catch(e){console.error('Geolocate trigger error:', e)}
});

// Smooth breathing animation for the user pulse
let pulseScale = 1;
let pulseDirection = 1; // 1 = expanding, -1 = contracting
function animatePulse() {
  if (pulseDirection === 1) {
    pulseScale += 0.008;
    if (pulseScale >= 1.8) pulseDirection = -1;
  } else {
    pulseScale -= 0.008;
    if (pulseScale <= 1) pulseDirection = 1;
  }
  
  if (map && map.getLayer('user-location-pulse')) {
    map.setPaintProperty('user-location-pulse', 'circle-radius', [
      'interpolate', ['exponential', 1.5], ['zoom'],
      8, 8 * pulseScale, 12, 20 * pulseScale, 16, 40 * pulseScale
    ]);
    // Opacity is high when small, fades as it expands
    const opacity = 0.6 - (0.4 * ((pulseScale - 1) / 0.8));
    map.setPaintProperty('user-location-pulse', 'circle-opacity', opacity);
  }
  requestAnimationFrame(animatePulse);
}
animatePulse();
</script></body></html>`;
}

// ─── Main MapScreen ───

export default function MapScreen() {
  useSignalsRealtime();
  const navigation = useNavigation<any>();
  const signals = useSignals();
  const alertIntensity = useIntensity();
  const maxRadius = useRadius();
  const [active, setActive] = useState<SignalCategory[]>([
    "crime", "fire", "flood", "accident", "sos", "missing", "other",
  ]);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [shouldFollowUser, setShouldFollowUser] = useState(true);

  // Use the shared useUserLocation hook (GPS + IP fallback + continuous watching)
  const { location, error: locationError, loading: locationLoading, refresh: refreshLocation } = useUserLocation();

  // Follow user when location changes (for both native and webview maps)
  useEffect(() => {
    if (location && shouldFollowUser && mapRef.current) {
      try {
        mapRef.current.flyTo([location.longitude, location.latitude], 14);
      } catch (e) {
        console.warn('Failed to fly to user location:', e);
      }
    }
  }, [location, shouldFollowUser]);

  const selected: Signal | null = signals.find((s) => s.id === selectedId) ?? null;

  const mapRef = useRef<any>(null);

  const recenter = useCallback(() => {
    mediumTap();
    refreshLocation();
    setShouldFollowUser(true);
    if (mapRef.current?.triggerLocate) {
      mapRef.current.triggerLocate();
    }
  }, [refreshLocation]);

  const token = getMapboxToken().token;
  const mapCenter = location ? { lat: location.latitude, lng: location.longitude }
    : { lat: MAP_DEFAULT_CENTER.latitude, lng: MAP_DEFAULT_CENTER.longitude };

  // Show ALL signals on the map regardless of trust filter (the map is a discovery view)
  const mapSignals = signals.filter((s) => s.distanceKm <= maxRadius);

  // Show WebView map when token is present
  const showMap = !!token;

  return (
    <View style={styles.container}>
      {/* Map area */}
      {showMap ? (
        <>
          <LazyMap
            ref={mapRef}
            token={token}
            signals={mapSignals}
            active={active}
            verifiedOnly={verifiedOnly}
            centerLat={mapCenter.lat}
            centerLng={mapCenter.lng}
            onSelect={(id: string) => { mediumTap(); setSelectedId(id); }}
            userLocation={location}
          />
          {/* Location loading overlay */}
          {locationLoading && (
            <View style={styles.locationOverlay}>
              <ActivityIndicator size="small" color="#2D6A4F" />
              <Text style={styles.locationOverlayText}>Getting your location…</Text>
            </View>
          )}
          {/* Location error banner */}
          {locationError && (
            <View style={styles.locationBanner}>
              <Text style={styles.locationBannerText}>{locationError}</Text>
              <TouchableOpacity onPress={() => { lightTap(); refreshLocation(); }}>
                <Text style={styles.locationBannerRetry}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      ) : !token ? (
        <View style={styles.placeholder}>
          <MapIcon size={48} color="#9CA3AF" />
          <Text style={styles.placeholderTitle}>Live Map</Text>
          <Text style={styles.placeholderSub}>
            Configure EXPO_PUBLIC_MAPBOX_TOKEN or VITE_MAPBOX_PUBLIC_TOKEN in .env
          </Text>
        </View>
      ) : (
        <View style={styles.mapLoading}>
          <ActivityIndicator size="large" color="#2D6A4F" />
          <Text style={styles.mapLoadingText}>Loading map…</Text>
        </View>
      )}

      {/* Overlay: top header + filters */}
      <View style={styles.overlayTop}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Live Map</Text>
            <Text style={styles.headerSub}>Real-time signals near you</Text>
          </View>
          <View style={styles.liveBadge}>
            <Layers size={14} color="#2D6A4F" />
            <Text style={styles.liveText}>Live</Text>
          </View>
        </View>
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterPill, verifiedOnly && styles.filterPillActive]}
            onPress={() => { lightTap(); setVerifiedOnly((v) => !v); }}
          >
            <ShieldCheck size={14} color={verifiedOnly ? "#2D6A4F" : "#6B7280"} />
            <Text style={[styles.filterText, verifiedOnly && styles.filterTextActive]}>Verified</Text>
          </TouchableOpacity>
          {LAYERS.map((l) => {
            const on = active.includes(l.id);
            return (
              <TouchableOpacity
                key={l.id}
                style={[styles.filterPill, on && styles.filterPillLayer]}
                onPress={() => { lightTap(); setActive((a) => (on ? a.filter((x) => x !== l.id) : [...a, l.id])); }}
              >
                <View style={[styles.filterDot, { backgroundColor: l.dot }]} />
                <Text style={styles.filterText}>{l.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Recenter button */}
      <TouchableOpacity style={styles.locateBtn} onPress={recenter}>
        <Locate size={20} color="#1A1A2E" />
      </TouchableOpacity>

      {/* Selected signal sheet */}
      {selected && (
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <View style={styles.sheetBadge}>
              <Text style={styles.sheetBadgeText}>{selected.category} · {selected.state.replace("_", " ")}</Text>
            </View>
            <TouchableOpacity onPress={() => { lightTap(); setSelectedId(null); }}>
              <Text style={styles.sheetClose}>Close</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.sheetTitle}>{selected.title}</Text>
          <Text style={styles.sheetMeta}>
            {selected.location} · {selected.reports} report{selected.reports === 1 ? "" : "s"} · {selected.minutesAgo} min ago
          </Text>
          <TrustBar value={selected.trust} />
          <TouchableOpacity
            style={styles.sheetBtn}
            onPress={() => {
              setSelectedId(null);
              lightTap();
              navigation.navigate("MainStack", { screen: "IncidentDetail", params: { id: selected.id } });
            }}
          >
            <Text style={styles.sheetBtnText}>Open incident detail</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── Native Map Component (@rnmapbox/maps) ───

const NativeMap = React.forwardRef(({
  token, signals, active, verifiedOnly, centerLat, centerLng, onSelect,
}: {
  token: string; signals: Signal[]; active: SignalCategory[]; verifiedOnly: boolean;
  centerLat: number; centerLng: number; onSelect: (id: string) => void;
}, parentRef: any) => {
  const [Mapbox, setMapbox] = useState<any>(null);
  const mapRef = useRef<any>(null);
  const hasFlownRef = useRef(false);
  
  // Expose map ref to parent
  React.useImperativeHandle(parentRef, () => ({
    flyTo: (coords, zoom) => {
      if (mapRef.current && Mapbox) {
        try {
          mapRef.current.flyTo(coords, zoom);
        } catch (e) {
          console.warn('Fly to failed:', e);
        }
      }
    }
  }));

  const visibleSignals = useMemo(() => {
    return signals.filter((s) => {
      if (!active.includes(s.category)) return false;
      if (verifiedOnly && s.state !== "verified") return false;
      return true;
    });
  }, [signals, active, verifiedOnly]);

  const incidentGeoJSON = useMemo(() => ({
    type: 'FeatureCollection',
    features: visibleSignals.map(s => ({
      type: 'Feature',
      id: s.id,
      geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
      properties: { id: s.id, color: CATEGORY_COLORS[s.category] ?? "#6B7280", reports: s.reports }
    }))
  }), [visibleSignals]);

  useEffect(() => {
    getMapboxModule().then(setMapbox);
  }, []);

  const triggerLocate = useCallback(() => {
    const map = mapRef.current;
    if (map && Mapbox) {
      map.flyTo([centerLng, centerLat], 17);
    }
  }, [centerLng, centerLat, Mapbox]);

  React.useImperativeHandle(ref, () => ({
    triggerLocate
  }), [triggerLocate]);

  // Fly to user's location when available
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !Mapbox || hasFlownRef.current) return;
    const isDefault =
      centerLat === MAP_DEFAULT_CENTER.latitude && centerLng === MAP_DEFAULT_CENTER.longitude;
    if (isDefault) return;
    hasFlownRef.current = true;
    setTimeout(() => {
      try {
        map.flyTo([centerLng, centerLat], 14);
      } catch {}
    }, 500);
  }, [centerLat, centerLng, Mapbox]);

  if (!Mapbox) return <View style={styles.mapLoading} />;

  const { MapView, Camera, UserLocation, ShapeSource, CircleLayer, SymbolLayer } = Mapbox;

  return (
    <View style={styles.mapContainer}>
      <MapView
        ref={mapRef}
        style={styles.map}
        styleURL="mapbox://styles/mapbox/light-v11"
        logoEnabled={false}
        attributionEnabled={false}
      >
        <Camera
          centerCoordinate={[centerLng, centerLat]}
          zoomLevel={MAP_DEFAULT_ZOOM}
        />
        <UserLocation
          visible={true}
          showsUserHeadingIndicator={true}
          androidRenderMode="gps"
        />

        <ShapeSource id="incidents" shape={incidentGeoJSON} onPress={(e) => {
          if (e.features && e.features.length > 0) {
            onSelect(e.features[0].id as string);
          }
        }}>
          <CircleLayer
            id="incident-circle"
            style={{
              circleRadius: [
                'interpolate', ['exponential', 1.5], ['zoom'],
                8, 8, 12, 15, 16, 22
              ],
              circleColor: ['get', 'color'],
              circleStrokeWidth: [
                'interpolate', ['exponential', 1.5], ['zoom'],
                8, 2, 12, 3, 16, 4
              ],
              circleStrokeColor: '#ffffff'
            }}
          />
          <SymbolLayer
            id="incident-text"
            style={{
              textField: ['to-string', ['get', 'reports']],
              textFont: ['Open Sans Bold', 'Arial Unicode MS Bold'],
              textSize: [
                'interpolate', ['exponential', 1.5], ['zoom'],
                8, 9, 12, 11, 16, 13
              ],
              textAnchor: 'center',
              textColor: '#ffffff'
            }}
          />
        </ShapeSource>
      </MapView>

      {/* We'll add layer press handling later if needed, but for now let's keep it simple */}
      <View style={styles.mapCredit}>
        <Navigation size={10} color="#6B7280" />
        <Text style={styles.mapCreditText}>Mapbox · Firmanet</Text>
      </View>
    </View>
  );
});

// ─── WebView Map Component ───

// Expose a ref to let parent trigger locate
const WebViewMap = React.forwardRef(({
  token, signals, active, verifiedOnly, centerLat, centerLng, onSelect, userLocation,
}: {
  token: string; signals: Signal[]; active: SignalCategory[]; verifiedOnly: boolean;
  centerLat: number; centerLng: number; onSelect: (id: string) => void;
  userLocation?: { latitude: number; longitude: number; locationName?: string } | null;
}, ref: any) => {
  const wvRef = useRef<any>(null);
  const hasFlownRef = useRef(false);

  const handleMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "select") onSelect(data.id);
    } catch {}
  }, [onSelect]);

  const triggerLocate = useCallback(() => {
    if (wvRef.current) {
      wvRef.current.postMessage(JSON.stringify({ type: "locate" }));
    }
  }, []);

  React.useImperativeHandle(ref, () => ({
    triggerLocate
  }), [triggerLocate]);

  // Regenerate HTML when filters/signals change
  const html = useMemo(() => generateMapHTML(
    token, signals, active, verifiedOnly, centerLat, centerLng,
    userLocation?.latitude, userLocation?.longitude,
  ), [token, signals, active, verifiedOnly, centerLat, centerLng, userLocation]);

  // Send location updates to WebView whenever userLocation changes
  useEffect(() => {
    if (userLocation && wvRef.current) {
      wvRef.current.postMessage(
        JSON.stringify({
          type: "updateUserLocation",
          lat: userLocation.latitude,
          lng: userLocation.longitude,
        })
      );
    }
  }, [userLocation]);

  // Fly to user's location when available
  useEffect(() => {
    const wv = wvRef.current;
    if (!wv || hasFlownRef.current) return;
    const isDefault =
      centerLat === MAP_DEFAULT_CENTER.latitude && centerLng === MAP_DEFAULT_CENTER.longitude;
    if (isDefault) return;
    hasFlownRef.current = true;
    const timer = setTimeout(() => {
      try {
        wv.postMessage(JSON.stringify({ type: "flyTo", lat: centerLat, lng: centerLng }));
      } catch {}
    }, 1500);
    return () => clearTimeout(timer);
  }, [centerLat, centerLng]);

  // Send location updates to WebView
  useEffect(() => {
    if (userLocation && wvRef.current) {
      console.log('User location changed, sending update:', userLocation);
      wvRef.current.postMessage(JSON.stringify({
        type: 'updateUserLocation',
        lng: userLocation.longitude,
        lat: userLocation.latitude,
      }));
    }
  }, [userLocation]);

  // Immediately send location to webview when it loads
  const handleWebViewLoadEnd = useCallback(() => {
    if (userLocation) {
      console.log('WebView loaded, sending initial location:', userLocation);
      setTimeout(() => {
        if (wvRef.current) {
          wvRef.current.postMessage(JSON.stringify({
            type: 'updateUserLocation',
            lng: userLocation.longitude,
            lat: userLocation.latitude,
          }));
        }
      }, 500);
    }
  }, [userLocation]);

  return (
    <View style={styles.mapContainer}>
      <WebView
        ref={wvRef}
        source={{ html }}
        style={styles.map}
        scrollEnabled={false}
        bounces={false}
        onMessage={handleMessage}
        onLoadEnd={handleWebViewLoadEnd}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={["*"]}
        geolocationEnabled={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
      />
      <View style={styles.mapCredit}>
        <Navigation size={10} color="#6B7280" />
        <Text style={styles.mapCreditText}>Mapbox · Firmanet</Text>
      </View>
    </View>
  );
});

// ─── Lazy Map Loader ───

const LazyMap = React.forwardRef(({
  token, signals, active, verifiedOnly, centerLat, centerLng, onSelect, userLocation,
}: {
  token: string; signals: Signal[]; active: SignalCategory[]; verifiedOnly: boolean;
  centerLat: number; centerLng: number; onSelect: (id: string) => void;
  userLocation?: { latitude: number; longitude: number; locationName?: string } | null;
}, parentRef: any) => {
  const [useNative, setUseNative] = useState<boolean | null>(null);
  const nativeMapRef = useRef<any>(null);
  const webViewMapRef = useRef<any>(null);

  const triggerLocate = useCallback(() => {
    if (useNative && nativeMapRef.current) {
      nativeMapRef.current.triggerLocate?.();
    } else if (!useNative && webViewMapRef.current) {
      webViewMapRef.current.triggerLocate();
    }
  }, [useNative]);

  const flyTo = useCallback((coords, zoom) => {
    if (useNative && nativeMapRef.current) {
      nativeMapRef.current.flyTo?.(coords, zoom);
    } else if (!useNative && webViewMapRef.current && webViewMapRef.current.postMessage) {
      webViewMapRef.current.postMessage(JSON.stringify({
        type: 'flyTo',
        lng: coords[0],
        lat: coords[1]
      }));
    }
  }, [useNative]);

  React.useImperativeHandle(parentRef, () => ({
    triggerLocate,
    flyTo
  }), [triggerLocate, flyTo]);

  useEffect(() => {
    if (Platform.OS === "web") {
      setUseNative(false);
      return;
    }
    
    // Check if in Expo Go first
    let isExpoGo = true;
    try {
      const Constants = require('expo-constants');
      isExpoGo = Constants.executionEnvironment !== 'standalone';
    } catch (e) {
      isExpoGo = true;
    }
    
    if (isExpoGo) {
      console.log("[LazyMap] Expo Go detected - using WebView map");
      setUseNative(false);
      return;
    }
    
    getMapboxModule().then((mod) => {
      setUseNative(!!mod);
    }).catch(() => {
      setUseNative(false);
    });
  }, []);

  if (useNative === null) {
    return (
      <View style={styles.mapLoading}>
        <ActivityIndicator size="large" color="#2D6A4F" />
        <Text style={styles.mapLoadingText}>Loading map…</Text>
      </View>
    );
  }

  if (useNative) {
    return (
      <NativeMap
        ref={nativeMapRef}
        token={token}
        signals={signals}
        active={active}
        verifiedOnly={verifiedOnly}
        centerLat={centerLat}
        centerLng={centerLng}
        onSelect={onSelect}
      />
    );
  }

  return (
    <WebViewMap
      ref={webViewMapRef}
      token={token}
      signals={signals}
      active={active}
      verifiedOnly={verifiedOnly}
      centerLat={centerLat}
      centerLng={centerLng}
      onSelect={onSelect}
      userLocation={userLocation}
    />
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F8FB" },
  mapContainer: { width: "100%", height: "100%" },
  map: { width: "100%", height: "100%" },
  mapLoading: { flex: 1, justifyContent: "center", alignItems: "center", gap: 8 },
  mapLoadingText: { fontSize: 13, color: "#6B7280" },
  nativeMarker: {
    width: 30, height: 30, borderRadius: 15,
    borderWidth: 3, borderColor: "#FFFFFF",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  nativeMarkerText: {
    color: "#FFFFFF", fontSize: 11, fontWeight: "700",
  },
  // Manual user marker styles
  userMarkerContainer: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: 50,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  pulseRing: {
    position: "absolute",
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(59, 130, 246, 0.5)",
    borderWidth: 2,
    borderColor: "#3b82f6",
  },
  userDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#3b82f6",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 8,
  },
  mapCredit: {
    position: "absolute", bottom: 8, left: 16,
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(255,255,255,0.8)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  mapCreditText: { fontSize: 9, color: "#6B7280" },
  placeholder: {
    flex: 1, justifyContent: "center", alignItems: "center",
    paddingHorizontal: 40, gap: 16,
  },
  placeholderTitle: { fontSize: 22, fontWeight: "600", fontFamily: "Outfit", color: "#1A1A2E" },
  placeholderSub: { fontSize: 14, color: "#6B7280", textAlign: "center", lineHeight: 20 },
  overlayTop: {
    position: "absolute", top: 0, left: 0, right: 0,
    paddingTop: 50, paddingHorizontal: 16, paddingBottom: 24,
    backgroundColor: "rgba(247, 248, 251, 0.9)",
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerTitle: { fontSize: 20, fontWeight: "600", fontFamily: "Outfit", color: "#1A1A2E" },
  headerSub: { fontSize: 11, color: "#6B7280" },
  liveBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(255,255,255,0.8)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
  },
  liveText: { fontSize: 11, fontWeight: "600", color: "#2D6A4F" },
  filterRow: { flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap" },
  filterPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#E5E7EB", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
  },
  filterPillActive: { backgroundColor: "#D8F3DC" },
  filterPillLayer: { backgroundColor: "#FFFFFF" },
  filterDot: { width: 8, height: 8, borderRadius: 4 },
  filterText: { fontSize: 12, fontWeight: "600", color: "#6B7280" },
  filterTextActive: { color: "#2D6A4F" },
  locateBtn: {
    position: "absolute", bottom: 130, right: 16,
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: "#FFFFFF", justifyContent: "center", alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 6,
  },
  locationBanner: {
    position: "absolute", top: 160, left: 16, right: 16,
    backgroundColor: "rgba(230, 57, 70, 0.12)",
    borderRadius: 16, paddingHorizontal: 16, paddingVertical: 10,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  locationBannerText: { flex: 1, fontSize: 12, fontWeight: "600", color: "#E63946", marginRight: 8 },
  locationBannerRetry: { fontSize: 12, fontWeight: "700", color: "#E63946" },
  locationOverlay: {
    position: "absolute", top: 160, left: 16, right: 16,
    backgroundColor: "rgba(45, 106, 79, 0.1)",
    borderRadius: 16, paddingHorizontal: 16, paddingVertical: 10,
    flexDirection: "row", alignItems: "center", gap: 8,
  },
  locationOverlayText: { fontSize: 12, fontWeight: "600", color: "#2D6A4F" },
  sheet: {
    position: "absolute", bottom: 90, left: 16, right: 16,
    backgroundColor: "#FFFFFF", borderRadius: 24, padding: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 12, elevation: 8,
  },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sheetBadge: { backgroundColor: "#E5E7EB", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  sheetBadgeText: { fontSize: 10, fontWeight: "600", textTransform: "capitalize", color: "#1A1A2E" },
  sheetClose: { fontSize: 11, fontWeight: "600", color: "#6B7280" },
  sheetTitle: { fontSize: 18, fontWeight: "600", fontFamily: "Outfit", color: "#1A1A2E", marginTop: 8 },
  sheetMeta: { fontSize: 13, color: "#6B7280", marginTop: 4 },
  sheetBtn: { marginTop: 12, backgroundColor: "#2D6A4F", paddingVertical: 12, borderRadius: 16, alignItems: "center" },
  sheetBtnText: { fontSize: 13, fontWeight: "600", color: "#FFFFFF" },
});