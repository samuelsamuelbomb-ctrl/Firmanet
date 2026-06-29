/**
 * SettingsScreen — Alert intensity, vibration, radius, quiet hours, sponsors.
 *
 * Ported from /routes/settings.tsx
 * Settings are persisted to AsyncStorage and loaded on mount.
 * Uses the shared settings store so all screens react to changes.
 */

import { useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image } from "react-native";
import Slider from "@react-native-community/slider";
import { AppShell } from "../components/shared/AppShell";
import { TopBar } from "../components/shared/TopBar";
import { useSponsors, useSponsorsBootstrap } from "../core/sponsorStore";
import { Volume2, Vibrate, Radius, Moon, BellRing, Handshake } from "lucide-react-native";
import { lightTap, selectionTick } from "../core/haptics";
import { useSettingsStore } from "../core/settingsStore";
import type { IntensityId } from "../core/settingsStore";

const INTENSITIES = [
  { id: "minimal", label: "Minimal", sub: "Only critical alerts", color: "#2D6A4F" },
  { id: "balanced", label: "Balanced", sub: "Recommended for most", color: "#F59E0B" },
  { id: "full", label: "Full", sub: "All verified signals", color: "#E63946" },
] as const;

export default function SettingsScreen() {
  const intensity = useSettingsStore((s) => s.intensity);
  const vibration = useSettingsStore((s) => s.vibration);
  const radius = useSettingsStore((s) => s.radius);
  const quietHours = useSettingsStore((s) => s.quietHours);
  const loaded = useSettingsStore((s) => s.loaded);
  const load = useSettingsStore((s) => s.load);
  const setIntensity = useSettingsStore((s) => s.setIntensity);
  const setVibration = useSettingsStore((s) => s.setVibration);
  const setRadius = useSettingsStore((s) => s.setRadius);
  const setQuietHours = useSettingsStore((s) => s.setQuietHours);
  
  const sponsors = useSponsors();
  const { isBootstrapped: sponsorsBootstrapped, isLoading: sponsorsLoading, bootstrap: bootstrapSponsors } = useSponsorsBootstrap();

  // Load persisted settings on mount
  useEffect(() => {
    void load();
    void bootstrapSponsors();
  }, [load, bootstrapSponsors]);

  return (
    <AppShell>
      <TopBar />
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.sub}>Stay calm. Get loud only when reality demands it.</Text>

        {/* Alert Intensity */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <BellRing size={16} color="#2D6A4F" />
            <Text style={styles.cardTitle}>Alert Sound Intensity</Text>
          </View>
          <View style={styles.intensityGrid}>
            {INTENSITIES.map((opt) => (
              <TouchableOpacity
                key={opt.id}
                style={[styles.intensityOption, intensity === opt.id && { borderColor: opt.color, borderWidth: 2 }]}
                onPress={() => {
                  lightTap();
                  setIntensity(opt.id as IntensityId);
                }}
              >
                <View style={[styles.intensityBadge, { backgroundColor: opt.color + "30" }]}>
                  <Text style={[styles.intensityBadgeText, { color: opt.color }]}>{opt.label}</Text>
                </View>
                <Text style={styles.intensitySub}>{opt.sub}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Sliders */}
        <View style={styles.card}>
          <SliderRow icon={<Vibrate size={16} color="#1A1A2E" />} label="Vibration strength" value={vibration} onChange={setVibration} unit="%" />
          <View style={styles.divider} />
          <SliderRow icon={<Radius size={16} color="#1A1A2E" />} label="Radius sensitivity" value={radius} min={1} max={10} onChange={setRadius} unit=" km" />
          <View style={styles.divider} />
          <View style={styles.toggleRow}>
            <View style={styles.toggleLabel}>
              <Moon size={16} color="#1A1A2E" />
              <Text style={styles.toggleText}>Quiet hours</Text>
            </View>
            <TouchableOpacity
              style={[styles.toggle, quietHours && styles.toggleOn]}
              onPress={() => {
                selectionTick();
                setQuietHours(!quietHours);
              }}
            >
              <View style={[styles.toggleKnob, quietHours && styles.toggleKnobOn]} />
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.footer}>Firmanet · calm by default, loud when it matters.</Text>

        {/* Sponsors */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Handshake size={16} color="#2D6A4F" />
            <Text style={styles.cardTitle}>Firmanet Safety Partners</Text>
          </View>
          <Text style={styles.sponsorDesc}>
            Organizations supporting Nigeria's safety infrastructure. Sponsors never appear in active alerts or emergency flows.
          </Text>
          {sponsorsLoading ? (
            <View style={styles.sponsorLoadingContainer}>
              <ActivityIndicator size="small" color="#2D6A4F" />
              <Text style={styles.sponsorLoadingText}>Loading partners...</Text>
            </View>
          ) : (
            sponsors.map((s) => (
              <View key={s.id} style={styles.sponsorCard}>
                {s.image_url ? (
                  <Image
                    source={{ uri: s.image_url }}
                    style={styles.sponsorLogo}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.sponsorLogo, { backgroundColor: s.accent }]}>
                    <Text style={styles.sponsorInitials}>{s.initials}</Text>
                  </View>
                )}
                <View>
                  <Text style={styles.sponsorName}>{s.name}</Text>
                  <Text style={styles.sponsorTagline}>{s.tagline}</Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </AppShell>
  );
}

function SliderRow({
  icon,
  label,
  value,
  min = 0,
  max = 100,
  unit = "",
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  min?: number;
  max?: number;
  unit?: string;
  onChange: (n: number) => void;
}) {
  return (
    <View>
      <View style={styles.sliderHeader}>
        <View style={styles.sliderLabel}>
          {icon}
          <Text style={styles.sliderLabelText}>{label}</Text>
        </View>
        <Text style={styles.sliderValue}>
          {value}
          {unit}
        </Text>
      </View>
      <View style={styles.sliderTrack}>
        <View style={[styles.sliderFill, { width: `${((value - min) / (max - min)) * 100}%` }]} />
      </View>
      <Slider
        style={styles.slider}
        minimumValue={min}
        maximumValue={max}
        step={1}
        value={value}
        onValueChange={onChange}
        minimumTrackTintColor="#2D6A4F"
        maximumTrackTintColor="#E5E7EB"
        thumbTintColor="#2D6A4F"
      />
      <View style={styles.sliderTouchArea}>
        {[
          min,
          Math.round((max - min) / 4 + min),
          Math.round((max - min) / 2 + min),
          Math.round(3 * (max - min) / 4 + min),
          max,
        ].map((v) => (
          <TouchableOpacity
            key={v}
            style={styles.sliderStop}
            onPress={() => {
              selectionTick();
              onChange(v);
            }}
          >
            <View style={[styles.sliderDot, value >= v && styles.sliderDotActive]} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: "600", fontFamily: "Outfit", color: "#1A1A2E" },
  sub: { fontSize: 13, color: "#6B7280", marginTop: 4, marginBottom: 20 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  cardTitle: { fontSize: 14, fontWeight: "600", fontFamily: "Outfit", color: "#1A1A2E" },
  intensityGrid: { flexDirection: "row", gap: 8 },
  intensityOption: { flex: 1, backgroundColor: "#F3F4F6", borderRadius: 16, padding: 12, borderWidth: 1, borderColor: "transparent" },
  intensityBadge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginBottom: 8 },
  intensityBadgeText: { fontSize: 10, fontWeight: "700" },
  intensitySub: { fontSize: 11, color: "#6B7280", lineHeight: 14 },
  divider: { height: 1, backgroundColor: "#E5E7EB", marginVertical: 12 },
  sliderHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  sliderLabel: { flexDirection: "row", alignItems: "center", gap: 8 },
  sliderLabelText: { fontSize: 13, fontWeight: "500", color: "#1A1A2E" },
  sliderValue: { fontSize: 12, fontWeight: "600", color: "#6B7280" },
  sliderTrack: { height: 6, borderRadius: 3, backgroundColor: "#E5E7EB", overflow: "hidden" },
  sliderFill: { height: "100%", borderRadius: 3, backgroundColor: "#2D6A4F" },
  slider: { width: "100%", height: 40, marginTop: 8 },
  sliderTouchArea: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  sliderStop: { padding: 4 },
  sliderDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#D1D5DB" },
  sliderDotActive: { backgroundColor: "#2D6A4F" },
  toggleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  toggleLabel: { flexDirection: "row", alignItems: "center", gap: 8 },
  toggleText: { fontSize: 13, fontWeight: "500", color: "#1A1A2E" },
  toggle: { width: 48, height: 28, borderRadius: 14, backgroundColor: "#D1D5DB", justifyContent: "center", paddingHorizontal: 2 },
  toggleOn: { backgroundColor: "#2D6A4F" },
  toggleKnob: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#FFFFFF" },
  toggleKnobOn: { alignSelf: "flex-end" },
  footer: { fontSize: 11, color: "#9CA3AF", textAlign: "center", marginVertical: 16 },
  sponsorDesc: { fontSize: 11, color: "#6B7280", marginBottom: 12, lineHeight: 16 },
  sponsorCard: { flexDirection: "row", gap: 12, paddingVertical: 8 },
  sponsorLogo: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  sponsorInitials: { fontSize: 10, fontWeight: "700", color: "#FFFFFF" },
  sponsorName: { fontSize: 13, fontWeight: "600", color: "#1A1A2E" },
  sponsorTagline: { fontSize: 11, color: "#6B7280" },
  sponsorLoadingContainer: { 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "center", 
    gap: 8, 
    paddingVertical: 20 
  },
  sponsorLoadingText: { fontSize: 13, color: "#6B7280" },
});