/**
 * AuthStack — Onboarding → Login.
 *
 * No bottom tabs. Shown when user is not authenticated.
 */

import { createNativeStackNavigator } from "@react-navigation/native-stack";
import OnboardingScreen from "../screens/OnboardingScreen";
import LoginScreen from "../screens/LoginScreen";
import type { AuthStackParamList } from "./types";

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
    </Stack.Navigator>
  );
}