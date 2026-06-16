/**
 * SosFab — Floating SOS emergency button.
 *
 * Ported from src/components/swish/SosFab.tsx
 * Navigates to the SOS modal screen.
 */

import { TouchableOpacity, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Siren } from "lucide-react-native";

export function SosFab() {
  const navigation = useNavigation<any>();

  return (
    <View style={styles.container} pointerEvents="box-none">
      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate("SOS")}
        activeOpacity={0.8}
        accessibilityLabel="Activate SOS"
        accessibilityRole="button"
      >
        <View style={styles.pulseRing} />
        <Siren size={28} color="#FFFFFF" strokeWidth={2.4} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 88,
    right: 24,
    zIndex: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  button: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#E63946",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#E63946",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 10,
  },
  pulseRing: {
    position: "absolute",
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(230, 57, 70, 0.4)",
  },
});