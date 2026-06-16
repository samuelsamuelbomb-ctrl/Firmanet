/**
 * TrustBar — Visual trust score bar.
 *
 * Ported from src/components/swish/TrustBar.tsx
 */

import { View, StyleSheet } from "react-native";

interface TrustBarProps {
  value: number; // 0–100
}

export function TrustBar({ value }: TrustBarProps) {
  const color = value >= 80 ? "#E63946" : value >= 60 ? "#F59E0B" : "#2D6A4F";
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${value}%`, backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#E5E7EB",
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 4,
  },
});