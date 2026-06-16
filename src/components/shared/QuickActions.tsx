/**
 * QuickActions — Shortcut action buttons.
 *
 * Ported from src/components/swish/QuickActions.tsx
 */

import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Siren, MessageCircle, Map, Shield } from "lucide-react-native";

const ACTIONS = [
  { label: "SOS", icon: Siren, route: "SOS", color: "#E63946", bg: "#FEE2E2" },
  { label: "Report", icon: Shield, route: "FeedTab", color: "#2D6A4F", bg: "#D8F3DC" },
  { label: "Map", icon: Map, route: "MapTab", color: "#6C63FF", bg: "#EDE9FE" },
  { label: "Circle", icon: MessageCircle, route: "CircleTab", color: "#FF8C42", bg: "#FFF3E0" },
];

export function QuickActions() {
  const navigation = useNavigation<any>();

  return (
    <View style={styles.container}>
      {ACTIONS.map((a) => (
        <TouchableOpacity
          key={a.label}
          style={styles.item}
          onPress={() => navigation.navigate(a.route)}
          activeOpacity={0.7}
          accessibilityLabel={a.label}
        >
          <View style={[styles.iconWrap, { backgroundColor: a.bg }]}>
            <a.icon size={22} color={a.color} strokeWidth={2.2} />
          </View>
          <Text style={styles.label}>{a.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: 12,
  },
  item: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
    color: "#1A1A2E",
  },
});