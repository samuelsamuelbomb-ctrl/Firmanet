/**
 * Signal store — ported from src/lib/swish-store.ts
 *
 * Key changes from web version:
 *   - useSyncExternalStore + Set<listeners> → Zustand create()
 *   - React hooks become Zustand hooks
 *   - All business logic preserved: fromRow(), upsertOne(), replaceSignals(), minutesAgo()
 *   - Supabase sync + Realtime subscription kept identical
 *
 * CRITICAL FIX: The Realtime subscription is now truly singleton — initialized once
 * per app session and never duplicated. Previously, each screen calling
 * useSignalsRealtime() would create its own subscription, causing the error:
 * "cannot add `postgres_changes` callbacks for realtime:signals-stream after `subscribe()`."
 */

import { create } from "zustand";
import { useEffect } from "react";
import { supabase, SUPABASE_URL } from "./supabase";
import { IKEJA_CENTER } from "./constants";
import type { Signal, SignalType, SignalCategory, SignalState, MediaFile } from "./types";

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
  media_urls?: string | string[] | null;
  confirms?: number;
};

type AddInput = {
  type: SignalType;
  category: SignalCategory;
  title: string;
  description?: string;
  location?: string;
  lat?: number;
  lng?: number;
  mediaCount?: number;
};

type VerifyResult = { ok: boolean; error?: string };

interface StoreState {
  signals: Signal[];
  isBootstrapped: boolean;
}

interface StoreActions {
  bootstrap: () => Promise<void>;
  subscribeToRealtime: () => () => void;
  /** Optimistic add with server persistence — returns the real signal once saved */
  addAndPersist: (input: AddInput) => Promise<Signal>;
  verify: (signalId: string) => Promise<VerifyResult>;
  toggleConfirm: (signalId: string) => void;
  _replaceSignals: (incoming: Signal[]) => void;
  _upsertOne: (s: Signal) => void;
}

// ─── Pure helpers ───

function minutesAgo(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
}

function getStorageUrl(storagePath: string): string {
  const { data } = supabase.storage.from("signal-media").getPublicUrl(storagePath);
  return data.publicUrl;
}

function fromRow(r: DbRow, extra?: { 
  likes?: number; 
  comments?: number; 
  views?: number;
  shares?: number;
  total_watch_time_seconds?: number;
  liked_by_user?: boolean;
}): Signal {
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
    media_urls: mediaUrls,
    likes: extra?.likes ?? 0,
    comments: extra?.comments ?? 0,
    views: extra?.views ?? 0,
    shares: extra?.shares ?? 0,
    total_watch_time_seconds: extra?.total_watch_time_seconds ?? 0,
    liked_by_user: extra?.liked_by_user ?? false,
    confirms: r.confirms ?? 0,
    userConfirmed: false,
  };
}

async function loadMediaForSignal(signalId: string): Promise<{ urls: string[], files: MediaFile[] }> {
  const { data: mediaData } = await supabase
    .from("media_files")
    .select("id, signal_id, storage_path, mime_type")
    .eq("signal_id", signalId)
    .order("created_at", { ascending: true });
  if (!mediaData) return { urls: [], files: [] };
  
  const urls: string[] = [];
  const files: MediaFile[] = [];
  mediaData.forEach(mf => {
    urls.push(getStorageUrl(mf.storage_path));
    files.push({
      id: mf.id,
      storage_path: mf.storage_path,
      mime_type: mf.mime_type,
    });
  });
  
  return { urls, files };
}

function upsertOne(signals: Signal[], s: Signal): Signal[] {
  const idx = signals.findIndex((x) => x.id === s.id);
  if (idx === -1) return [s, ...signals];
  return signals.map((x) => (x.id === s.id ? s : x));
}

// ─── Optimistic ID helper — guaranteed unique, no crypto dependency ───
let _optCounter = 0;
function makeId(): string {
  return `opt-${Date.now()}-${++_optCounter}`;
}

// Module-level singleton state for Realtime — created once, never duplicated
let _channelSetupDone = false;

export const useSignalStore = create<StoreState & StoreActions>((set, get) => ({
  signals: [],
  isBootstrapped: false,

  _replaceSignals: (incoming: Signal[]) => {
    set({ signals: incoming });
  },

  _upsertOne: (s: Signal) => {
    set((state) => {
      // 1. Exact ID match — standard upsert, keep max media
      if (state.signals.some((x) => x.id === s.id)) {
        const existing = state.signals.find((x) => x.id === s.id);
        if (existing) s.media = Math.max(existing.media, s.media);
        return { signals: upsertOne(state.signals, s) };
      }
      // 2. Match by title+location — this catches Realtime INSERTs
      //    that correspond to our optimistic row (which has a different ID).
      const match = state.signals.findIndex(
        (x) => x.title === s.title && x.location === s.location && x.id.startsWith("opt-"),
      );
      if (match !== -1) {
        const updated = [...state.signals];
        s.media = Math.max(updated[match].media, s.media);
        updated[match] = s;
        return { signals: updated };
      }
      // 3. Genuinely new signal
      return { signals: upsertOne(state.signals, s) };
    });
  },

  bootstrap: async () => {
    if (get().isBootstrapped) return;
    const { data: signalsData, error: signalsError } = await supabase
      .from("signals")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    console.log('[signalStore bootstrap] Signals data:', signalsData, 'Error:', signalsError);

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    console.log('[signalStore bootstrap] Current user:', user);

    if (!signalsError && signalsData) {
      const signalIds = signalsData.map(s => s.id);
      console.log('[signalStore bootstrap] Signal IDs:', signalIds);

      // Fetch likes count and whether current user liked
      const { data: likesData, error: likesError } = await supabase
        .from("signal_likes")
        .select("signal_id, user_id")
        .in("signal_id", signalIds);
      console.log('[signalStore bootstrap] Likes data:', likesData, 'Error:', likesError);

      // Fetch comments count
      const { data: commentsData, error: commentsError } = await supabase
        .from("signal_comments")
        .select("signal_id")
        .in("signal_id", signalIds);
      console.log('[signalStore bootstrap] Comments data:', commentsData, 'Error:', commentsError);

      // Fetch views and total watch time
      const { data: viewsData, error: viewsError } = await supabase
        .from("signal_views")
        .select("signal_id, watch_time_seconds")
        .in("signal_id", signalIds);
      console.log('[signalStore bootstrap] Views data:', viewsData, 'Error:', viewsError);

      // Fetch media files for signals
      const { data: mediaData, error: mediaError } = await supabase
        .from("media_files")
        .select("id, signal_id, storage_path, mime_type")
        .in("signal_id", signalIds)
        .order("created_at", { ascending: true });
      console.log('[signalStore bootstrap] Media data:', mediaData, 'Error:', mediaError);

      // Calculate counts
      const likesCount: Record<string, number> = {};
      const userLikes: Set<string> = new Set();
      const commentsCount: Record<string, number> = {};
      const viewsCount: Record<string, number> = {};
      const sharesCount: Record<string, number> = {}; // Add shares count (we don't have a shares table yet, so default 0)
      const totalWatchTime: Record<string, number> = {};
      const mediaUrls: Record<string, string[]> = {};

      if (likesData) {
        likesData.forEach(like => {
          likesCount[like.signal_id] = (likesCount[like.signal_id] || 0) + 1;
          if (user && like.user_id === user.id) {
            userLikes.add(like.signal_id);
          }
        });
      }

      if (commentsData) {
        commentsData.forEach(comment => {
          commentsCount[comment.signal_id] = (commentsCount[comment.signal_id] || 0) + 1;
        });
      }

      if (viewsData) {
        viewsData.forEach(view => {
          viewsCount[view.signal_id] = (viewsCount[view.signal_id] || 0) + 1;
          totalWatchTime[view.signal_id] = (totalWatchTime[view.signal_id] || 0) + (Number(view.watch_time_seconds) || 0);
        });
      }

      // Build mediaUrls map and media files map
      console.log('[signalStore bootstrap] mediaData:', mediaData, 'mediaError:', mediaError);
      const mediaFilesMap: Record<string, MediaFile[]> = {};
      if (mediaData) {
        mediaData.forEach(mf => {
          const url = getStorageUrl(mf.storage_path);
          console.log('[signalStore bootstrap] Building media URL for', mf.signal_id, mf.storage_path, '→', url);
          if (!mediaUrls[mf.signal_id]) mediaUrls[mf.signal_id] = [];
          mediaUrls[mf.signal_id].push(url);
          
          if (!mediaFilesMap[mf.signal_id]) mediaFilesMap[mf.signal_id] = [];
          mediaFilesMap[mf.signal_id].push({
            id: mf.id,
            storage_path: mf.storage_path,
            mime_type: mf.mime_type,
          });
        });
      }
      console.log('[signalStore bootstrap] mediaUrls map:', mediaUrls);
      console.log('[signalStore bootstrap] mediaFiles map:', mediaFilesMap);

      const processedSignals = (signalsData as DbRow[]).map(row => {
        const signal = fromRow(row, {
          likes: likesCount[row.id] ?? 0,
          comments: commentsCount[row.id] ?? 0,
          views: viewsCount[row.id] ?? 0,
          shares: sharesCount[row.id] ?? 0,
          total_watch_time_seconds: totalWatchTime[row.id] ?? 0,
          liked_by_user: userLikes.has(row.id),
        });
        signal.media_urls = mediaUrls[row.id] ?? [];
        signal.media_files = mediaFilesMap[row.id] ?? [];
        console.log('[signalStore bootstrap] Processed signal:', signal);
        return signal;
      });

      set({ signals: processedSignals, isBootstrapped: true });
    } else {
      console.error('[signalStore bootstrap] Error fetching signals:', signalsError);
      set({ isBootstrapped: true });
    }
  },

  subscribeToRealtime: () => {
    if (_channelSetupDone) return () => {};
    _channelSetupDone = true;
    // Create and subscribe the channel inline — no guard needed beyond the flag
    supabase
      .channel("signals-stream")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "signals" }, async (payload) => {
        const newSignal = fromRow(payload.new as DbRow);
        const { urls, files } = await loadMediaForSignal(newSignal.id);
        newSignal.media_urls = urls;
        newSignal.media_files = files;
        get()._upsertOne(newSignal);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "signals" }, async (payload) => {
        const updatedSignal = fromRow(payload.new as DbRow);
        const { urls, files } = await loadMediaForSignal(updatedSignal.id);
        updatedSignal.media_urls = urls;
        updatedSignal.media_files = files;
        get()._upsertOne(updatedSignal);
      })
      .subscribe();
    // Return a no-op cleanup — subscription lives for the app session
    return () => {};
  },

  addAndPersist: async (input: AddInput): Promise<Signal> => {
    const optimisticId = makeId();
    console.log("[addAndPersist] Starting, optimistic ID:", optimisticId);
    const signal: Signal = {
      id: optimisticId,
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
      media: input.mediaCount ?? 0,
      lat: input.lat ?? IKEJA_CENTER.lat,
      lng: input.lng ?? IKEJA_CENTER.lng,
    };

    // Optimistic insert
    set((state) => ({ signals: [signal, ...state.signals] }));

    // Persist to backend
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      console.warn("[addAndPersist] No auth user, returning optimistic signal");
      return signal; // offline — keep optimistic
    }
    console.log("[addAndPersist] Inserting signal into Supabase...");
    const { data, error } = await (supabase as any)
      .from("signals")
      .insert({
        author_id: auth.user.id,
        type: input.type,
        category: input.category,
        title: signal.title,
        description: signal.description,
        location: signal.location,
        trust: signal.trust,
        lat: signal.lat,
        lng: signal.lng,
      })
      .select()
      .single();

    if (error) {
      console.error("[addAndPersist] Supabase insert error:", error);
      return signal;
    }
    
    console.log("[addAndPersist] Supabase insert successful, data:", data);

    if (!error && data) {
      const real = fromRow(data as DbRow);
      console.log("[addAndPersist] Real signal ID:", real.id);
      // Preserve the optimistic media count (server row has 0 since upload is async)
      if (signal.media > 0) real.media = signal.media;
      // Use _upsertOne to replace the optimistic row.
      // This handles both: still-optimistic rows and Realtime-replaced rows.
      get()._upsertOne(real);
      return real;
    }

    return signal;
  },

  verify: async (signalId: string): Promise<VerifyResult> => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return { ok: false, error: "Sign in to verify" };
    const { error } = await (supabase as any).from("reports").insert({ signal_id: signalId, user_id: auth.user.id, vote: 1 });
    if (error && !error.message.toLowerCase().includes("duplicate")) return { ok: false, error: error.message };
    return { ok: true };
  },

  toggleConfirm: (signalId: string) => {
    // Optimistic update
    set((state) => {
      const updatedSignals = state.signals.map((signal) => {
        if (signal.id === signalId) {
          return {
            ...signal,
            confirms: signal.userConfirmed ? signal.confirms - 1 : signal.confirms + 1,
            userConfirmed: !signal.userConfirmed,
          };
        }
        return signal;
      });
      return { signals: updatedSignals };
    });

    // Persist to backend
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const state = get();
      const signal = state.signals.find((s) => s.id === signalId);
      if (!signal) return;
      if (signal.userConfirmed) {
        await (supabase as any)
          .from("reports")
          .insert({ signal_id: signalId, user_id: auth.user.id, vote: 1 });
      } else {
        await (supabase as any)
          .from("reports")
          .delete()
          .eq("signal_id", signalId)
          .eq("user_id", auth.user.id);
      }
    })();
  },
}));

export function useSignals(): Signal[] {
  return useSignalStore((s) => s.signals);
}

export function useSignalsRealtime() {
  const isBootstrapped = useSignalStore((s) => s.isBootstrapped);
  const bootstrap = useSignalStore((s) => s.bootstrap);
  const subscribeToRealtime = useSignalStore((s) => s.subscribeToRealtime);
  useEffect(() => {
    void bootstrap();
    subscribeToRealtime();
  }, []);
}

export const signalStore = {
  get signals() { return useSignalStore.getState().signals; },
  addAndPersist: (input: AddInput) => useSignalStore.getState().addAndPersist(input),
  verify: (signalId: string) => useSignalStore.getState().verify(signalId),
  toggleConfirm: (signalId: string) => useSignalStore.getState().toggleConfirm(signalId),
};