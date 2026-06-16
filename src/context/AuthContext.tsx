/**
 * AuthContext — Authentication state management.
 *
 * Replaces __root.tsx AuthSync + useAuthUser (lib/swish-auth.ts)
 * Provides: user, isLoading, isAuthenticated, signIn, signUp, signInWithGoogle, signOut
 */

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getCurrentUser,
  onAuthStateChange,
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle as googleSignIn,
  signOut as authSignOut,
} from "../core/auth";
import type { AppUser } from "../core/types";

interface AuthContextValue {
  user: AppUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    getCurrentUser().then((u) => {
      setUser(u);
      setIsLoading(false);
    });

    const unsubscribe = onAuthStateChange((event, user) => {
      setUser(user);
      if (event === "SIGNED_OUT") {
        queryClient.clear();
      } else if (event === "SIGNED_IN") {
        queryClient.invalidateQueries();
      }
    });

    return unsubscribe;
  }, [queryClient]);

  const value: AuthContextValue = {
    user,
    isLoading,
    isAuthenticated: user !== null,
    signIn: useCallback(async (email: string, password: string) => {
      const u = await signInWithEmail(email, password);
      setUser(u);
    }, []),
    signUp: useCallback(async (email: string, password: string, name?: string) => {
      const u = await signUpWithEmail(email, password, name);
      setUser(u);
    }, []),
    signInWithGoogle: useCallback(async () => {
      await googleSignIn();
    }, []),
    signOut: useCallback(async () => {
      await authSignOut();
      setUser(null);
    }, []),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}