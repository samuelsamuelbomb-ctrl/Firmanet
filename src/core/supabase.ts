/**
 * Supabase client singleton — ported from src/integrations/supabase/client.ts
 * Adapted for React Native: uses AsyncStorage instead of localStorage.
 *
 * Environment variables (set in .env or EAS Build secrets):
 *   EXPO_PUBLIC_SUPABASE_URL
 *   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
/**
 * NOTE: Replace `Record<string, never>` below with your generated Supabase types.
 * Generate them via: `npx supabase gen types typescript --local > src/core/supabase-types.ts`
 * Then change the Database type alias to: `import { Database } from "./supabase-types"`
 */
type Database = Record<string, never>;

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
      storage: AsyncStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false, // RN doesn't use URL-based session detection
    },
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

// Lazy singleton with proxy pattern (same as web version)
export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});

/**
 * Refresh Supabase session when app comes to foreground.
 * Call this in your App.tsx root component.
 */
export function setupSupabaseAppStateListener() {
  const handleAppStateChange = (nextState: string) => {
    if (nextState === "active") {
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

