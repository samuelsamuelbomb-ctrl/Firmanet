import { create } from "zustand";
import { Platform } from "react-native";
import type { Sponsor, SponsorTier } from "./types";

// Get the correct supabase client for the platform
let supabase: any;
if (Platform.OS === "web") {
  // For web, use the Vite supabase client
  const webModule = require("@/integrations/supabase/client");
  supabase = webModule.supabase;
} else {
  // For native, use the React Native client
  const nativeModule = require("./supabase");
  supabase = nativeModule.supabase;
}

interface StoreState {
  sponsors: Sponsor[];
  isBootstrapped: boolean;
  isLoading: boolean;
  error: string | null;
}

interface StoreActions {
  bootstrap: () => Promise<void>;
}

export const useSponsorStore = create<StoreState & StoreActions>((set, get) => ({
  sponsors: [],
  isBootstrapped: false,
  isLoading: false,
  error: null,

  bootstrap: async () => {
    if (get().isBootstrapped || get().isLoading) return;
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from("sponsors")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) throw error;

      const processed = data?.map((row: any): Sponsor => ({
        id: row.id,
        name: row.name,
        tagline: row.tagline,
        tier: row.tier as SponsorTier,
        initials: row.initials,
        accent: row.accent,
        image_url: row.image_url,
      })) || [];

      set({ sponsors: processed, isBootstrapped: true, isLoading: false });
    } catch (err) {
      console.error("[sponsorStore] Error fetching sponsors:", err);
      set({
        error: err instanceof Error ? err.message : "Failed to load sponsors",
        isLoading: false,
      });
    }
  },
}));

export function useSponsors(): Sponsor[] {
  return useSponsorStore((s) => s.sponsors);
}

export function useSponsorsBootstrap() {
  const isBootstrapped = useSponsorStore((s) => s.isBootstrapped);
  const isLoading = useSponsorStore((s) => s.isLoading);
  const bootstrap = useSponsorStore((s) => s.bootstrap);
  return { isBootstrapped, isLoading, bootstrap };
}
