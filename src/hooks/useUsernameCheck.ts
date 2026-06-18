/**
 * useUsernameCheck — Debounced username availability checker.
 *
 * Uses case-insensitive matching via ilike() with limit(1).
 */

import { useState, useEffect, useRef } from "react";
import { supabase } from "../core/supabase";

export type UsernameStatus = "idle" | "checking" | "available" | "taken" | "invalid";

export function useUsernameCheck(currentUsername?: string) {
  const [status, setStatus] = useState<UsernameStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const check = (value: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    const trimmed = value.trim();

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
        // Use case-insensitive exact match with limit(1)
        const { count, error } = await (supabase as any)
          .from("profiles")
          .select("username", { count: "exact", head: true })
          .ilike("username", trimmed);

        if (!mountedRef.current) return;
        if (error) {
          setStatus("idle");
          setMessage(null);
          return;
        }

        if (count && count > 0) {
          setStatus("taken");
          setMessage("Username is already taken");
        } else {
          setStatus("available");
          setMessage("Username is available");
        }
      } catch {
        if (mountedRef.current) {
          setStatus("idle");
          setMessage(null);
        }
      }
    }, 400);
  };

  return { status, message, check };
}