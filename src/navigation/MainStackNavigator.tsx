/**
 * MainStackNavigator — Push screens: Notifications, Profile, IncidentDetail.
 *
 * Ported from: /_authenticated/notifications.tsx, /_authenticated/profile.tsx, /incident/$id.tsx
 */

import { createNativeStackNavigator } from "@react-navigation/native-stack";
import NotificationsScreen from "../screens/NotificationsScreen";
import ProfileScreen from "../screens/ProfileScreen";
import IncidentDetailScreen from "../screens/IncidentDetailScreen";
import NearbyIncidentsScreen from "../screens/NearbyIncidentsScreen";
import type { MainStackParamList } from "./types";

const Stack = createNativeStackNavigator<MainStackParamList>();

export function MainStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="IncidentDetail" component={IncidentDetailScreen} />
      <Stack.Screen name="NearbyIncidents" component={NearbyIncidentsScreen} />
    </Stack.Navigator>
  );
}
