/**
 * Signal store — ported from src/lib/swish-store.ts
 *
 * Key changes from web version:
 *   - useSyncExternalStore + Set<listeners> → Zustand create()
 *   - React hooks become Zustand hooks
 *   - All business logic preserved: fromRow(), upsertOne(), replaceSignals(), minutesAgo()
 *   - Supabase sync + Realtime subscription kept identical
 */

import { create } from "zustand";
import { useEffect } from "react";
import { supabase } from "./supabase";
import { IKEJA_CENTER } from "./constants";
import type { Signal, SignalType, SignalCategory, SignalState } from "./types";

// ─── Types ───

type DbRow = {
  id: string;
  type: SignalType;
  category: SignalCategory;
  state: SignalState;
  title: string;
  description: string | null;
  location: string;
  distance_km: number | string;
  trust: number;
  reports: number;
  media: number;
  created_at: string;
  lat: number | string;
  lng: number | string;
};

type AddInput = {
  type: SignalType;
  category: SignalCategory;
  title: string;
  description?: string;
  location?: string;
  lat?: number;
  lng?: number;
};

type VerifyResult = { ok: boolean; error?: string };

interface StoreState {
  signals: Signal[];
  isBootstrapped: boolean;
}

interface StoreActions {
  /** Initialize from server — call once at app launch */
  bootstrap: () => Promise<void>;
  /** Subscribe to Supabase Realtime for live updates */
  subscribeToRealtime: () => () => void;
  /** Optimistic add with server persistence */
  add: (input: AddInput) => Signal;
  /** Verify a signal (add a user report) */
  verify: (signalId: string) => Promise<VerifyResult>;
  /** Internal: replace entire signals array */
  _replaceSignals: (incoming: Signal[]) => void;
  /** Internal: upsert a single signal */
  _upsertOne: (s: Signal) => void;
}

// ─── Pure helpers (preserved from swish-store.ts) ───

function minutesAgo(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
}

function fromRow(r: DbRow): Signal {
  return {
    id: r.id,
    type: r.type,
    category: (r.category as SignalCategory) ?? "other",
    state: (r.state as SignalState) ?? "unverified",
    title: r.title,
    description: r.description ?? undefined,
    location: r.location,
    minutesAgo: minutesAgo(r.created_at),
    distanceKm: Number(r.distance_km) || 0,
    trust: r.trust,
    reports: r.reports,
    media: r.media,
    lat: Number(r.lat) || IKEJA_CENTER.lat,
    lng: Number(r.lng) || IKEJA_CENTER.lng,
  };
}

function upsertOne(signals: Signal[], s: Signal): Signal[] {
  const idx = signals.findIndex((x) => x.id === s.id);
  if (idx === -1) return [s, ...signals];
  return signals.map((x) => (x.id === s.id ? s : x));
}

// ─── Closure-level bootstrapped flag (singleton per app session) ───

let bootstrapped = false;

// ─── Zustand Store ───

export const useSignalStore = create<StoreState & StoreActions>((set, get) => ({
  signals: [],
  isBootstrapped: false,

  _replaceSignals: (incoming: Signal[]) => {
    set({ signals: incoming });
  },

  _upsertOne: (s: Signal) => {
    set((state) => ({ signals: upsertOne(state.signals, s) }));
  },

  bootstrap: async () => {
    if (bootstrapped) return;
    bootstrapped = true;
    const { data, error } = await supabase
      .from("signals")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (!error && data) {
      set({ signals: (data as DbRow[]).map(fromRow), isBootstrapped: true });
    } else {
      set({ isBootstrapped: true });
    }
  },

  subscribeToRealtime: () => {
    const channel = supabase
      .channel("signals-stream")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "signals" },
        (payload) => {
          get()._upsertOne(fromRow(payload.new as DbRow));
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "signals" },
        (payload) => {
          get()._upsertOne(fromRow(payload.new as DbRow));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
      bootstrapped = false;
    };
  },

  add: (input: AddInput) => {
    const s: Signal = {
      id: `s-${Date.now()}`,
      type: input.type,
      category: input.category,
      state: "unverified",
      title: input.title.trim() || "Untitled signal",
      description: input.description?.trim() || undefined,
      location: input.location?.trim() || "Ikeja, Lagos",
      minutesAgo: 0,
      distanceKm: 0.2,
      trust: input.type === "observation" ? 32 : input.type === "update" ? 55 : 70,
      reports: 1,
      media: 0,
      lat: input.lat ?? IKEJA_CENTER.lat,
      lng: input.lng ?? IKEJA_CENTER.lng,
    };

    // Optimistic insert
    set((state) => ({ signals: [s, ...state.signals] }));

    // Persist to backend if signed in; ignore errors (UI keeps optimistic row)
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data, error } = await supabase
        .from("signals")
        .insert({
          author_id: auth.user.id,
          type: input.type,
          category: input.category,
          title: s.title,
          description: s.description,
          location: s.location,
          trust: s.trust,
          lat: s.lat,
          lng: s.lng,
        })
        .select()
        .single();
      if (!error && data) {
        const real = fromRow(data as DbRow);
        set((state) => ({ signals: state.signals.map((x) => (x.id === s.id ? real : x)) }));
      }
    })();

    return s;
  },

  verify: async (signalId: string): Promise<VerifyResult> => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return { ok: false, error: "Sign in to verify" };
    const { error } = await supabase
      .from("reports")
      .insert({ signal_id: signalId, user_id: auth.user.id, vote: 1 });
    if (error && !error.message.toLowerCase().includes("duplicate")) {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  },
}));

// ─── React Hooks (same API as web's swish-store) ───

/**
 * Get all signals from the store.
 */
export function useSignals(): Signal[] {
  return useSignalStore((s) => s.signals);
}

/**
 * Bootstrap signals from DB and subscribe to Realtime.
 * Call once per app session (e.g., in App.tsx or root layout).
 * Automatically prevents duplicate initialization.
 */
export function useSignalsRealtime() {
  const bootstrap = useSignalStore((s) => s.bootstrap);
  const subscribeToRealtime = useSignalStore((s) => s.subscribeToRealtime);

  useEffect(() => {
    void bootstrap();
    const unsubscribe = subscribeToRealtime();
    return () => {
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/**
 * Direct access to the store object (for imperative usage).
 */
export const signalStore = {
  get signals() {
    return useSignalStore.getState().signals;
  },
  add: (input: AddInput) => useSignalStore.getState().add(input),
  verify: (signalId: string) => useSignalStore.getState().verify(signalId),
};