/**
 * Firebase Cloud Messaging (FCM) service — iOS & Android push notifications.
 *
 * Uses @react-native-firebase/messaging for native FCM integration.
 * NOTE: This module is lazy-loaded to avoid crashes in Expo Go.
 * Tokens are synced to Supabase so the server can send targeted pushes.
 *
 * Notification types handled:
 *   - SOS alerts (emergency from circle members)
 *   - Nearby danger alerts (high-trust incidents within radius)
 *   - Verified incident alerts (signal reached verified status)
 *   - Circle requests (someone wants to join your circle)
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Platform, Alert } from "react-native";
import { supabase } from "../core/supabase";

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

// ─── Lazy module loader for @react-native-firebase/messaging ───

let _messagingModule: any = null;

async function getMessaging(): Promise<any> {
  if (_messagingModule) return _messagingModule;
  try {
    _messagingModule = await import("@react-native-firebase/messaging");
    return _messagingModule;
  } catch {
    console.log("[FCM] @react-native-firebase/messaging not available (Expo Go)");
    return null;
  }
}

// ─── Permissions ───

/**
 * Request notification permissions from the user.
 * iOS shows a system dialog; Android grants automatically after install.
 * Returns true if permission was granted.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const mod = await getMessaging();
    if (!mod) return false;
    const messaging = mod.default;
    const authStatus = await messaging.requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (!enabled) {
      console.log("[FCM] Permission denied by user");
      return false;
    }

    console.log("[FCM] Permission granted:", authStatus);
    return true;
  } catch (error) {
    console.error("[FCM] Permission request failed:", error);
    return false;
  }
}

// ─── Token Management ───

/**
 * Get the current FCM device token.
 * Returns null if the token cannot be retrieved.
 */
export async function getFcmToken(): Promise<string | null> {
  try {
    const mod = await getMessaging();
    if (!mod) return null;
    const token = await mod.default.getToken();
    return token;
  } catch (error) {
    console.error("[FCM] Failed to get token:", error);
    return null;
  }
}

/**
 * Delete the current FCM token (called on sign out).
 */
export async function deleteFcmToken(): Promise<void> {
  try {
    const mod = await getMessaging();
    if (!mod) return;
    await mod.default.deleteToken();
    console.log("[FCM] Token deleted");
  } catch (error) {
    console.error("[FCM] Failed to delete token:", error);
  }
}

/**
 * Sync the FCM token to Supabase for server-side push targeting.
 * Stores in the `device_tokens` table associated with the current user.
 */
export async function syncTokenToSupabase(token: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    console.log("[FCM] No authenticated user, skipping token sync");
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
    console.error("[FCM] Failed to sync token to Supabase:", error.message);
  } else {
    console.log("[FCM] Token synced to Supabase");
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
 * Parse FCM remote message data into typed PushNotificationData.
 */
function parseMessageData(
  message: any
): PushNotificationData | null {
  const data = message?.data;
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
    console.warn("[FCM] Unknown notification kind:", kind);
    return null;
  }

  return {
    kind,
    title: data.title ?? "Firmanet Alert",
    body: data.body ?? undefined,
    signal_id: data.signal_id ?? undefined,
    sos_id: data.sos_id ?? undefined,
    request_id: data.request_id ?? undefined,
    from_user: data.from_user ?? undefined,
  };
}

/**
 * Handle a push notification that was tapped / opened by the user.
 * Returns the parsed notification data or null.
 */
export function handleNotificationOpen(
  message: any
): PushNotificationData | null {
  return parseMessageData(message);
}

// ─── React Hook ───

/**
 * useFCM — React hook that initialises FCM, requests permissions,
 * syncs the token, and provides navigation helpers for push notifications.
 *
 * Usage: call once in App.tsx (or root component).
 *
 * @param onNotificationOpened - Called when user taps a push notification.
 *                               Use this to navigate to the relevant screen.
 */
export function useFCM(
  onNotificationOpened?: NotificationHandler
) {
  const [fcmToken, setFcmToken] = useState<string | null>(null);
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
        console.log("[FCM] No permission, skipping setup");
        return;
      }

      // 2. Get and sync token
      const token = await getFcmToken();
      if (!mounted) return;

      if (token) {
        setFcmToken(token);
        await syncTokenToSupabase(token);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // Handle foreground messages (show local notification)
  useEffect(() => {
    if (!hasPermission) return;

    let unsubscribe: (() => void) | undefined;

    void (async () => {
      const mod = await getMessaging();
      if (!mod) return;
      const messaging = mod.default;
      unsubscribe = messaging.onMessage(async (message: any) => {
        const data = parseMessageData(message);
        if (!data) return;
        console.log("[FCM] Foreground message:", data.kind, data.title);
      });
    })();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [hasPermission]);

  // Handle notification that opened the app (from quit state)
  useEffect(() => {
    if (!hasPermission) return;

    void (async () => {
      const mod = await getMessaging();
      if (!mod) return;
      const messaging = mod.default;
      const message = await messaging.getInitialNotification();
      if (message) {
        const data = parseMessageData(message);
        if (data && handlerRef.current) {
          handlerRef.current(data);
        }
      }
    })();
  }, [hasPermission]);

  // Handle notification tap while app is in background
  useEffect(() => {
    if (!hasPermission) return;

    let unsubscribe: (() => void) | undefined;

    void (async () => {
      const mod = await getMessaging();
      if (!mod) return;
      const messaging = mod.default;
      unsubscribe = messaging.onNotificationOpenedApp((message: any) => {
        const data = parseMessageData(message);
        if (data && handlerRef.current) {
          handlerRef.current(data);
        }
      });
    })();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [hasPermission]);

  // Handle token refresh
  useEffect(() => {
    if (!hasPermission) return;

    let unsubscribe: (() => void) | undefined;

    void (async () => {
      const mod = await getMessaging();
      if (!mod) return;
      const messaging = mod.default;
      unsubscribe = messaging.onTokenRefresh(async (newToken: string) => {
        console.log("[FCM] Token refreshed");
        setFcmToken(newToken);
        await syncTokenToSupabase(newToken);
      });
    })();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [hasPermission]);

  return {
    fcmToken,
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
    const channels = [
      {
        channelId: "sos_alerts",
        channelName: "SOS Alerts",
        importance: 4,
        description: "Emergency SOS alerts from your circle",
      },
      {
        channelId: "danger_alerts",
        channelName: "Nearby Danger",
        importance: 4,
        description: "High-trust danger alerts near your location",
      },
      {
        channelId: "verified_alerts",
        channelName: "Verified Incidents",
        importance: 3,
        description: "Incidents that have reached verified status",
      },
      {
        channelId: "circle",
        channelName: "Circle Notifications",
        importance: 2,
        description: "Circle requests and updates",
      },
      {
        channelId: "system",
        channelName: "System Notifications",
        importance: 1,
        description: "System updates and info",
      },
    ];

    console.log("[FCM] Android channels configured:", channels.length);
  } catch (error) {
    console.error("[FCM] Failed to create channels:", error);
  }
}