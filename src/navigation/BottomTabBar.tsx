/**
 * BottomTabBar — TikTok-style dark bottom navigation bar.
 *
 * A slim dark strip at the bottom of the screen with white icons.
 */

import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Home, Newspaper, Map, Users, Settings } from "lucide-react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { lightTap } from "../core/haptics";

const TABS = [
  { key: "home",     label: "Home",     icon: Home,     route: "HomeTab" },
  { key: "feed",     label: "Feed",     icon: Newspaper,route: "FeedTab" },
  { key: "map",      label: "Map",      icon: Map,      route: "MapTab" },
  { key: "circle",   label: "Circle",   icon: Users,    route: "CircleTab" },
  { key: "settings", label: "Settings", icon: Settings, route: "SettingsTab" },
];

export function BottomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrapper, { paddingBottom: insets.bottom || 8 }]}>
      <View style={styles.container}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const tab = TABS[index];
          const Icon = tab.icon;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              lightTap();
              navigation.navigate(route.name);
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              activeOpacity={0.7}
              style={styles.tab}
              accessibilityLabel={tab.label}
              accessibilityRole="tab"
              accessibilityState={{ selected: isFocused }}
            >
              <Icon
                size={24}
                strokeWidth={isFocused ? 2.8 : 2.25}
                color={isFocused ? "#FFFFFF" : "rgba(255,255,255,0.5)"}
              />
              <Text style={[styles.label, isFocused && styles.activeLabel]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 40,
    backgroundColor: "rgba(18,18,18,0.95)",
  },
  container: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingTop: 8,
    paddingBottom: 4,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingVertical: 4,
  },
  label: {
    fontSize: 9,
    fontWeight: "500",
    color: "rgba(255,255,255,0.5)",
  },
  activeLabel: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
});