/**
 * Expo Push Notifications Service — iOS & Android
 *
 * Uses expo-notifications for push notifications in Expo managed projects.
 * Tokens are synced to Supabase so the server can send targeted pushes.
 *
 * Notification types handled:
 *   - SOS alerts (emergency from circle members)
 *   - Nearby danger alerts (high-trust incidents within radius)
 *   - Verified incident alerts (signal reached verified status)
 *   - Circle requests (someone wants to join your circle)
 */

import { useState, useEffect, useRef } from "react";
import { Platform, Alert } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { supabase } from "../core/supabase";
import Constants from "expo-constants";

// Set notification handler to show alerts while app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ─── Types ───

export interface PushNotificationData {
  kind:
    | "sos"
    | "danger"
    | "verified"
    | "circle_request"
    | "circle_accepted"
    | "alert"
    | "system"
    | "info";
  title: string;
  body?: string;
  signal_id?: string;
  sos_id?: string;
  request_id?: string;
  from_user?: string;
}

export type NotificationHandler = (data: PushNotificationData) => void;

// ─── Permissions ───

/**
 * Request notification permissions from the user.
 * Returns true if permission was granted.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!Device.isDevice) {
    Alert.alert(
      "Physical Device Required",
      "Push notifications only work on physical devices, not simulators."
    );
    return false;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("[Notifications] Permission denied by user");
    return false;
  }

  console.log("[Notifications] Permission granted");
  return true;
}

// ─── Token Management ───

/**
 * Get the current Expo push token.
 * Returns null if the token cannot be retrieved.
 */
export async function getExpoPushToken(): Promise<string | null> {
  try {
    // Check if we're in Expo Go, which doesn't support remote notifications
    if (Constants.appOwnership === 'expo') {
      console.log("[Notifications] Running in Expo Go, skipping push token retrieval");
      return null;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      console.log("[Notifications] No projectId found, skipping token retrieval");
      return null;
    }

    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    console.log("[Notifications] Expo Push Token:", token);
    return token;
  } catch (error) {
    console.error("[Notifications] Failed to get token:", error);
    return null;
  }
}

/**
 * Sync the Expo push token to Supabase for server-side push targeting.
 * Stores in the `device_tokens` table associated with the current user.
 */
export async function syncTokenToSupabase(token: string | null): Promise<void> {
  if (!token) {
    console.log("[Notifications] No token to sync");
    return;
  }

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    console.log("[Notifications] No authenticated user, skipping token sync");
    return;
  }

  const platform = Platform.OS === "ios" ? "ios" : "android";

  const { error } = await supabase.from("device_tokens").upsert(
    {
      user_id: auth.user.id,
      token,
      platform,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id, platform" }
  );

  if (error) {
    console.error("[Notifications] Failed to sync token to Supabase:", error.message);
  } else {
    console.log("[Notifications] Token synced to Supabase");
  }
}

/**
 * Remove the device token from Supabase (called on sign out).
 */
export async function removeTokenFromSupabase(): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;

  const platform = Platform.OS === "ios" ? "ios" : "android";

  await supabase
    .from("device_tokens")
    .delete()
    .eq("user_id", auth.user.id)
    .eq("platform", platform);
}

// ─── Event Handlers ───

/**
 * Parse notification data into typed PushNotificationData.
 */
function parseNotificationData(
  notification: Notifications.Notification
): PushNotificationData | null {
  const data = notification.request.content.data;
  if (!data) return null;

  // Validate the kind field
  const kind = data.kind as PushNotificationData["kind"];
  const validKinds: PushNotificationData["kind"][] = [
    "sos",
    "danger",
    "verified",
    "circle_request",
    "circle_accepted",
    "alert",
    "system",
    "info",
  ];

  if (!validKinds.includes(kind)) {
    console.warn("[Notifications] Unknown notification kind:", kind);
    return null;
  }

  return {
    kind,
    title: data.title ?? notification.request.content.title ?? "Firmanet Alert",
    body: data.body ?? notification.request.content.body ?? undefined,
    signal_id: data.signal_id ?? undefined,
    sos_id: data.sos_id ?? undefined,
    request_id: data.request_id ?? undefined,
    from_user: data.from_user ?? undefined,
  };
}

// ─── React Hook ───

/**
 * useNotifications — React hook that initialises Expo Notifications,
 * requests permissions, syncs the token, and provides navigation helpers.
 *
 * Usage: call once in App.tsx (or root component).
 *
 * @param onNotificationOpened — Called when user taps a push notification.
 *                               Use this to navigate to the relevant screen.
 */
export function useFCM(
  onNotificationOpened?: NotificationHandler
) {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const handlerRef = useRef(onNotificationOpened);
  handlerRef.current = onNotificationOpened;

  // Initialise: permissions + token
  useEffect(() => {
    let mounted = true;

    void (async () => {
      // 1. Request permission
      const granted = await requestNotificationPermission();
      if (!mounted) return;
      setHasPermission(granted);

      if (!granted) {
        console.log("[Notifications] No permission, skipping setup");
        return;
      }

      // 2. Get and sync token
      const token = await getExpoPushToken();
      if (!mounted) return;

      if (token) {
        setExpoPushToken(token);
        await syncTokenToSupabase(token);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // Handle notification tap while app is in background/quit
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = parseNotificationData(response.notification);
        if (data && handlerRef.current) {
          handlerRef.current(data);
        }
      }
    );
    return () => subscription.remove();
  }, []);

  // Handle foreground notifications
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener(
      (notification) => {
        const data = parseNotificationData(notification);
        if (!data) return;
        console.log("[Notifications] Foreground message:", data.kind, data.title);
      }
    );
    return () => subscription.remove();
  }, []);

  return {
    expoPushToken,
    hasPermission,
  };
}

// ─── Notification Channel (Android) ───

/**
 * Create notification channels for Android.
 * iOS uses the system-level notification settings.
 * Call this once at app startup.
 */
export function createNotificationChannels(): void {
  if (Platform.OS !== "android") return;

  try {
    Notifications.setNotificationChannelAsync("sos_alerts", {
      name: "SOS Alerts",
      importance: Notifications.AndroidImportance.MAX,
      description: "Emergency SOS alerts from your circle",
      lightColor: "#FF231F7C",
      vibrationPattern: [0, 250, 250, 250],
    });

    Notifications.setNotificationChannelAsync("danger_alerts", {
      name: "Nearby Danger",
      importance: Notifications.AndroidImportance.HIGH,
      description: "High-trust danger alerts near your location",
    });

    Notifications.setNotificationChannelAsync("verified_alerts", {
      name: "Verified Incidents",
      importance: Notifications.AndroidImportance.DEFAULT,
      description: "Incidents that have reached verified status",
    });

    Notifications.setNotificationChannelAsync("circle", {
      name: "Circle Notifications",
      importance: Notifications.AndroidImportance.LOW,
      description: "Circle requests and updates",
    });

    Notifications.setNotificationChannelAsync("system", {
      name: "System Notifications",
      importance: Notifications.AndroidImportance.MIN,
      description: "System updates and info",
    });

    console.log("[Notifications] Android channels configured");
  } catch (error) {
    console.error("[Notifications] Failed to create channels:", error);
  }
}
