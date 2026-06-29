/**
 * ClusterCard — Clustered signals display.
 *
 * Ported from src/components/swish/ClusterCard.tsx
 */

import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { MapPin, Clock, Users } from "lucide-react-native";
import type { SignalCluster } from "../../core/types";
import { lightTap } from "../../core/haptics";
import { formatTimeAgo } from "../../core/utils";

interface ClusterCardProps {
  cluster: SignalCluster;
}

export function ClusterCard({ cluster }: ClusterCardProps) {
  const navigation = useNavigation<any>();

  const openIncident = () => {
    lightTap();
    // IncidentDetail is in MainStack
    try {
      navigation.navigate("MainStack", { screen: "IncidentDetail", params: { id: cluster.primary.id } });
    } catch {
      navigation.navigate("IncidentDetail", { id: cluster.primary.id });
    }
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={openIncident}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <Text style={styles.badge}>{cluster.signals.length} related signals</Text>
        <Text style={styles.trust}>{cluster.avgTrust}%</Text>
      </View>
      <Text style={styles.title} numberOfLines={2}>{cluster.primary.title}</Text>
      <View style={styles.meta}>
        <View style={styles.metaItem}>
          <MapPin size={12} color="#6B7280" />
          <Text style={styles.metaText}>{cluster.location}</Text>
        </View>
        <View style={styles.metaItem}>
          <Clock size={12} color="#6B7280" />
          <Text style={styles.metaText}>{formatTimeAgo(cluster.minutesAgo)}</Text>
        </View>
        <View style={styles.metaItem}>
          <Users size={12} color="#6B7280" />
          <Text style={styles.metaText}>{cluster.totalReports} reports</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 16,
    gap: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#6C63FF",
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
  badge: {
    fontSize: 10,
    fontWeight: "700",
    color: "#6C63FF",
    textTransform: "uppercase",
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