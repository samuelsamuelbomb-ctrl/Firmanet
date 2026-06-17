/**
 * TopBar — header bar for all AppShell-wrapped screens.
 *
 * Ported from src/components/swish/TopBar.tsx
 *
 * Navigation:
 *   - Bell → navigates to "Notifications" (MainStack, auth-guarded)
 *   - Profile → navigates to "Profile" (MainStack, auth-guarded)
 */

import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useState, useEffect } from "react";
import { MapPin, Bell, User } from "lucide-react-native";

interface TopBarProps {
  hideBell?: boolean;
  hideProfile?: boolean;
}

export function TopBar({
  hideBell = false,
  hideProfile = false,
}: TopBarProps) {
  const [displayLocation, setDisplayLocation] = useState("Getting location…");

  // Get real location on mount
  useEffect(() => {
    if (typeof navigator !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          // Try reverse geocoding via Mapbox if token available
          const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "";
          if (token) {
            fetch(
              `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&types=locality,place,neighborhood&limit=1`,
            )
              .then((r) => r.json())
              .then((data) => {
                if (data?.features?.[0]?.place_name) {
                  setDisplayLocation(data.features[0].place_name);
                } else {
                  setDisplayLocation(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
                }
              })
              .catch(() => setDisplayLocation(`${lat.toFixed(4)}, ${lng.toFixed(4)}`));
          } else {
            setDisplayLocation(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
          }
        },
        () => setDisplayLocation("Current Location"),
        { enableHighAccuracy: true, timeout: 10_000 },
      );
    } else {
      setDisplayLocation("Current Location");
    }
  }, []);
  const navigation = useNavigation<any>();

  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <Logo size={28} />
        <TouchableOpacity style={styles.locationPill} activeOpacity={0.7}>
          <MapPin size={14} color="#2D6A4F" strokeWidth={2.5} />
          <Text style={styles.locationText}>{displayLocation}</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.right}>
        {!hideBell && (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => navigation.navigate("Notifications")}
            accessibilityLabel="Notifications"
          >
            <Bell size={18} color="#1A1A2E" />
            <View style={styles.unreadDot} />
          </TouchableOpacity>
        )}
        {!hideProfile && (
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => navigation.navigate("Profile")}
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
    <View style={[styles.logo, { width: size, height: size, borderRadius: size / 4 }]}>
      <Text style={[styles.logoText, { fontSize: size * 0.5 }]}>F</Text>
    </View>
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
  },
  locationText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#1A1A2E",
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