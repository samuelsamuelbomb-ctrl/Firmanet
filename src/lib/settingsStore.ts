/**
 * Settings store — reactive settings for web.
 *
 * Persists to localStorage.
 * Provides a Zustand store + React hooks so any screen/component can
 * reactively consume settings values (radius, vibration, intensity, quiet hours).
 */

import { create } from "zustand";

// ─── Types ───

export type IntensityId = "minimal" | "balanced" | "full";

export interface AppSettings {
  intensity: IntensityId;
  vibration: number;       // 0–100
  radius: number;          // 1–10 km
  quietHours: boolean;
}

const SETTINGS_KEY = "firmanet-settings";

export const DEFAULT_SETTINGS: AppSettings = {
  intensity: "balanced",
  vibration: 70,
  radius: 3,
  quietHours: true,
};

// ─── Storage helpers ───

async function loadSettingsFromStorage(): Promise<AppSettings | null> {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      return JSON.parse(raw) as AppSettings;
    }
  } catch {
    // ignore errors
  }
  return null;
}

async function saveSettingsToStorage(settings: AppSettings): Promise<void> {
  try {
    const data = JSON.stringify(settings);
    localStorage.setItem(SETTINGS_KEY, data);
  } catch {
    // ignore errors
  }
}

// ─── Store ───

interface SettingsState extends AppSettings {
  /** True once settings have been loaded from storage */
  loaded: boolean;
}

interface SettingsActions {
  /** Load settings from storage (call once on app launch) */
  load: () => Promise<void>;
  setIntensity: (value: IntensityId) => void;
  setVibration: (value: number) => void;
  setRadius: (value: number) => void;
  setQuietHours: (value: boolean) => void;
}

export const useSettingsStore = create<SettingsState & SettingsActions>((set, get) => ({
  ...DEFAULT_SETTINGS,
  loaded: false,

  load: async () => {
    const saved = await loadSettingsFromStorage();
    if (saved) {
      set({
        intensity: saved.intensity ?? DEFAULT_SETTINGS.intensity,
        vibration: saved.vibration ?? DEFAULT_SETTINGS.vibration,
        radius: saved.radius ?? DEFAULT_SETTINGS.radius,
        quietHours: saved.quietHours ?? DEFAULT_SETTINGS.quietHours,
        loaded: true,
      });
    } else {
      set({ loaded: true });
    }
  },

  setIntensity: (value) => {
    set({ intensity: value });
    void saveSettingsToStorage(get());
  },

  setVibration: (value) => {
    set({ vibration: Math.max(0, Math.min(100, value)) });
    void saveSettingsToStorage(get());
  },

  setRadius: (value) => {
    set({ radius: Math.max(1, Math.min(10, value)) });
    void saveSettingsToStorage(get());
  },

  setQuietHours: (value) => {
    set({ quietHours: value });
    void saveSettingsToStorage(get());
  },
}));

// ─── Individual hooks (each subscribes to a single value — no object literals) ───

/** Reactively consume the alert intensity setting */
export function useIntensity(): IntensityId {
  return useSettingsStore((s) => s.intensity);
}

/** Reactively consume the vibration strength setting (0–100) */
export function useVibration(): number {
  return useSettingsStore((s) => s.vibration);
}

/** Reactively consume the radius setting (km) */
export function useRadius(): number {
  return useSettingsStore((s) => s.radius);
}

/** Reactively consume the quiet hours toggle */
export function useQuietHours(): boolean {
  return useSettingsStore((s) => s.quietHours);
}

// ─── Pure helpers (no hooks, safe to call anywhere) ───

/** Map alert intensity to the threshold of signal trust needed to trigger an alert */
export function intensityToMinTrust(intensity: IntensityId): number {
  switch (intensity) {
    case "minimal":
      return 80; // only high-confidence / verified
    case "balanced":
      return 40; // moderate trust
    case "full":
      return 0; // all signals
  }
}

/** Map alert intensity to the sound level at which signals become audible */
export function intensityToSoundLevel(intensity: IntensityId): string {
  switch (intensity) {
    case "minimal":
      return "danger";
    case "balanced":
      return "warn";
    case "full":
      return "calm";
  }
}

/** Get the vibration scale factor (0.0–1.0) based on the vibration setting */
export function vibrationScale(vibration: number): number {
  return Math.max(0, Math.min(1, vibration / 100));
}

/** Check if quiet hours are active — between 10 PM and 7 AM */
export function isQuietHoursNow(): boolean {
  const hour = new Date().getHours();
  return hour >= 22 || hour < 7;
}

/** Hook to determine if alerts should be suppressed due to quiet hours */
export function useShouldSuppressAlerts(): boolean {
  const quietHours = useSettingsStore((s) => s.quietHours);
  return quietHours && isQuietHoursNow();
}
