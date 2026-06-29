import { useSyncExternalStore, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Signal, SignalType, SignalCategory, SignalState } from "./swish-mock";

// Sample demo data for testing
const demoSignals: Signal[] = [
  {
    id: "demo-1",
    type: "incident",
    category: "crime",
    state: "emerging",
    title: "Suspicious Activity Reported",
    description: "Neighbors reported seeing suspicious activity near the park entrance.",
    location: "Central Park",
    minutesAgo: 15,
    distanceKm: 0.8,
    trust: 65,
    reports: 3,
    media: 1,
    lat: 40.7812,
    lng: -73.9665,
    media_urls: [
      "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800&q=80"
    ],
    confirms: 5,
    userConfirmed: false,
  },
  {
    id: "demo-2",
    type: "verified",
    category: "fire",
    state: "verified",
    title: "Small Fire Contained",
    description: "Local fire department has contained a small brush fire.",
    location: "Riverside Drive",
    minutesAgo: 45,
    distanceKm: 1.2,
    trust: 90,
    reports: 12,
    media: 2,
    lat: 40.8075,
    lng: -73.9626,
    media_urls: [
      "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80",
      "https://images.unsplash.com/photo-1473496169904-658ba7c44d8a?w=800&q=80"
    ],
    confirms: 20,
    userConfirmed: false,
  }
];

let state: Signal[] = [...demoSignals];
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
  media_urls?: string | string[] | null;
  confirms?: number;
};

function fromRow(r: DbRow): Signal {
  console.log("fromRow received DbRow:", r);
  let mediaUrls: string[] | undefined;
  if (r.media_urls) {
    if (typeof r.media_urls === "string") {
      try {
        mediaUrls = JSON.parse(r.media_urls);
      } catch {
        mediaUrls = [r.media_urls];
      }
    } else {
      mediaUrls = r.media_urls;
    }
  }
  console.log("fromRow returning mediaUrls:", mediaUrls);
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
    media_urls: mediaUrls,
    confirms: r.confirms ?? 0,
    userConfirmed: false,
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

function toggleConfirm(signalId: string) {
  state = state.map((x) => {
    if (x.id === signalId) {
      return {
        ...x,
        confirms: x.userConfirmed ? x.confirms - 1 : x.confirms + 1,
        userConfirmed: !x.userConfirmed,
      };
    }
    return x;
  });
  emit();

  // Persist to backend
  void (async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const signal = state.find(x => x.id === signalId);
    if (!signal) return;
    if (signal.userConfirmed) {
      await supabase
        .from("reports")
        .insert({ signal_id: signalId, user_id: auth.user.id, vote: 1 })
        .select();
    } else {
      await supabase
        .from("reports")
        .delete()
        .eq("signal_id", signalId)
        .eq("user_id", auth.user.id);
    }
  })();
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
      confirms: 0,
      userConfirmed: false,
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
          confirms: 0,
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
  toggleConfirm,
};

export function useSignals(): Signal[] {
  return useSyncExternalStore(signalStore.subscribe, signalStore.get, signalStore.get);
}

/** Helper to get storage URL for a media file */
function getStorageUrl(storagePath: string): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) return "";
  return `${supabaseUrl}/storage/v1/object/public/signal-media/${storagePath}`;
}

/** Bootstrap from DB + subscribe to realtime once per app session. */
export function useSignalsRealtime() {
  useEffect(() => {
    if (bootstrapped) return;
    bootstrapped = true;
    void (async () => {
      // 1. Fetch signals
      const { data: signalsData, error: signalsError } = await supabase
        .from("signals")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      console.log("Supabase bootstrap signals data:", signalsData, "Error:", signalsError);
      
      // 2. Fetch all media files for these signals
      let mediaData: any[] = [];
      if (!signalsError && signalsData && signalsData.length > 0) {
        const signalIds = signalsData.map(s => s.id);
        const { data: mediaResult, error: mediaError } = await supabase
          .from("media_files")
          .select("id, signal_id, storage_path, mime_type")
          .in("signal_id", signalIds)
          .order("created_at", { ascending: true });
        if (!mediaError && mediaResult) {
          mediaData = mediaResult;
        }
        console.log("Supabase media data:", mediaData);
      }

      if (!signalsError && signalsData) {
        // 3. Map signals and attach media
        const processedSignals = (signalsData as DbRow[]).map(row => {
          const signal = fromRow(row);
          const mediaFiles = mediaData.filter(m => m.signal_id === signal.id);
          signal.media_urls = mediaFiles.map(mf => getStorageUrl(mf.storage_path));
          return signal;
        });
        replaceSignals(processedSignals);
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
