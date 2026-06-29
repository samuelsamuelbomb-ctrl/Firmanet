/**
 * HomeScreen — ported from src/routes/index.tsx
 *
 * Changes from web version:
 *   - TanStack `createFileRoute` → React Navigation screen component
 *   - `Link` → React Navigation `useNavigation`
 *   - HTML divs → React Native Views, Text, TouchableOpacity
 *   - Tailwind classes → StyleSheet
 *   - `useSignals` / `useSignalsRealtime` imported from core
 *   - `play` sound adapted via `expo-av` through the SoundEngine interface
 *
 * FIXED: StatusCard now computes intensity from REAL signal data (via Supabase)
 *        instead of using a local toggle. Matches the web version behavior.
 * FIXED: Signals are filtered by user's radius and alert intensity settings.
 */

import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { AppShell } from "../components/shared/AppShell";
import { TopBar } from "../components/shared/TopBar";
import { StatusCard } from "../components/shared/StatusCard";
import { QuickActions } from "../components/shared/QuickActions";
import { SignalCard } from "../components/shared/SignalCard";
import { SectionHeader } from "../components/shared/SectionHeader";
import { SponsorStrip } from "../components/shared/SponsorCard";
import { useSignals, useSignalsRealtime } from "../core/signalStore";
import { useIntensity, useRadius, intensityToMinTrust } from "../core/settingsStore";
import type { Signal, Intensity } from "../core/types";
import { mediumTap } from "../core/haptics";

/** Compute overall intensity from real signal data — matches web's swish/StatusCard.tsx */
function computeIntensity(signals: Signal[]): Intensity {
  for (const s of signals) {
    if (s.trust >= 80) return "danger";
    if (s.trust >= 60) return "warn";
  }
  return "calm";
}

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const signals = useSignals();
  const alertIntensity = useIntensity();
  const maxRadius = useRadius();

  useSignalsRealtime();

  // Filter signals by radius and alert intensity threshold
  const minTrust = intensityToMinTrust(alertIntensity);
  const filteredSignals = signals.filter(
    (s) => s.distanceKm <= maxRadius && s.trust >= minTrust,
  );

  const intensity = computeIntensity(filteredSignals);

  return (
    <AppShell>
      <TopBar />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <StatusCard intensity={intensity} signals={filteredSignals} onPress={() => { mediumTap(); navigation.navigate("MainStack", { screen: "NearbyIncidents" }); }} />
        <QuickActions />
        <View style={styles.section}>
          <SectionHeader title="Latest near you" action="See all" onAction="FeedTab" />
          <View style={styles.signalList}>
            {filteredSignals.length > 0 ? (
              filteredSignals.slice(0, 3).map((s) => (
                <SignalCard key={s.id} signal={s} />
              ))
            ) : (
              <Text style={styles.emptyText}>
                No signals within your radius. Adjust settings to see more.
              </Text>
            )}
          </View>
        </View>
        <SponsorStrip />
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
    gap: 20,
  },
  section: {
    gap: 12,
  },
  signalList: {
    gap: 12,
  },
  emptyText: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    paddingVertical: 20,
    fontStyle: "italic",
  },
});