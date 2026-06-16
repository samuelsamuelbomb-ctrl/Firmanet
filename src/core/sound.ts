/**
 * Sound Engine Interface — ported from src/lib/swish-sound.ts
 *
 * Defines a platform-agnostic abstraction for the Firmanet Sound Escalation Engine.
 *
 * Mobile implementation will use expo-av (see src/services/sound.native.ts).
 * Web implementation uses WebAudio API (see src/services/sound.web.ts).
 *
 * Sound levels:
 *   calm   → single soft chime
 *   warn   → double chime (escalating)
 *   danger → triple pulse
 *   sos    → repeating siren sweep
 */

import type { SoundLevel } from "./types";

export interface SoundEngine {
  play(level: SoundLevel): void;
  stopSos(): void;
  setMuted(value: boolean): void;
}

/**
 * Default no-op sound engine (used as fallback during loading or SSR).
 */
export const noopSoundEngine: SoundEngine = {
  play: () => {},
  stopSos: () => {},
  setMuted: () => {},
};

/**
 * Creates a sound engine backed by expo-av.
 * Import and call this in your native entry point.
 */
export async function createNativeSoundEngine(): Promise<SoundEngine> {
  // expo-av based implementation will go here
  // See sibling file: services/sound.native.ts
  const { NativeSoundEngine } = await import("../services/sound.native");
  return new NativeSoundEngine();
}

/**
 * Sound level → frequency mapping (based on original WebAudio implementation)
 */
export const SOUND_PROFILES: Record<
  SoundLevel,
  { frequencies: number[]; type: OscillatorType; gain: number; duration: number }
> = {
  calm: {
    frequencies: [659.25], // E5
    type: "sine",
    gain: 0.06,
    duration: 0.4,
  },
  warn: {
    frequencies: [659.25, 880], // E5 → A5
    type: "sine",
    gain: 0.09,
    duration: 0.3,
  },
  danger: {
    frequencies: [440, 440, 440], // A4 triple
    type: "sawtooth",
    gain: 0.14,
    duration: 0.22,
  },
  sos: {
    frequencies: [440, 659.25], // A4 ↔ E5 alternating
    type: "square",
    gain: 0.18,
    duration: 0.35,
  },
};