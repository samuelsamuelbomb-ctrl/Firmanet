/**
 * Supabase client singleton — ported from src/integrations/supabase/client.ts
 * Adapted for React Native: uses AsyncStorage instead of localStorage.
 *
 * Environment variables (set in .env or EAS Build secrets):
 *   EXPO_PUBLIC_SUPABASE_URL
 *   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 *
 * NOTE: React Native imports are lazy-loaded to prevent
 * TurboModuleRegistry.getEnforcing('PlatformConstants') crashes at module evaluation time.
 * Also avoids crashes in Expo Go where @react-native-async-storage/async-storage
 * is not available as a pre-installed module.
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Returns a storage adapter compatible with Supabase's auth.storage option.
 * Tries @react-native-async-storage/async-storage first (bare RN / dev builds),
 * falls back to expo-secure-store (Expo managed), then in-memory as last resort.
 */
function getStorageAdapter(): any {
  // 1. Try @react-native-async-storage/async-storage (bare RN, dev builds)
  try {
    const AsyncStorage = require("@react-native-async-storage/async-storage").default;
    if (AsyncStorage) return AsyncStorage;
  } catch {
    // not available — continue
  }

  // 2. Try expo-secure-store (Expo managed / Expo Go compatible)
  try {
    const SecureStore = require("expo-secure-store");
    if (SecureStore && SecureStore.getItemAsync) {
      return {
        getItem: (key: string) => SecureStore.getItemAsync(key),
        setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
        removeItem: (key: string) => SecureStore.deleteItemAsync(key),
      };
    }
  } catch {
    // not available — continue
  }

  // 3. Fall back to localStorage (web) or in-memory (RN without storage)
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }

  // 4. In-memory fallback for SSR / environments without any storage
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
  };
}

function createSupabaseClient() {
  const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
  const SUPABASE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    const missing = [
      ...(!SUPABASE_URL ? ["EXPO_PUBLIC_SUPABASE_URL"] : []),
      ...(!SUPABASE_PUBLISHABLE_KEY ? ["EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY"] : []),
    ];
    const message = `Missing Supabase environment variable(s): ${missing.join(", ")}. Add them to your .env file.`;
    console.error(`[Supabase] ${message}`);
    throw new Error(message);
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      storage: getStorageAdapter(),
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false, // RN doesn't use URL-based session detection
    },
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

// Export the Supabase URL synchronously for building storage URLs
// This is populated when the proxy first initializes
export let SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";

// Lazy singleton with proxy pattern (same as web version)
export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) {
      _supabase = createSupabaseClient();
      // Grab the URL from the created client (process.env may be empty at module load in RN)
      SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL as string) || (_supabase as any).supabaseUrl || "";
    }
    return Reflect.get(_supabase, prop, receiver);
  },
});

/**
 * Refresh Supabase session when app comes to foreground.
 * Call this in your App.tsx root component.
 */
export function setupSupabaseAppStateListener() {
  // Lazy-require AppState to avoid eager TurboModule resolution at module evaluation time.
  let AppState: any = null;
  try {
    AppState = require("react-native").AppState;
  } catch {
    return () => {}; // No-op on web / SSR
  }

  const handleAppStateChange = (nextAppState: string) => {
    if (nextAppState === "active") {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  };

  const subscription = AppState.addEventListener("change", handleAppStateChange);
  return () => {
    subscription.remove();
  };
}