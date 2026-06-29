/**
 * QuickActions — Shortcut action buttons.
 *
 * Ported from src/components/swish/QuickActions.tsx
 *
 * FIXED: Navigates to SOS via the root navigator (getParent())
 *        since SOS is defined in RootStack, not in the tab navigator.
 *
 * VISUAL UPDATE (Jun 2026):
 *  - Neutral off-white BG for Report/Map/Circle, hazard-red for SOS
 *  - Near-black icons for Report/Map/Circle, white icon for SOS
 *  - Icon swaps: Report → MapPin, Map → Radar, Circle → Network
 *  - SOS → custom inline SVG (press-hold indicator)
 *  - Pulsing dot overlay on Report tile
 *  - Tighter corner radius (20 → 16)
 */

import { View, Text, TouchableOpacity, StyleSheet, Animated } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Radar, Network, MapPin } from "lucide-react-native";
import Svg, { Circle as SvgCircle, Path } from "react-native-svg";
import { lightTap } from "../../core/haptics";
import { useRef, useEffect } from "react";

// ── Tokens ─────────────────────────────────────────────────
const SOS_BG = "#E63E2B";
const NEUTRAL_BG = "#F2F1ED";
const SOS_ICON = "#FFFFFF";
const ICON_INK = "#1A1A1A";

// ── Custom SOS icon (press‑hold progress indicator) ────────
function SosIcon({
  size = 22,
  color = SOS_ICON,
  strokeWidth = 2.2,
}: {
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Partial arc – reads as a hold‑progress ring */}
      <Path
        d="M12 2.5A9.5 9.5 0 0 1 21.5 12"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        fill="none"
      />
      {/* Solid centre dot */}
      <SvgCircle cx={12} cy={12} r={4.5} fill={color} />
    </Svg>
  );
}

// ── Pulsing dot overlay for Report tile ────────────────────
function PulseDot() {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  const opacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 0],
  });

  const scale = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2.2],
  });

  return (
    <Animated.View
      style={{
        position: "absolute",
        top: 6,
        right: 6,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: SOS_BG,
        opacity,
        transform: [{ scale }],
      }}
    />
  );
}

// ── Action definitions ─────────────────────────────────────
const ACTIONS = [
  { label: "SOS",    icon: SosIcon,  route: "SOS",     root: true,  isSos: true },
  { label: "Report", icon: MapPin,   route: "FeedTab",  root: false, isSos: false },
  { label: "Map",    icon: Radar,    route: "MapTab",   root: false, isSos: false },
  { label: "Circle", icon: Network,  route: "CircleTab",root: false, isSos: false },
] as const;

// ── Component ──────────────────────────────────────────────
export function QuickActions() {
  const navigation = useNavigation<any>();

  const handlePress = (a: typeof ACTIONS[number]) => {
    lightTap();
    if (a.root) {
      // SOS is in RootStack — navigate via parent
      const parent = navigation.getParent();
      if (parent) {
        parent.navigate(a.route);
      } else {
        navigation.navigate(a.route);
      }
    } else {
      // Tab routes are directly accessible
      navigation.navigate(a.route);
    }
  };

  return (
    <View style={styles.container}>
      {ACTIONS.map((a) => (
        <TouchableOpacity
          key={a.label}
          style={styles.item}
          onPress={() => handlePress(a)}
          activeOpacity={0.7}
          accessibilityLabel={a.label}
        >
          <View
            style={[
              styles.iconWrap,
              { backgroundColor: a.isSos ? SOS_BG : NEUTRAL_BG },
            ]}
          >
            <a.icon
              size={22}
              color={a.isSos ? SOS_ICON : ICON_INK}
              strokeWidth={2.2}
            />
            {a.label === "Report" && <PulseDot />}
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
    borderRadius: 16, // slightly tighter than previous 20
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