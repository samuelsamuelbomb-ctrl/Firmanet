/**
 * App.tsx — Root entry point for Firmanet React Native (Expo).
 *
 * Sets up:
 * - NavigationContainer (React Navigation)
 * - AuthProvider (AuthContext)
 * - RootNavigator
 * - Signal store bootstrap (once per app session)
 * - Supabase app state listener (auto-refresh token on foreground)
 *
 * This file should be at the project root (standard Expo convention).
 */

import { useEffect, useCallback } from "react";
import { StatusBar, View, Text } from "react-native";
import { NavigationContainer, useNavigation } from "@react-navigation/native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./src/context/AuthContext";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { useSignalStore } from "./src/core/signalStore";
import { setupSupabaseAppStateListener } from "./src/core/supabase";
import { useFCM, createNotificationChannels } from "./src/services/notifications";
import type { PushNotificationData } from "./src/services/notifications";

const queryClient = new QueryClient();

/**
 * Inline component to bootstrap the signal store + FCM once on mount.
 * Must be inside NavigationContainer for navigation refs.
 */
function AppBootstrapper({ children }: { children: React.ReactNode }) {
  const bootstrap = useSignalStore((s) => s.bootstrap);
  const navigation = useNavigation<any>();

  // Handle push notification taps → navigate to relevant screen
  const handleNotificationOpened = useCallback(
    (data: PushNotificationData) => {
      const { kind, signal_id, sos_id, request_id } = data;

      if (kind === "sos" || kind === "danger") {
        // Navigate to Map to show the incident
        navigation.navigate("MainTabs", { screen: "MapTab" });
      } else if (signal_id) {
        // Navigate to IncidentDetail
        navigation.navigate("MainStack", {
          screen: "IncidentDetail",
          params: { id: signal_id },
        });
      } else if (kind === "circle_request" || kind === "circle_accepted" || request_id) {
        // Navigate to Circle tab
        navigation.navigate("MainTabs", { screen: "CircleTab" });
      } else if (sos_id) {
        // Navigate to Map for SOS
        navigation.navigate("MainTabs", { screen: "MapTab" });
      } else {
        // Default: open Notifications
        navigation.navigate("MainStack", { screen: "Notifications" });
      }
    },
    [navigation]
  );

  useEffect(() => {
    // Bootstrap signals from Supabase once per session
    void bootstrap();
    // Setup Supabase auto-refresh on app foreground
    const cleanup = setupSupabaseAppStateListener();
    return cleanup;
  }, [bootstrap]);

  // Init FCM
  useFCM(handleNotificationOpened);

  return <>{children}</>;
}

export default function App() {
  // Create Android notification channels once at startup
  useEffect(() => {
    createNotificationChannels();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NavigationContainer>
          <AppBootstrapper>
            <StatusBar barStyle="dark-content" backgroundColor="#F7F8FB" />
            <RootNavigator />
          </AppBootstrapper>
        </NavigationContainer>
      </AuthProvider>
    </QueryClientProvider>
  );
}
