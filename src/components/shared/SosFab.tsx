/**
 * SosFab — Draggable floating SOS emergency button.
 *
 * Ported from src/components/swish/SosFab.tsx
 * Navigates to the SOS modal screen.
 * User can drag it around the screen — snaps to nearest edge on release.
 *
 * VISUAL UPDATE (Jun 2026):
 *  - Icon matches the SOS tile: press-hold SVG instead of Siren
 *  - Red matches the SOS tile: #E63E2B (was #E63946)
 *  - Diffuse glow removed; replaced with a tight expanding ring (radar ping)
 */

import { useRef, useEffect } from "react";
import { TouchableOpacity, StyleSheet, View, PanResponder, Animated, Dimensions } from "react-native";
import { useNavigation } from "@react-navigation/native";
import Svg, { Circle as SvgCircle, Path } from "react-native-svg";
import { heavyTap } from "../../core/haptics";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const BTN_SIZE = 64;
const EDGE_MARGIN = 16;

// Exact red from the SOS tile
const SOS_RED = "#E63E2B";

// ── Custom SOS icon (press‑hold progress indicator) ────────
function SosIcon({
  size = 28,
  color = "#FFFFFF",
  strokeWidth = 2.4,
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

// ── Expanding radar‑ping ring (replaces the old blurry glow) ──
function PingRing() {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: 2200,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  const scale = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2.0],
  });

  const opacity = anim.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0.7, 0.3, 0],
  });

  return (
    <Animated.View
      style={{
        position: "absolute",
        width: BTN_SIZE,
        height: BTN_SIZE,
        borderRadius: BTN_SIZE / 2,
        borderWidth: 2,
        borderColor: SOS_RED,
        opacity,
        transform: [{ scale }],
      }}
      pointerEvents="none"
    />
  );
}

// ── Component ──────────────────────────────────────────────
export function SosFab() {
  const navigation = useNavigation<any>();

  // Track whether a drag actually moved (to distinguish tap vs drag)
  const isDragging = useRef(false);

  // Current absolute position (tracked via ref to avoid _value)
  const posRef = useRef({
    x: SCREEN_WIDTH - BTN_SIZE - EDGE_MARGIN,
    y: SCREEN_HEIGHT - BTN_SIZE - EDGE_MARGIN - 88,
  });

  // Animated values drive the transform
  const pan = useRef(new Animated.ValueXY(posRef.current)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 5 || Math.abs(g.dy) > 5,
      onPanResponderGrant: () => {
        isDragging.current = false;
        pan.setOffset({
          x: posRef.current.x,
          y: posRef.current.y,
        });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: (_, g) => {
        if (Math.abs(g.dx) > 5 || Math.abs(g.dy) > 5) {
          isDragging.current = true;
        }
        pan.setValue({ x: g.dx, y: g.dy });
      },
      onPanResponderRelease: () => {
        pan.flattenOffset();

        // Read current position after flatten
        const currentX = posRef.current.x;
        const currentY = posRef.current.y;

        // Snap to nearest horizontal edge
        const snapX = currentX + BTN_SIZE / 2 > SCREEN_WIDTH / 2
          ? SCREEN_WIDTH - BTN_SIZE - EDGE_MARGIN
          : EDGE_MARGIN;

        // Keep within vertical safe bounds
        const snapY = Math.max(
          EDGE_MARGIN + 48,
          Math.min(currentY, SCREEN_HEIGHT - BTN_SIZE - EDGE_MARGIN - 48)
        );

        posRef.current = { x: snapX, y: snapY };

        Animated.spring(pan, {
          toValue: { x: snapX, y: snapY },
          useNativeDriver: false,
          friction: 7,
        }).start();
      },
    })
  ).current;

  // Keep posRef in sync as the animated value changes
  pan.x.addListener(({ value }) => { posRef.current.x = value; });
  pan.y.addListener(({ value }) => { posRef.current.y = value; });

  const handlePress = () => {
    if (!isDragging.current) {
      heavyTap();
      // SOS is in RootStack — navigate via parent
      const parent = navigation.getParent();
      if (parent) {
        parent.navigate("SOS");
      } else {
        navigation.navigate("SOS");
      }
    }
    isDragging.current = false;
  };

  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ translateX: pan.x }, { translateY: pan.y }] },
      ]}
      {...panResponder.panHandlers}
    >
      <TouchableOpacity
        style={styles.button}
        onPress={handlePress}
        activeOpacity={0.8}
        accessibilityLabel="Activate SOS"
        accessibilityRole="button"
      >
        <SosIcon size={28} color="#FFFFFF" strokeWidth={2.4} />
        <PingRing />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    zIndex: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  button: {
    width: BTN_SIZE,
    height: BTN_SIZE,
    borderRadius: BTN_SIZE / 2,
    backgroundColor: SOS_RED,
    justifyContent: "center",
    alignItems: "center",
    // No diffuse shadow — replaced by the animated PingRing
  },
});