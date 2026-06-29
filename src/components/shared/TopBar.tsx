/**
 * TopBar — header bar for all AppShell-wrapped screens.
 *
 * Ported from src/components/swish/TopBar.tsx
 *
 * Navigation:
 *   - Bell → navigates to "MainStack" → "Notifications" (auth-guarded)
 *   - Profile → navigates to "MainStack" → "Profile" (auth-guarded)
 */

import { View, Text, Image, TouchableOpacity, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useState, useEffect } from "react";
import { MapPin, Bell, User } from "lucide-react-native";
import { lightTap } from "../../core/haptics";

interface TopBarProps {
  hideBell?: boolean;
  hideProfile?: boolean;
}

export function TopBar({
  hideBell = false,
  hideProfile = false,
}: TopBarProps) {
  const [displayLocation, setDisplayLocation] = useState("Getting location…");
  const navigation = useNavigation<any>();

  // Get real location on mount via expo-location
  useEffect(() => {
    void (async () => {
      try {
        const { getCurrentPositionAsync, requestForegroundPermissionsAsync } = await import("expo-location");
        const { status } = await requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setDisplayLocation("Current Location");
          return;
        }
        const pos = await getCurrentPositionAsync({});
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        // Read Mapbox token — try process.env first, then fall back to expo-constants (Expo Go)
        let token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "";
        if (!token) {
          try {
            const Constants = require("expo-constants");
            token = Constants?.expoConfig?.extra?.EXPO_PUBLIC_MAPBOX_TOKEN ?? "";
          } catch {}
        }

        if (token) {
          try {
            // Use address type to get street-level results
            const res = await fetch(
              `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&types=address,locality,place,neighborhood,poi&limit=1`,
            );
            const data = await res.json();
            if (data?.features?.[0]?.place_name) {
              setDisplayLocation(data.features[0].place_name);
              return;
            }
          } catch {
            // fallback to coordinates
          }
        }
        setDisplayLocation(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
      } catch {
        setDisplayLocation("Current Location");
      }
    })();
  }, []);

  const navigateTo = (screen: string) => {
    lightTap();
    navigation.navigate("MainStack", { screen });
  };

  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <Logo size={28} />
        <TouchableOpacity style={styles.locationPill} activeOpacity={0.7}>
          <MapPin size={14} color="#2D6A4F" strokeWidth={2.5} />
          <Text style={styles.locationText} numberOfLines={1}>{displayLocation}</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.right}>
        {!hideBell && (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => navigateTo("Notifications")}
            accessibilityLabel="Notifications"
          >
            <Bell size={18} color="#1A1A2E" />
            <View style={styles.unreadDot} />
          </TouchableOpacity>
        )}
        {!hideProfile && (
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => navigateTo("Profile")}
            accessibilityLabel="Profile"
          >
            <User size={18} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function Logo({ size }: { size: number }) {
  return (
    <Image
      source={require("../../assets/firmanet-logo.png")}
      style={{ width: size, height: size, borderRadius: size / 4 }}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 24,
    paddingBottom: 12,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
    maxWidth: "72%",
  },
  logo: {
    backgroundColor: "#D8F3DC",
    justifyContent: "center",
    alignItems: "center",
  },
  logoText: {
    fontWeight: "700",
    color: "#2D6A4F",
  },
  locationPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
    flexShrink: 1,
    overflow: "hidden",
  },
  locationText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#1A1A2E",
    flexShrink: 1,
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  unreadDot: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#E63946",
  },
  profileButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 20,
    backgroundColor: "#2D6A4F",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
});