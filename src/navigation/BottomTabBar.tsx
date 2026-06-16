/**
 * BottomTabBar — Custom glass-morphism tab bar.
 *
 * Ported from src/components/swish/BottomNav.tsx
 * 5 tabs: Home, Feed, Map, Circle, Settings
 */

import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Home, Newspaper, Map, Users, Settings } from "lucide-react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

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
    <View style={[styles.wrapper, { paddingBottom: insets.bottom + 12 }]}>
      <View style={styles.container}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
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
              <View style={[styles.iconContainer, isFocused && styles.activeIcon]}>
                <Icon
                  size={18}
                  strokeWidth={2.25}
                  color={isFocused ? "#2D6A4F" : "#8E8E93"}
                />
              </View>
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
  },
  container: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 24,
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.06)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    gap: 2,
    paddingVertical: 8,
    borderRadius: 16,
  },
  iconContainer: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 16,
  },
  activeIcon: {
    backgroundColor: "#D8F3DC",
  },
  label: {
    fontSize: 10,
    fontWeight: "500",
    color: "#8E8E93",
  },
  activeLabel: {
    color: "#2D6A4F",
  },
});