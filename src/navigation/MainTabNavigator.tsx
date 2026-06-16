/**
 * MainTabNavigator — Bottom tab navigator with 5 tabs.
 *
 * Ported from: /routes/index.tsx, /routes/feed.tsx, /routes/map.tsx,
 *              /routes/circle.tsx, /routes/settings.tsx
 */

import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { BottomTabBar } from "./BottomTabBar";
import HomeScreen from "../screens/HomeScreen";
import FeedScreen from "../screens/FeedScreen";
import MapScreen from "../screens/MapScreen";
import CircleScreen from "../screens/CircleScreen";
import SettingsScreen from "../screens/SettingsScreen";
import type { MainTabParamList } from "./types";

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <BottomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        lazy: true,
      }}
      initialRouteName="HomeTab"
    >
      <Tab.Screen name="HomeTab" component={HomeScreen} />
      <Tab.Screen name="FeedTab" component={FeedScreen} />
      <Tab.Screen name="MapTab" component={MapScreen} />
      <Tab.Screen name="CircleTab" component={CircleScreen} />
      <Tab.Screen name="SettingsTab" component={SettingsScreen} />
    </Tab.Navigator>
  );
}