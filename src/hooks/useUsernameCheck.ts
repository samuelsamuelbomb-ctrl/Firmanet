/**
 * useUsernameCheck — Debounced username availability checker.
 *
 * Queries the profiles table to check if a username is already taken.
 * Excludes the current user's own username when editing their profile.
 */

import { useState, useEffect, useRef } from "react";
import { supabase } from "../core/supabase";

export type UsernameStatus = "idle" | "checking" | "available" | "taken" | "invalid";

export function useUsernameCheck(currentUsername?: string) {
  const [status, setStatus] = useState<UsernameStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const check = (value: string) => {
    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    const trimmed = value.trim();

    // Validation
    if (!trimmed) {
      setStatus("idle");
      setMessage(null);
      return;
    }

    if (trimmed.length < 2) {
      setStatus("invalid");
      setMessage("Username must be at least 2 characters");
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      setStatus("invalid");
      setMessage("Only letters, numbers, and underscores");
      return;
    }

    // Same as current — skip check
    if (currentUsername && trimmed.toLowerCase() === currentUsername.toLowerCase()) {
      setStatus("available");
      setMessage(null);
      return;
    }

    setStatus("checking");

    debounceRef.current = setTimeout(async () => {
      try {
        const { data, error } = await (supabase as any)
          .from("profiles")
          .select("username")
          .eq("username", trimmed)
          .maybeSingle();

        if (error) {
          setStatus("idle");
          setMessage(null);
          return;
        }

        if (data) {
          setStatus("taken");
          setMessage("Username is already taken");
        } else {
          setStatus("available");
          setMessage("Username is available");
        }
      } catch {
        setStatus("idle");
        setMessage(null);
      }
    }, 400);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return { status, message, check };
}