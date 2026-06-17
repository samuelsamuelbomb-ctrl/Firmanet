/**
 * SignalCard — Single signal summary card.
 *
 * Ported from src/components/swish/SignalCard.tsx
 */

import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { MapPin, Clock, Users } from "lucide-react-native";
import type { Signal } from "../../core/types";
import { lightTap } from "../../core/haptics";

interface SignalCardProps {
  signal: Signal;
}

export function SignalCard({ signal }: SignalCardProps) {
  const navigation = useNavigation<any>();

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => { lightTap(); navigation.navigate("IncidentDetail", { id: signal.id }); }}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View style={styles.badgeRow}>
          <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(signal.category) }]}>
            <Text style={styles.categoryText}>{signal.category}</Text>
          </View>
          <Text style={styles.stateText}>{signal.state.replace("_", " ")}</Text>
        </View>
        <Text style={styles.trust}>{signal.trust}%</Text>
      </View>
      <Text style={styles.title} numberOfLines={2}>{signal.title}</Text>
      <View style={styles.meta}>
        <View style={styles.metaItem}>
          <MapPin size={12} color="#6B7280" />
          <Text style={styles.metaText}>{signal.distanceKm.toFixed(1)} km</Text>
        </View>
        <View style={styles.metaItem}>
          <Clock size={12} color="#6B7280" />
          <Text style={styles.metaText}>{signal.minutesAgo}m ago</Text>
        </View>
        <View style={styles.metaItem}>
          <Users size={12} color="#6B7280" />
          <Text style={styles.metaText}>{signal.reports} reports</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    crime: "#FEE2E2",
    fire: "#FFEDD5",
    flood: "#DBEAFE",
    accident: "#FEF3C7",
    sos: "#FEE2E2",
    missing: "#E5E7EB",
    other: "#F3F4F6",
  };
  return colors[category] ?? "#F3F4F6";
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 16,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "capitalize",
    color: "#1A1A2E",
  },
  stateText: {
    fontSize: 10,
    color: "#6B7280",
    textTransform: "capitalize",
  },
  trust: {
    fontSize: 14,
    fontWeight: "700",
    color: "#2D6A4F",
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Outfit",
    color: "#1A1A2E",
    lineHeight: 20,
  },
  meta: {
    flexDirection: "row",
    gap: 16,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    color: "#6B7280",
  },
});