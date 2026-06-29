/**
 * NearbyIncidentsScreen — Shows all incident-type signals near the user.
 * Navigated to from StatusCard tap on HomeScreen.
 */

import { View, Text, StyleSheet, FlatList, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { ArrowLeft, ShieldAlert } from "lucide-react-native";
import { AppShell } from "../components/shared/AppShell";
import { SignalCard } from "../components/shared/SignalCard";
import { ClusterCard } from "../components/shared/ClusterCard";
import { useSignals } from "../core/signalStore";
import { useRadius } from "../core/settingsStore";
import { clusterSignals, isCluster } from "../core/signalCluster";
import { lightTap } from "../core/haptics";
import type { Signal, SignalCluster } from "../core/types";

export default function NearbyIncidentsScreen() {
  const navigation = useNavigation<any>();
  const signals = useSignals();
  const maxRadius = useRadius();

  // Filter only incident-type signals within radius
  const incidentSignals = signals.filter(
    (s) => s.type === "incident" && s.distanceKm <= maxRadius,
  );
  const grouped = clusterSignals(incidentSignals);

  return (
    <AppShell>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => { lightTap(); navigation.goBack(); }}
          >
            <ArrowLeft size={22} color="#1A1A2E" />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.title}>Incidents Near You</Text>
            <Text style={styles.subtitle}>
              {incidentSignals.length} incident{incidentSignals.length === 1 ? "" : "s"} within {maxRadius} km
            </Text>
          </View>
          <ShieldAlert size={24} color="#E63946" />
        </View>

        <FlatList
          data={grouped}
          keyExtractor={(item) => (isCluster(item) ? item.id : item.id)}
          renderItem={({ item }) => (
            <View>
              {isCluster(item) ? (
                <ClusterCard cluster={item} />
              ) : (
                <SignalCard signal={item} />
              )}
            </View>
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <ShieldAlert size={48} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>All clear</Text>
              <Text style={styles.emptyText}>
                No incidents reported within your radius.
              </Text>
            </View>
          }
        />
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: 16,
    paddingBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    fontFamily: "Outfit",
    color: "#1A1A2E",
  },
  subtitle: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
  list: {
    gap: 12,
    paddingBottom: 40,
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1A1A2E",
  },
  emptyText: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
  },
});