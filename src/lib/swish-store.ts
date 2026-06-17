import { useSyncExternalStore, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Signal, SignalType, SignalCategory, SignalState } from "./swish-mock";

let state: Signal[] = [];
const listeners = new Set<() => void>();
let bootstrapped = false;

function emit() {
  for (const l of listeners) l();
}

function minutesAgo(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
}

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
    lat: Number(r.lat) || 0,
    lng: Number(r.lng) || 0,
  };
}

function replaceSignals(incoming: Signal[]) {
  state = incoming;
  emit();
}

function upsertOne(s: Signal) {
  const idx = state.findIndex((x) => x.id === s.id);
  if (idx === -1) state = [s, ...state];
  else state = state.map((x) => (x.id === s.id ? s : x));
  emit();
}

export const signalStore = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  get(): Signal[] {
    return state;
  },
  add(input: {
    type: SignalType;
    category: SignalCategory;
    title: string;
    description?: string;
    location?: string;
    lat?: number;
    lng?: number;
  }) {
    const s: Signal = {
      id: `s-${Date.now()}`,
      type: input.type,
      category: input.category,
      state: "unverified",
      title: input.title.trim() || "Untitled signal",
      description: input.description?.trim() || undefined,
      location: input.location?.trim() || "Current Location",
      minutesAgo: 0,
      distanceKm: 0.2,
      trust: input.type === "observation" ? 32 : input.type === "update" ? 55 : 70,
      reports: 1,
      media: 0,
      lat: input.lat ?? 0,
      lng: input.lng ?? 0,
    };
    state = [s, ...state];
    emit();

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
        state = state.map((x) => (x.id === s.id ? real : x));
        emit();
      }
    })();

    return s;
  },
  async verify(signalId: string) {
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
};

export function useSignals(): Signal[] {
  return useSyncExternalStore(signalStore.subscribe, signalStore.get, signalStore.get);
}

/** Bootstrap from DB + subscribe to realtime once per app session. */
export function useSignalsRealtime() {
  useEffect(() => {
    if (bootstrapped) return;
    bootstrapped = true;
    void (async () => {
      const { data, error } = await supabase
        .from("signals")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (!error && data) {
        replaceSignals((data as DbRow[]).map(fromRow));
      }
    })();

    const ch = supabase
      .channel("signals-stream")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "signals" }, (payload) => {
        upsertOne(fromRow(payload.new as DbRow));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "signals" }, (payload) => {
        upsertOne(fromRow(payload.new as DbRow));
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
      bootstrapped = false;
    };
  }, []);
}
