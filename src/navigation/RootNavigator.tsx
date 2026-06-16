/**
 * RootNavigator — Routes between AuthFlow, MainTabs, MainStack, and SOS.
 *
 * Checks auth state via AuthContext.
 * If not authenticated → shows AuthFlow
 * If authenticated → shows MainTabs + MainStack
 * SOS is always accessible (even without auth)
 */

import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../context/AuthContext";
import { AuthStackNavigator } from "./AuthStack";
import { MainTabNavigator } from "./MainTabNavigator";
import { MainStackNavigator } from "./MainStackNavigator";
import SOSScreen from "../screens/SOSScreen";
import { View, ActivityIndicator, Text, StyleSheet } from "react-native";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.splash}>
        <Text style={styles.splashTitle}>Firmanet</Text>
        <ActivityIndicator size="small" color="#2D6A4F" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <>
          <Stack.Screen name="MainTabs" component={MainTabNavigator} />
          <Stack.Screen name="MainStack" component={MainStackNavigator} />
        </>
      ) : (
        <Stack.Screen name="AuthFlow" component={AuthStackNavigator} />
      )}
      {/* Always accessible: */}
      <Stack.Screen
        name="SOS"
        component={SOSScreen}
        options={{ presentation: "modal" }}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F7F8FB",
    gap: 16,
  },
  splashTitle: {
    fontSize: 32,
    fontWeight: "700",
    fontFamily: "Outfit",
    color: "#2D6A4F",
  },
});