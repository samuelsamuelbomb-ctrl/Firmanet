/**
 * MapScreen — Live incident map using @rnmapbox/maps.
 *
 * Ported from /routes/map.tsx
 * Replaces: mapbox-gl-web with @rnmapbox/maps
 * Preserves: signal markers, layer filters, selected signal sheet, geolocation
 *
 * NOTE: @rnmapbox/maps requires an Expo dev build. In Expo Go,
 * this screen shows a placeholder instead of crashing.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Locate, ShieldCheck, Layers, Map as MapIcon } from "lucide-react-native";
import { useSignals, useSignalsRealtime } from "../core/signalStore";
import { getMapboxModule, getMapboxToken, MAP_DEFAULT_CENTER, MAP_DEFAULT_ZOOM } from "../core/mapbox";
import { TrustBar } from "../components/shared/TrustBar";
import type { Signal, SignalCategory } from "../core/types";

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
  crime: "#E63946",
  fire: "#FF8C42",
  flood: "#2D6A4F",
  accident: "#F59E0B",
  sos: "#E63946",
  missing: "#1A1A2E",
  other: "#6B7280",
};

export default function MapScreen() {
  useSignalsRealtime();
  const navigation = useNavigation<any>();
  const signals = useSignals();
  const cameraRef = useRef<any>(null);
  const [active, setActive] = useState<SignalCategory[]>([
    "crime", "fire", "flood", "accident", "sos", "missing", "other",
  ]);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapsModule, setMapsModule] = useState<any>(null);

  // Try to load @rnmapbox/maps lazily
  useEffect(() => {
    let mounted = true;
    void (async () => {
      const mod = await getMapboxModule();
      if (!mounted) return;
      if (mod) {
        try {
          mod.default.setAccessToken(getMapboxToken().token);
        } catch {}
        setMapsModule(mod);
        setMapReady(true);
      } else {
        setMapReady(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Geolocation
  useEffect(() => {
    // In RN, use expo-location
    void (async () => {
      try {
        const { getCurrentPositionAsync, requestForegroundPermissionsAsync } = await import("expo-location");
        const { status } = await requestForegroundPermissionsAsync();
        if (status === "granted") {
          const pos = await getCurrentPositionAsync({});
          setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        }
      } catch {}
    })();
  }, []);

  const visible = signals.filter((s) => {
    if (!active.includes(s.category)) return false;
    if (verifiedOnly && s.state !== "verified") return false;
    return true;
  });

  const selected: Signal | null = signals.find((s) => s.id === selectedId) ?? null;

  const recenter = useCallback(() => {
    if (cameraRef.current) {
      const center = coords
        ? [coords.lng, coords.lat]
        : [MAP_DEFAULT_CENTER.longitude, MAP_DEFAULT_CENTER.latitude];
      cameraRef.current.flyTo(center, 600);
    }
  }, [coords]);

  // Show placeholder if @rnmapbox/maps is not available (Expo Go)
  if (!mapsModule) {
    return (
      <View style={styles.container}>
        <View style={styles.placeholder}>
          <MapIcon size={48} color="#9CA3AF" />
          <Text style={styles.placeholderTitle}>Live Map</Text>
          <Text style={styles.placeholderSub}>
            Map requires a development build.
            {"\n"}Run `npx expo run:ios` to enable the map.
          </Text>
        </View>
        {selected && (
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <View style={styles.sheetBadge}>
                <Text style={styles.sheetBadgeText}>{selected.category} · {selected.state.replace("_", " ")}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedId(null)}>
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

  const MapView = mapsModule.default.MapView;
  const Camera = mapsModule.default.Camera;
  const MarkerView = mapsModule.default.MarkerView;
  const UserLocation = mapsModule.default.UserLocation;

  // Map module is loaded — render the real map
  return (
    <View style={styles.container}>
      <MapView style={styles.map} styleURL="mapbox://styles/mapbox/light-v11">
        <Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: [MAP_DEFAULT_CENTER.longitude, MAP_DEFAULT_CENTER.latitude],
            zoomLevel: MAP_DEFAULT_ZOOM,
          }}
        />
        <UserLocation visible={true} showsUserHeadingIndicator={true} />
        {visible.map((s) => (
          <MarkerView
            key={s.id}
            id={s.id}
            coordinate={[s.lng, s.lat]}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <TouchableOpacity
              style={[styles.marker, { backgroundColor: CATEGORY_COLORS[s.category] ?? "#6B7280" }]}
              onPress={() => {
                setSelectedId(s.id);
                cameraRef.current?.flyTo([s.lng, s.lat], 600);
              }}
            >
              <Text style={styles.markerText}>{s.reports}</Text>
            </TouchableOpacity>
          </MarkerView>
        ))}
      </MapView>

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
            onPress={() => setVerifiedOnly((v) => !v)}
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
                onPress={() => setActive((a) => (on ? a.filter((x) => x !== l.id) : [...a, l.id]))}
              >
                <View style={[styles.filterDot, { backgroundColor: l.dot }]} />
                <Text style={styles.filterText}>{l.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <TouchableOpacity style={styles.locateBtn} onPress={recenter}>
        <Locate size={20} color="#1A1A2E" />
      </TouchableOpacity>

      {selected && (
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <View style={styles.sheetBadge}>
              <Text style={styles.sheetBadgeText}>{selected.category} · {selected.state.replace("_", " ")}</Text>
            </View>
            <TouchableOpacity onPress={() => setSelectedId(null)}>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F8FB" },
  map: { width: "100%", height: "100%" },
  placeholder: {
    flex: 1, justifyContent: "center", alignItems: "center",
    paddingHorizontal: 40, gap: 16,
  },
  placeholderTitle: { fontSize: 22, fontWeight: "600", fontFamily: "Outfit", color: "#1A1A2E" },
  placeholderSub: { fontSize: 14, color: "#6B7280", textAlign: "center", lineHeight: 20 },
  marker: {
    width: 30, height: 30, borderRadius: 16,
    justifyContent: "center", alignItems: "center",
    borderWidth: 3, borderColor: "#FFFFFF",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18, shadowRadius: 6, elevation: 6,
  },
  markerText: { fontSize: 11, fontWeight: "700", color: "#FFFFFF" },
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