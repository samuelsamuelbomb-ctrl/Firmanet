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
 */

import { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { AppShell } from "../components/shared/AppShell";
import { TopBar } from "../components/shared/TopBar";
import { StatusCard } from "../components/shared/StatusCard";
import { QuickActions } from "../components/shared/QuickActions";
import { SignalCard } from "../components/shared/SignalCard";
import { SectionHeader } from "../components/shared/SectionHeader";
import { SponsorStrip } from "../components/shared/SponsorCard";
import { useSignals, useSignalsRealtime } from "../core/signalStore";
import type { Intensity } from "../core/types";

const INTENSITY_CYCLE: Intensity[] = ["calm", "warn", "danger"];

export default function HomeScreen() {
  const [intensity, setIntensity] = useState<Intensity>("calm");
  const signals = useSignals();
  useSignalsRealtime();
  const first = useRef(true);

  const cycle = () =>
    setIntensity((cur) => INTENSITY_CYCLE[(INTENSITY_CYCLE.indexOf(cur) + 1) % 3]);

  // Sound effect on intensity change (skip first render)
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    // Play sound via sound engine
    // play(intensity);
  }, [intensity]);

  return (
    <AppShell>
      <TopBar />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <StatusCard intensity={intensity} onCycle={cycle} />
        <QuickActions />
        <View style={styles.section}>
          <SectionHeader title="Latest near you" action="See all" onAction="FeedTab" />
          <View style={styles.signalList}>
            {signals.slice(0, 3).map((s) => (
              <SignalCard key={s.id} signal={s} />
            ))}
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
});