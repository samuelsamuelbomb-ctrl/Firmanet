/**
 * StatusCard — Current safety status display.
 *
 * Ported from src/components/swish/StatusCard.tsx
 * Matches web version: gradient background, large title, rich signal info.
 */

import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Shield, ShieldAlert, ShieldCheck } from "lucide-react-native";
import type { Intensity, Signal } from "../../core/types";
import { mediumTap } from "../../core/haptics";

function topSignal(signals: Signal[]): Signal | undefined {
  if (signals.length === 0) return undefined;
  return signals.reduce((a, b) => (a.trust > b.trust ? a : b));
}

function formatMinutes(minutes: number): string {
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const h = Math.floor(minutes / 60);
  return h === 1 ? "1 hour ago" : `${h} hours ago`;
}

interface StatusCardProps {
  intensity: Intensity;
  signals?: Signal[];
  onPress?: () => void;
}

const BG_COLORS: Record<Intensity, string> = {
  calm: "#D8F3DC",
  warn: "#FEF3C7",
  danger: "#FEE2E2",
};

const BADGE_COLORS: Record<Intensity, { bg: string; text: string; iconColor: string }> = {
  calm:   { bg: "#059669", text: "#FFFFFF", iconColor: "#059669" },
  warn:   { bg: "#D97706", text: "#FFFFFF", iconColor: "#D97706" },
  danger: { bg: "#DC2626", text: "#FFFFFF", iconColor: "#DC2626" },
};

const BADGE_LABELS: Record<Intensity, { label: string; icon: typeof Shield }> = {
  calm:   { label: "Area Status: Safe",  icon: ShieldCheck },
  warn:   { label: "Suspicious Activity", icon: ShieldAlert },
  danger: { label: "Active Threat",      icon: Shield },
};

const TITLES: Record<Intensity, string> = {
  calm:   "All clear around you",
  warn:   "Something doesn't feel right",
  danger: "Emergency — stay alert",
};

const SUBTITLES: Record<Intensity, string> = {
  calm:   "No incidents reported in your area",
  warn:   "Reports indicate unusual activity nearby",
  danger: "Emergency services have been notified",
};

export function StatusCard({ intensity, signals = [], onPress }: StatusCardProps) {
  const badge = BADGE_LABELS[intensity];
  const bColor = BADGE_COLORS[intensity];
  const Icon = badge.icon;
  const top = topSignal(signals);

  const calmState = intensity === "calm" || !top;

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: BG_COLORS[intensity] }]}
      onPress={() => { if (onPress) { mediumTap(); onPress(); } }}
      activeOpacity={0.7}
      accessibilityLabel={`Status: ${badge.label}`}
    >
      {/* Badge */}
      <View style={[styles.badge, { backgroundColor: bColor.bg }]}>
        <Icon size={12} color={bColor.text} strokeWidth={2.5} />
        <Text style={[styles.badgeText, { color: bColor.text }]}>{badge.label}</Text>
      </View>

      {/* Title */}
      <Text style={styles.title}>
        {calmState ? TITLES[intensity] : (top?.title ?? TITLES[intensity])}
      </Text>

      {/* Subtitle — rich signal data for warn/danger, count for calm */}
      {calmState ? (
        <Text style={styles.subtitle}>
          {signals.length > 0
            ? `${signals.length} signal${signals.length === 1 ? "" : "s"} in your area`
            : "No active incidents nearby"}
        </Text>
      ) : top ? (
        <Text style={styles.subtitle}>
          {top.distanceKm.toFixed(1)} km · Confidence {top.trust}% · {top.reports ?? 0} reports
        </Text>
      ) : null}

      {/* Location + time for warn/danger */}
      {!calmState && top && (
        <Text style={styles.meta}>
          {top.location} · {formatMinutes(top.minutesAgo)}
        </Text>
      )}

      {/* Calm state meta */}
      {calmState && signals.length > 0 && (
        <Text style={styles.meta}>
          Latest {formatMinutes(Math.min(...signals.map((s) => s.minutesAgo)))}
        </Text>
      )}

      {/* Bottom decoration */}
      <View style={styles.footerGlow} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 24,
    borderRadius: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 6,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  title: {
    fontSize: 26,
    fontWeight: "600",
    fontFamily: "Outfit",
    color: "#1A1A2E",
    marginTop: 16,
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 4,
    lineHeight: 20,
  },
  meta: {
    fontSize: 12,
    fontWeight: "500",
    color: "#4B5563",
    marginTop: 8,
  },
  footerGlow: {
    marginTop: 20,
    height: 1,
    width: 60,
    borderRadius: 1,
    backgroundColor: "rgba(0,0,0,0.08)",
  },
});
