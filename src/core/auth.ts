/**
 * Authentication helpers — extracted from:
 *   - src/routes/_authenticated/route.tsx (auth guard)
 *   - src/routes/auth.tsx (sign in/up logic)
 *   - src/routes/__root.tsx (AuthSync)
 *
 * Platform-agnostic. React Native screens import these functions.
 */

import { supabase } from "./supabase";
import type { AppUser, AuthMode } from "./types";

/** Custom error for auth guard failures */
export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * Get the currently authenticated user.
 * Returns null if no session.
 */
export async function getCurrentUser(): Promise<AppUser | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return null;
  return {
    id: data.user.id,
    email: data.user.email ?? "",
    displayName: data.user.user_metadata?.name ?? undefined,
  };
}

/**
 * Auth guard — throws if user is not authenticated.
 * Use in protected screen components or navigation guards.
 */
export async function requireAuth(): Promise<AppUser> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    throw new AuthError("Not authenticated");
  }
  return {
    id: data.user.id,
    email: data.user.email ?? "",
    displayName: data.user.user_metadata?.name ?? undefined,
  };
}

/**
 * Sign in with email and password.
 * Returns the user on success, throws on error.
 */
export async function signInWithEmail(
  email: string,
  password: string,
): Promise<AppUser> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  if (!data.user) throw new Error("Sign in succeeded but no user returned");
  return {
    id: data.user.id,
    email: data.user.email ?? "",
    displayName: data.user.user_metadata?.name ?? undefined,
  };
}

/**
 * Sign up with email, password, and optional display name.
 * Returns the user on success, throws on error.
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  name?: string,
): Promise<AppUser> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: name ? { name } : undefined,
    },
  });
  if (error) throw error;
  if (!data.user) throw new Error("Sign up succeeded but no user returned");
  return {
    id: data.user.id,
    email: data.user.email ?? "",
    displayName: name ?? data.user.user_metadata?.name ?? undefined,
  };
}

/**
 * Sign in with Google OAuth.
 * On mobile, this opens the system browser. The session is automatically
 * captured via the Supabase Auth URL scheme configured in your app.
 */
export async function signInWithGoogle(): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: undefined, // RN handles redirect via deep link
    },
  });
  if (error) throw error;
}

/**
 * Sign out the current user.
 */
export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Subscribe to auth state changes.
 * Returns an unsubscribe function.
 *
 * Usage:
 *   useEffect(() => {
 *     const unsub = onAuthStateChange((event, user) => {
 *       if (event === 'SIGNED_IN') { ... }
 *       if (event === 'SIGNED_OUT') { ... }
 *     });
 *     return unsub;
 *   }, []);
 */
export function onAuthStateChange(
  callback: (event: string, user: AppUser | null) => void,
): () => void {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    const user = session?.user
      ? {
          id: session.user.id,
          email: session.user.email ?? "",
          displayName: session.user.user_metadata?.name ?? undefined,
        }
      : null;
    callback(event, user);
  });
  return () => subscription.unsubscribe();
}

/**
 * Check if the user has completed onboarding.
 * Uses AsyncStorage (injected via platform adapter).
 */
export function isOnboardingComplete(): boolean {
  // This is a synchronous stub. In the actual RN app, use:
  //   import AsyncStorage from '@react-native-async-storage/async-storage';
  //   const val = await AsyncStorage.getItem('swish.onboarded');
  //   return val === '1';
  return false;
}

/**
 * Mark onboarding as complete.
 */
export async function markOnboardingComplete(): Promise<void> {
  // In the actual RN app:
  //   import AsyncStorage from '@react-native-async-storage/async-storage';
  //   await AsyncStorage.setItem('swish.onboarded', '1');
}