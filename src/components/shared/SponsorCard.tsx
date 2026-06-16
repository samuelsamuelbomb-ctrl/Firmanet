/**
 * SponsorStrip + SponsorCard + SponsorSeparator — Sponsor display components.
 *
 * Ported from src/components/swish/SponsorCard.tsx
 */

import { View, Text, StyleSheet } from "react-native";
import { sponsors } from "../../core/sponsors";
import type { Sponsor } from "../../core/types";

export function SponsorSeparator() {
  return (
    <View style={sepStyles.container}>
      <View style={sepStyles.line} />
      <View style={sepStyles.sponsor}>
        <Text style={sepStyles.sparkle}>✦</Text>
        <Text style={sepStyles.text}>Sponsored by {sponsors[1]?.name ?? "GTBank"}</Text>
      </View>
      <View style={sepStyles.line} />
    </View>
  );
}

export function SponsorStrip() {
  return (
    <View style={styles.strip}>
      <Text style={styles.label}>COMMUNITY SUPPORTERS</Text>
      <View style={styles.logos}>
        {sponsors.slice(0, 3).map((s) => (
          <View key={s.id} style={[styles.sponsorDot, { backgroundColor: s.accent }]}>
            <Text style={styles.sponsorInitials}>{s.initials}</Text>
          </View>
        ))}
        <Text style={styles.moreText}>+{Math.max(0, sponsors.length - 3)}</Text>
      </View>
    </View>
  );
}

const sepStyles = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8 },
  line: { flex: 1, height: 1, backgroundColor: "#E5E7EB" },
  sponsor: { flexDirection: "row", alignItems: "center", gap: 4 },
  sparkle: { fontSize: 10, color: "#F59E0B" },
  text: { fontSize: 10, fontWeight: "600", color: "#9CA3AF" },
});

const styles = StyleSheet.create({
  strip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  label: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    color: "#9CA3AF",
  },
  logos: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sponsorDot: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  sponsorInitials: {
    fontSize: 8,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  moreText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#6B7280",
  },
});