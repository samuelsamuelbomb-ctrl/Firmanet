/**
 * StatusCard — Current safety status display.
 *
 * Ported from src/components/swish/StatusCard.tsx
 */

import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Shield, ShieldAlert, ShieldCheck } from "lucide-react-native";
import type { Intensity } from "../../core/types";

const STATUS_MAP: Record<Intensity, { label: string; sub: string; bg: string; icon: typeof Shield }> = {
  calm:   { label: "All clear", sub: "No incidents reported nearby", bg: "#D8F3DC", icon: ShieldCheck },
  warn:   { label: "Caution",   sub: "Something doesn't feel right",  bg: "#FEF3C7", icon: ShieldAlert },
  danger: { label: "Active threat", sub: "Emergency services notified", bg: "#FEE2E2", icon: Shield },
};

interface StatusCardProps {
  intensity: Intensity;
  onCycle: () => void;
}

export function StatusCard({ intensity, onCycle }: StatusCardProps) {
  const s = STATUS_MAP[intensity];

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: s.bg }]}
      onPress={onCycle}
      activeOpacity={0.7}
      accessibilityLabel={`Status: ${s.label}. Tap to cycle.`}
    >
      <View style={styles.iconWrap}>
        <s.icon size={28} color="#1A1A2E" strokeWidth={1.8} />
      </View>
      <View style={styles.content}>
        <Text style={styles.label}>{s.label}</Text>
        <Text style={styles.sub}>{s.sub}</Text>
      </View>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{intensity.toUpperCase()}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 24,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
  },
  label: {
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "Outfit",
    color: "#1A1A2E",
  },
  sub: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  badge: {
    backgroundColor: "rgba(255,255,255,0.8)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    color: "#1A1A2E",
  },
});