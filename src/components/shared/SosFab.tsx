/**
 * SosFab — Draggable floating SOS emergency button.
 *
 * Ported from src/components/swish/SosFab.tsx
 * Navigates to the SOS modal screen.
 * User can drag it around the screen — snaps to nearest edge on release.
 */

import { useRef } from "react";
import { TouchableOpacity, StyleSheet, View, PanResponder, Animated, Dimensions } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Siren } from "lucide-react-native";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const BTN_SIZE = 64;
const EDGE_MARGIN = 16;

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
      navigation.navigate("SOS");
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
        <View style={styles.pulseRing} />
        <Siren size={28} color="#FFFFFF" strokeWidth={2.4} />
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
    width: BTN_SIZE,
    height: BTN_SIZE,
    borderRadius: BTN_SIZE / 2,
    backgroundColor: "rgba(230, 57, 70, 0.4)",
  },
});