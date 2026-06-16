/**
 * Firmanet Sound Escalation Engine
 *
 * Maps emotional weight → audio tone via WebAudio. Designed to feel like a
 * calm system that becomes loud only when reality demands it.
 *
 *   calm   → single soft mint chime (E5)
 *   warn   → double amber chime (E5 → A5)
 *   danger → triple red pulse (A4 sawtooth)
 *   sos    → siren sweep (A4 ↔ E5 repeating)
 */

export type SoundLevel = "calm" | "warn" | "danger" | "sos";

let ctx: AudioContext | null = null;
let muted = false;
let sosTimer: ReturnType<typeof setInterval> | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

export function setMuted(value: boolean) {
  muted = value;
  if (value) stopSos();
}

function tone(
  freq: number,
  duration: number,
  opts: { type?: OscillatorType; gain?: number; delay?: number } = {},
) {
  const c = getCtx();
  if (!c || muted) return;
  const { type = "sine", gain = 0.12, delay = 0 } = opts;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

export function play(level: SoundLevel) {
  if (muted) return;
  stopSos();
  switch (level) {
    case "calm":
      tone(659.25, 0.4, { gain: 0.06 });
      break;
    case "warn":
      tone(659.25, 0.25, { gain: 0.09 });
      tone(880, 0.3, { gain: 0.09, delay: 0.18 });
      break;
    case "danger":
      tone(440, 0.18, { type: "sawtooth", gain: 0.14 });
      tone(440, 0.18, { type: "sawtooth", gain: 0.14, delay: 0.22 });
      tone(440, 0.22, { type: "sawtooth", gain: 0.14, delay: 0.44 });
      break;
    case "sos":
      startSos();
      break;
  }
}

function startSos() {
  stopSos();
  const burst = () => {
    tone(440, 0.35, { type: "square", gain: 0.18 });
    tone(659.25, 0.35, { type: "square", gain: 0.18, delay: 0.4 });
  };
  burst();
  sosTimer = setInterval(burst, 900);
}

export function stopSos() {
  if (sosTimer) {
    clearInterval(sosTimer);
    sosTimer = null;
  }
}
