/**
 * M-EDU Spatial Acoustic Engine — Ultra-Luxury Apple VisionOS & Taptic Edition V2
 *
 * Acoustic Architecture:
 *  - Procedural micro-transient & organic physical acoustic modeling (Zero 90s sine sweeps/buzzers)
 *  - Micro-haptic tactile clicks (dual-layer: solid aluminum chassis sub-body + oleophobic glass tap)
 *  - Fluid liquid-glass bubble resonance (Apple VisionOS spatial capsule expand)
 *  - Crystalline diamond confirmation chimes (Apple Pay / luxury watch acoustic chime triad)
 *  - Subdued tactile double-thud for errors (zero harsh 8-bit game buzzers)
 *  - Mechanical Leica camera shutter & aperture spring settling
 *  - Luxury golden coin resonance & financial confirmation chime
 *  - Ethereal glass notification bells & ascending pentatonic celebration cascades
 *  - Master dynamics compressor + Butterworth warmth smoothing filter (0% clipping or distortion)
 *  - Dynamic Master Volume control (0.0 to 1.0) with smooth logarithmic ramping
 *  - Physical hardware haptic feedback synchronization (navigator.vibrate)
 *  - Zero-latency hardware clock scheduling with automatic node garbage collection
 *  - SSR & hydration safe, battery-preserving automatic sleep
 */

import { useCallback, useSyncExternalStore } from 'react';

// ============================================================================
// 1. CONSTANTS & TYPES
// ============================================================================

const STORAGE_KEY = 'm-edu.sound-muted';
const VOLUME_KEY = 'm-edu.sound-volume';
const HAPTICS_KEY = 'm-edu.sound-haptics';

const MUTE_EVENT = 'm-edu:sound-muted-changed';
const VOLUME_EVENT = 'm-edu:sound-volume-changed';
const HAPTICS_EVENT = 'm-edu:sound-haptics-changed';

export type SoundNote = {
  /** Initial frequency (Hz) */
  freq: number;
  /** End frequency (Hz) for organic natural pitch settling (optional) */
  endFreq?: number;
  /** Waveform type */
  type: OscillatorType;
  /** Duration in seconds */
  duration: number;
  /** Delay relative to schedule start (seconds) */
  delay?: number;
  /** Peak volume (0.0 - 1.0) */
  volume?: number;
  /** Attack time (seconds) to prevent click artifacts */
  attack?: number;
  /** Low-pass / band-pass filter frequency for acoustic warmth (Hz) */
  filterFreq?: number;
  /** Filter type (default: 'lowpass') */
  filterType?: BiquadFilterType;
  /** Filter resonance Q */
  filterQ?: number;
};

export const ACOUSTIC_PRESET_NAMES = [
  'pop',
  'tick',
  'success',
  'error',
  'notification',
  'celebration',
  'shutter',
  'payment',
  'switch',
  'sent',
  'delete',
  'faceid_match',
  'faceid_denied',
  'faceid_duplicate',
  'laser_scan',
] as const;

export type AcousticPreset = (typeof ACOUSTIC_PRESET_NAMES)[number];

interface WebkitWindow extends Window {
  webkitAudioContext?: typeof AudioContext;
}

// ============================================================================
// 2. SAFE STORAGE & REACTIVE EXTERNAL STORE (React 18+ SSR Safe)
// ============================================================================

const listeners = new Set<() => void>();
let isMutedState = false;
let volumeState = 0.8;
let hapticsState = true;
let isStoreInitialized = false;

function readMutedFromStorage(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function readVolumeFromStorage(): number {
  if (typeof window === 'undefined') return 0.8;
  try {
    const raw = window.localStorage.getItem(VOLUME_KEY);
    if (!raw) return 0.8;
    const parsed = parseFloat(raw);
    return Number.isFinite(parsed) ? Math.max(0, Math.min(1, parsed)) : 0.8;
  } catch {
    return 0.8;
  }
}

function readHapticsFromStorage(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = window.localStorage.getItem(HAPTICS_KEY);
    return raw !== null ? raw === 'true' : true;
  } catch {
    return true;
  }
}

function initStoreIfNeeded(): void {
  if (isStoreInitialized || typeof window === 'undefined') return;
  isStoreInitialized = true;
  isMutedState = readMutedFromStorage();
  volumeState = readVolumeFromStorage();
  hapticsState = readHapticsFromStorage();

  window.addEventListener('storage', (e: StorageEvent) => {
    let changed = false;
    if (e.key === STORAGE_KEY) {
      const nextMuted = e.newValue === 'true';
      if (isMutedState !== nextMuted) {
        isMutedState = nextMuted;
        changed = true;
      }
    } else if (e.key === VOLUME_KEY) {
      const nextVol = e.newValue ? parseFloat(e.newValue) : 0.8;
      if (Number.isFinite(nextVol) && volumeState !== nextVol) {
        volumeState = Math.max(0, Math.min(1, nextVol));
        changed = true;
      }
    } else if (e.key === HAPTICS_KEY) {
      const nextHaptics = e.newValue !== null ? e.newValue === 'true' : true;
      if (hapticsState !== nextHaptics) {
        hapticsState = nextHaptics;
        changed = true;
      }
    }
    if (changed) emitChange();
  });

  // Global user interaction gesture to unlock Web Audio on mobile Safari / Chrome
  const unlockAudio = () => {
    if (sharedAudioCtx && sharedAudioCtx.state === 'suspended' && !isMutedState) {
      sharedAudioCtx.resume().catch(() => {});
    }
    window.removeEventListener('pointerdown', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
  };
  window.addEventListener('pointerdown', unlockAudio, { passive: true, once: true });
  window.addEventListener('keydown', unlockAudio, { passive: true, once: true });
}

function emitChange(): void {
  listeners.forEach((listener) => listener());
}

function subscribeAcousticStore(listener: () => void): () => void {
  initStoreIfNeeded();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getMuteSnapshot(): boolean {
  initStoreIfNeeded();
  return isMutedState;
}

function getVolumeSnapshot(): number {
  initStoreIfNeeded();
  return volumeState;
}

function getHapticsSnapshot(): boolean {
  initStoreIfNeeded();
  return hapticsState;
}

function getServerMuteSnapshot(): boolean {
  return false;
}

function getServerVolumeSnapshot(): number {
  return 0.8;
}

function getServerHapticsSnapshot(): boolean {
  return true;
}

export function useAudioSettings(): {
  isMuted: boolean;
  volume: number;
  haptics: boolean;
  setMuted: (muted: boolean) => void;
  setVolume: (volume: number) => void;
  setHaptics: (enabled: boolean) => void;
  toggleMute: () => void;
} {
  const isMuted = useSyncExternalStore(subscribeAcousticStore, getMuteSnapshot, getServerMuteSnapshot);
  const volume = useSyncExternalStore(subscribeAcousticStore, getVolumeSnapshot, getServerVolumeSnapshot);
  const haptics = useSyncExternalStore(subscribeAcousticStore, getHapticsSnapshot, getServerHapticsSnapshot);

  const toggleMute = useCallback(() => {
    setAudioMuted(!isMuted);
  }, [isMuted]);

  return {
    isMuted,
    volume,
    haptics,
    setMuted: setAudioMuted,
    setVolume: setAudioVolume,
    setHaptics: setHapticsEnabled,
    toggleMute,
  };
}

export function isAudioMuted(): boolean {
  return getMuteSnapshot();
}

export function getAudioVolume(): number {
  return getVolumeSnapshot();
}

export function isHapticsEnabled(): boolean {
  return getHapticsSnapshot();
}

export function setAudioMuted(muted: boolean): void {
  initStoreIfNeeded();
  if (isMutedState === muted) return;

  isMutedState = muted;

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(muted));
    } catch {
      // ignore storage errors
    }
    window.dispatchEvent(new CustomEvent<boolean>(MUTE_EVENT, { detail: muted }));
  }

  if (masterGain && sharedAudioCtx) {
    const targetGain = muted ? 0 : volumeState;
    masterGain.gain.setTargetAtTime(targetGain, sharedAudioCtx.currentTime, 0.012);
  }

  if (muted && sharedAudioCtx && sharedAudioCtx.state === 'running') {
    sharedAudioCtx.suspend().catch(() => {});
  }

  emitChange();
}

export function setAudioVolume(volume: number): void {
  initStoreIfNeeded();
  const clamped = Math.max(0, Math.min(1, volume));
  if (Math.abs(volumeState - clamped) < 0.001) return;

  volumeState = clamped;

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(VOLUME_KEY, clamped.toFixed(2));
    } catch {
      // ignore storage errors
    }
    window.dispatchEvent(new CustomEvent<number>(VOLUME_EVENT, { detail: clamped }));
  }

  if (masterGain && sharedAudioCtx && !isMutedState) {
    masterGain.gain.setTargetAtTime(clamped, sharedAudioCtx.currentTime, 0.015);
  }

  emitChange();
}

export function setHapticsEnabled(enabled: boolean): void {
  initStoreIfNeeded();
  if (hapticsState === enabled) return;

  hapticsState = enabled;

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(HAPTICS_KEY, String(enabled));
    } catch {
      // ignore storage errors
    }
    window.dispatchEvent(new CustomEvent<boolean>(HAPTICS_EVENT, { detail: enabled }));
  }

  emitChange();
}

/** Triggers physical device vibration when supported and enabled */
function triggerHaptic(pattern: number | number[]): void {
  if (typeof window === 'undefined' || !isHapticsEnabled()) return;
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Graceful fallback on restrictive browsers
    }
  }
}

// ============================================================================
// 3. SINGLETON CORE AUDIO ENGINE (Master Bus + Spatial Limiter)
// ============================================================================

let sharedAudioCtx: AudioContext | null = null;
let masterCompressor: DynamicsCompressorNode | null = null;
let masterAcousticFilter: BiquadFilterNode | null = null;
let masterGain: GainNode | null = null;
let cachedNoiseBuffer: AudioBuffer | null = null;
let lastSoundTime = 0;
let lastSoundType = '';

function getAudioEngine(): { ctx: AudioContext; destination: AudioNode } | null {
  if (typeof window === 'undefined' || isAudioMuted()) return null;

  if (!sharedAudioCtx) {
    const AudioCtx = window.AudioContext || (window as WebkitWindow).webkitAudioContext;
    if (!AudioCtx) return null;

    sharedAudioCtx = new AudioCtx({ latencyHint: 'interactive' });

    // Apple Master Dynamics Compressor (Prevents any clipping or distortion)
    masterCompressor = sharedAudioCtx.createDynamicsCompressor();
    masterCompressor.threshold.setValueAtTime(-14, sharedAudioCtx.currentTime);
    masterCompressor.knee.setValueAtTime(24, sharedAudioCtx.currentTime);
    masterCompressor.ratio.setValueAtTime(6, sharedAudioCtx.currentTime);
    masterCompressor.attack.setValueAtTime(0.002, sharedAudioCtx.currentTime);
    masterCompressor.release.setValueAtTime(0.12, sharedAudioCtx.currentTime);

    // Warmth & De-essing Master Filter: Cuts harsh screech above 11.5 kHz
    masterAcousticFilter = sharedAudioCtx.createBiquadFilter();
    masterAcousticFilter.type = 'lowpass';
    masterAcousticFilter.frequency.setValueAtTime(11500, sharedAudioCtx.currentTime);
    masterAcousticFilter.Q.setValueAtTime(0.707, sharedAudioCtx.currentTime);

    // Master Volume Gain Node
    masterGain = sharedAudioCtx.createGain();
    const effectiveVol = isMutedState ? 0 : volumeState;
    masterGain.gain.setValueAtTime(effectiveVol, sharedAudioCtx.currentTime);

    // Audio Graph: nodes -> compressor -> warmth filter -> master gain -> speakers
    masterCompressor.connect(masterAcousticFilter);
    masterAcousticFilter.connect(masterGain);
    masterGain.connect(sharedAudioCtx.destination);
  }

  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }

  return {
    ctx: sharedAudioCtx,
    destination: masterCompressor ?? sharedAudioCtx.destination,
  };
}

/** Pre-renders an ultra-short (12ms) organic micro-transient noise impulse for tactile clicks */
function getTactileNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (cachedNoiseBuffer && cachedNoiseBuffer.sampleRate === ctx.sampleRate) {
    return cachedNoiseBuffer;
  }
  const length = Math.floor(ctx.sampleRate * 0.012);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    // Sharp exponential decay curve (physical impact impulse)
    const decay = Math.exp(-i / (length * 0.22));
    data[i] = (Math.random() * 2 - 1) * decay;
  }
  cachedNoiseBuffer = buffer;
  return buffer;
}

/**
 * Hardware-clock scheduled acoustic synthesizer.
 * Eliminates timing jitter, handles attack/decay smoothing, and prevents memory leaks.
 */
function synthesizeSequence(notes: readonly SoundNote[], soundIdentifier?: string): void {
  const engine = getAudioEngine();
  if (!engine) return;

  const { ctx, destination } = engine;
  const now = ctx.currentTime;

  // Micro-throttle: Prevent identical sounds from stacking and flamming within 14ms
  if (soundIdentifier && soundIdentifier === lastSoundType && now - lastSoundTime < 0.014) {
    return;
  }
  if (soundIdentifier) {
    lastSoundType = soundIdentifier;
    lastSoundTime = now;
  }

  const baseTime = now + 0.003;

  for (const note of notes) {
    const startTime = baseTime + (note.delay ?? 0);
    const duration = Math.max(0.01, note.duration);
    const stopTime = startTime + duration;
    const peakVolume = Math.max(0.001, Math.min(1.0, note.volume ?? 0.1));
    const attackTime = Math.min(duration * 0.25, note.attack ?? 0.003);

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    let filterNode: BiquadFilterNode | null = null;

    osc.type = note.type;
    osc.frequency.setValueAtTime(note.freq, startTime);

    if (note.endFreq && note.endFreq > 0) {
      osc.frequency.exponentialRampToValueAtTime(note.endFreq, stopTime);
    }

    if (note.filterFreq) {
      filterNode = ctx.createBiquadFilter();
      filterNode.type = note.filterType ?? 'lowpass';
      filterNode.frequency.setValueAtTime(note.filterFreq, startTime);
      filterNode.Q.setValueAtTime(note.filterQ ?? 0.707, startTime);
    }

    // Natural Acoustic Envelope: zero click attack -> smooth exponential decay
    gainNode.gain.setValueAtTime(0.0001, startTime);
    gainNode.gain.linearRampToValueAtTime(peakVolume, startTime + attackTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, stopTime);

    if (filterNode) {
      osc.connect(filterNode);
      filterNode.connect(gainNode);
    } else {
      osc.connect(gainNode);
    }
    gainNode.connect(destination);

    osc.start(startTime);
    osc.stop(stopTime + 0.005);

    osc.onended = () => {
      try {
        osc.disconnect();
        if (filterNode) filterNode.disconnect();
        gainNode.disconnect();
      } catch {
        // Safe disconnection
      }
    };
  }
}

/**
 * Ultra-Luxury Glass Tactile Click (Apple Digital Crown & Taptic Engine standard)
 * Combines an ultra-precise micro-transient snap with an organic high-damped resonant body.
 */
function playTactileGlassClick(): void {
  const engine = getAudioEngine();
  if (!engine) return;

  const { ctx, destination } = engine;
  const now = ctx.currentTime;

  if (now - lastSoundTime < 0.015 && lastSoundType === 'tick') return;
  lastSoundType = 'tick';
  lastSoundTime = now;

  triggerHaptic(6);

  const startTime = now + 0.001;

  // 1. Organic tactile tap body (Clean miniature wooden/glass impulse: 1600Hz -> 750Hz in 7ms)
  const tapOsc = ctx.createOscillator();
  const tapGain = ctx.createGain();
  const tapFilter = ctx.createBiquadFilter();

  tapOsc.type = 'sine';
  tapOsc.frequency.setValueAtTime(1600, startTime);
  tapOsc.frequency.exponentialRampToValueAtTime(750, startTime + 0.007);

  tapFilter.type = 'bandpass';
  tapFilter.frequency.setValueAtTime(1200, startTime);
  tapFilter.Q.setValueAtTime(1.8, startTime);

  tapGain.gain.setValueAtTime(0.0001, startTime);
  tapGain.gain.linearRampToValueAtTime(0.045, startTime + 0.001);
  tapGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.007);

  tapOsc.connect(tapFilter);
  tapFilter.connect(tapGain);
  tapGain.connect(destination);

  tapOsc.start(startTime);
  tapOsc.stop(startTime + 0.008);

  // 2. High-precision Oleophobic Glass Micro-Snap (Airy transient click, 3200Hz)
  const noiseBuffer = getTactileNoiseBuffer(ctx);
  const noiseSource = ctx.createBufferSource();
  const noiseFilter = ctx.createBiquadFilter();
  const noiseGain = ctx.createGain();

  noiseSource.buffer = noiseBuffer;

  noiseFilter.type = 'bandpass';
  noiseFilter.frequency.setValueAtTime(3200, startTime);
  noiseFilter.Q.setValueAtTime(3.2, startTime);

  noiseGain.gain.setValueAtTime(0.0001, startTime);
  noiseGain.gain.linearRampToValueAtTime(0.024, startTime + 0.0008);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.005);

  noiseSource.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(destination);

  noiseSource.start(startTime);
  noiseSource.stop(startTime + 0.006);

  // Auto garbage collection
  tapOsc.onended = () => {
    try {
      tapOsc.disconnect();
      tapFilter.disconnect();
      tapGain.disconnect();
      noiseSource.disconnect();
      noiseFilter.disconnect();
      noiseGain.disconnect();
    } catch {
      // Ignored
    }
  };
}

/**
 * Mechanical Leica Camera Shutter Synthesis
 * Reconstructs the exact physical acoustic signature of a focal-plane shutter
 */
function playMechanicalShutterSound(): void {
  const engine = getAudioEngine();
  if (!engine) return;

  const { ctx, destination } = engine;
  const now = ctx.currentTime;

  if (now - lastSoundTime < 0.05 && lastSoundType === 'shutter') return;
  lastSoundType = 'shutter';
  lastSoundTime = now;

  triggerHaptic([10, 18, 12]);

  const startTime = now + 0.001;

  // 1. Mirror reflex transient (750 Hz -> 260 Hz)
  const slapOsc = ctx.createOscillator();
  const slapGain = ctx.createGain();
  const slapFilter = ctx.createBiquadFilter();

  slapOsc.type = 'sine';
  slapOsc.frequency.setValueAtTime(750, startTime);
  slapOsc.frequency.exponentialRampToValueAtTime(260, startTime + 0.012);

  slapFilter.type = 'bandpass';
  slapFilter.frequency.setValueAtTime(650, startTime);
  slapFilter.Q.setValueAtTime(1.5, startTime);

  slapGain.gain.setValueAtTime(0.0001, startTime);
  slapGain.gain.linearRampToValueAtTime(0.048, startTime + 0.001);
  slapGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.012);

  slapOsc.connect(slapFilter);
  slapFilter.connect(slapGain);
  slapGain.connect(destination);

  slapOsc.start(startTime);
  slapOsc.stop(startTime + 0.015);

  // 2. High-precision shutter curtain slide (noise pulse at +15ms)
  const noiseBuffer = getTactileNoiseBuffer(ctx);
  const curtainNoise = ctx.createBufferSource();
  const curtainFilter = ctx.createBiquadFilter();
  const curtainGain = ctx.createGain();

  curtainNoise.buffer = noiseBuffer;
  curtainFilter.type = 'bandpass';
  curtainFilter.frequency.setValueAtTime(2400, startTime + 0.014);
  curtainFilter.Q.setValueAtTime(2.2, startTime + 0.014);

  curtainGain.gain.setValueAtTime(0.0001, startTime + 0.014);
  curtainGain.gain.linearRampToValueAtTime(0.038, startTime + 0.015);
  curtainGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.026);

  curtainNoise.connect(curtainFilter);
  curtainFilter.connect(curtainGain);
  curtainGain.connect(destination);

  curtainNoise.start(startTime + 0.014);
  curtainNoise.stop(startTime + 0.028);

  // 3. Aperture return & spring settling (at +30ms)
  const returnOsc = ctx.createOscillator();
  const returnGain = ctx.createGain();

  returnOsc.type = 'sine';
  returnOsc.frequency.setValueAtTime(950, startTime + 0.03);
  returnOsc.frequency.exponentialRampToValueAtTime(340, startTime + 0.045);

  returnGain.gain.setValueAtTime(0.0001, startTime + 0.03);
  returnGain.gain.linearRampToValueAtTime(0.032, startTime + 0.031);
  returnGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.045);

  returnOsc.connect(returnGain);
  returnGain.connect(destination);

  returnOsc.start(startTime + 0.03);
  returnOsc.stop(startTime + 0.048);

  // Garbage cleanup
  returnOsc.onended = () => {
    try {
      slapOsc.disconnect();
      slapFilter.disconnect();
      slapGain.disconnect();
      curtainNoise.disconnect();
      curtainFilter.disconnect();
      curtainGain.disconnect();
      returnOsc.disconnect();
      returnGain.disconnect();
    } catch {
      // Ignored
    }
  };
}

// ============================================================================
// 4. LUXURY ACOUSTIC PRESETS (Pure Physical & Spatial Harmonics)
// ============================================================================

const PRESETS = {
  // Apple VisionOS Fluid Glass Capsule (Light organic droplet resonance: 880Hz -> 1320Hz)
  POP: [
    { freq: 880, endFreq: 1320, type: 'sine', duration: 0.028, volume: 0.048, attack: 0.001, filterFreq: 2800 },
    { freq: 1760, endFreq: 2640, type: 'sine', duration: 0.016, volume: 0.018, attack: 0.001, filterFreq: 4200 },
  ] as const satisfies readonly SoundNote[],

  // Diamond Crystal Confirmation Chime (Apple Pay / Luxury Watch acoustic chime triad)
  SUCCESS: [
    { freq: 739.99, type: 'sine', duration: 0.18, delay: 0, volume: 0.055, attack: 0.002, filterFreq: 3400 },
    { freq: 932.33, type: 'sine', duration: 0.22, delay: 0.038, volume: 0.065, attack: 0.002, filterFreq: 3800 },
    { freq: 1108.73, type: 'sine', duration: 0.32, delay: 0.076, volume: 0.075, attack: 0.002, filterFreq: 4400 },
    { freq: 1479.98, type: 'sine', duration: 0.4, delay: 0.114, volume: 0.08, attack: 0.002, filterFreq: 5200 },
  ] as const satisfies readonly SoundNote[],

  // Subdued Tactile Felt Double-Tap (Soft muted physical bumps, 0% harshness)
  ERROR: [
    { freq: 220, endFreq: 160, type: 'sine', duration: 0.032, delay: 0, volume: 0.05, attack: 0.002, filterFreq: 420 },
    { freq: 175, endFreq: 130, type: 'sine', duration: 0.038, delay: 0.048, volume: 0.045, attack: 0.002, filterFreq: 380 },
  ] as const satisfies readonly SoundNote[],

  // Luxury Ethereal Glass Notification Droplet
  NOTIFICATION: [
    { freq: 1046.5, type: 'sine', duration: 0.18, delay: 0, volume: 0.065, attack: 0.001, filterFreq: 3600 },
    { freq: 1567.98, type: 'sine', duration: 0.28, delay: 0.045, volume: 0.075, attack: 0.002, filterFreq: 4600 },
    { freq: 2093.0, type: 'sine', duration: 0.16, delay: 0.045, volume: 0.025, attack: 0.002, filterFreq: 6000 },
  ] as const satisfies readonly SoundNote[],

  // Ascending Pentatonic Diamond Cascade (Gamification / Level Up / Awards)
  CELEBRATION: [
    { freq: 523.25, type: 'sine', duration: 0.14, delay: 0, volume: 0.05, attack: 0.002, filterFreq: 2800 },
    { freq: 659.25, type: 'sine', duration: 0.16, delay: 0.04, volume: 0.055, attack: 0.002, filterFreq: 3200 },
    { freq: 783.99, type: 'sine', duration: 0.18, delay: 0.08, volume: 0.065, attack: 0.002, filterFreq: 3600 },
    { freq: 1046.5, type: 'sine', duration: 0.24, delay: 0.12, volume: 0.075, attack: 0.002, filterFreq: 4200 },
    { freq: 1318.51, type: 'sine', duration: 0.32, delay: 0.16, volume: 0.08, attack: 0.002, filterFreq: 4800 },
    { freq: 1567.98, type: 'sine', duration: 0.52, delay: 0.2, volume: 0.085, attack: 0.002, filterFreq: 5600 },
  ] as const satisfies readonly SoundNote[],

  // Precious Gold & Metal Coin Resonance (Tuition payments, transactions)
  PAYMENT: [
    { freq: 2093.0, type: 'sine', duration: 0.24, delay: 0, volume: 0.065, attack: 0.001, filterFreq: 4500 },
    { freq: 2637.02, type: 'sine', duration: 0.36, delay: 0.035, volume: 0.075, attack: 0.002, filterFreq: 5200 },
    { freq: 3135.96, type: 'sine', duration: 0.2, delay: 0.055, volume: 0.03, attack: 0.002, filterFreq: 6500 },
  ] as const satisfies readonly SoundNote[],

  // Ceramic Precision Micro-Switch (Toggle controls & switches)
  SWITCH: [
    { freq: 2400, endFreq: 1350, type: 'sine', duration: 0.008, volume: 0.04, attack: 0.001, filterFreq: 3600 },
    { freq: 460, endFreq: 240, type: 'sine', duration: 0.012, volume: 0.03, attack: 0.001, filterFreq: 800 },
  ] as const satisfies readonly SoundNote[],

  // Aerodynamic Paper-Plane Swoop (Message or homework dispatched)
  SENT: [
    { freq: 650, endFreq: 1550, type: 'sine', duration: 0.075, volume: 0.04, attack: 0.01, filterFreq: 2600 },
  ] as const satisfies readonly SoundNote[],

  // Subdued Wooden Drawer / Soft Archival Disposal
  DELETE: [
    { freq: 190, endFreq: 95, type: 'sine', duration: 0.045, volume: 0.045, attack: 0.002, filterFreq: 350 },
  ] as const satisfies readonly SoundNote[],

  // Iconic Apple Face ID Match Chime (G#5 -> D#6 pure crystalline chime duo)
  FACE_ID_MATCH: [
    { freq: 830.61, type: 'sine', duration: 0.16, delay: 0, volume: 0.07, attack: 0.002, filterFreq: 3600 },
    { freq: 1244.51, type: 'sine', duration: 0.38, delay: 0.065, volume: 0.085, attack: 0.002, filterFreq: 4600 },
    { freq: 2489.02, type: 'sine', duration: 0.22, delay: 0.065, volume: 0.02, attack: 0.002, filterFreq: 6000 },
  ] as const satisfies readonly SoundNote[],

  // Biometric Refusal / Spoof Warning (Soft low-pass damping)
  FACE_ID_DENIED: [
    { freq: 196, endFreq: 140, type: 'sine', duration: 0.045, delay: 0, volume: 0.06, attack: 0.002, filterFreq: 380 },
    { freq: 164, endFreq: 115, type: 'sine', duration: 0.055, delay: 0.06, volume: 0.05, attack: 0.002, filterFreq: 340 },
  ] as const satisfies readonly SoundNote[],

  // Duplicate / Already Clocked In (Peaceful descending crystal duo: A5 -> E5)
  FACE_ID_DUPLICATE: [
    { freq: 880.0, type: 'sine', duration: 0.14, delay: 0, volume: 0.055, attack: 0.002, filterFreq: 3200 },
    { freq: 659.25, type: 'sine', duration: 0.24, delay: 0.06, volume: 0.055, attack: 0.002, filterFreq: 3000 },
  ] as const satisfies readonly SoundNote[],

  // Biometric Radar / Subtle Scanning Frame (Ultra-fine whisper micro-transient)
  LASER_SCAN: [
    {
      freq: 1400,
      endFreq: 950,
      type: 'sine',
      duration: 0.012,
      volume: 0.015,
      attack: 0.001,
      filterFreq: 2200,
      filterType: 'bandpass',
      filterQ: 2.5,
    },
  ] as const satisfies readonly SoundNote[],
};

// ============================================================================
// 5. REACT HOOK (Zero-Dependency Re-renders, Stable Callbacks)
// ============================================================================

export function usePremiumSound() {
  const isMuted = useSyncExternalStore(
    subscribeAcousticStore,
    getMuteSnapshot,
    getServerMuteSnapshot
  );

  const volume = useSyncExternalStore(
    subscribeAcousticStore,
    getVolumeSnapshot,
    getServerVolumeSnapshot
  );

  const hapticsEnabled = useSyncExternalStore(
    subscribeAcousticStore,
    getHapticsSnapshot,
    getServerHapticsSnapshot
  );

  // 1. Tactile Glass Click (Hardware micro-impulse + haptic)
  const playTick = useCallback(() => {
    if (isAudioMuted()) return;
    playTactileGlassClick();
  }, []);

  // 2. Fluid Capsule Pop
  const playPop = useCallback(() => {
    if (isAudioMuted()) return;
    triggerHaptic(12);
    synthesizeSequence(PRESETS.POP, 'pop');
  }, []);

  // 3. Diamond Confirmation Chime
  const playSuccess = useCallback(() => {
    if (isAudioMuted()) return;
    triggerHaptic([15, 40, 25]);
    synthesizeSequence(PRESETS.SUCCESS, 'success');
  }, []);

  // 4. Subdued Tactile Error
  const playError = useCallback(() => {
    if (isAudioMuted()) return;
    triggerHaptic([35, 30, 45]);
    synthesizeSequence(PRESETS.ERROR, 'error');
  }, []);

  // 5. Luxury Glass Notification Droplet
  const playNotification = useCallback(() => {
    if (isAudioMuted()) return;
    triggerHaptic([15, 25]);
    synthesizeSequence(PRESETS.NOTIFICATION, 'notification');
  }, []);

  // 6. Ascending Celebration Cascade (Awards, XP, Gamification)
  const playCelebration = useCallback(() => {
    if (isAudioMuted()) return;
    triggerHaptic([15, 35, 20, 35, 30]);
    synthesizeSequence(PRESETS.CELEBRATION, 'celebration');
  }, []);

  // 7. Mechanical Leica Shutter
  const playShutter = useCallback(() => {
    if (isAudioMuted()) return;
    playMechanicalShutterSound();
  }, []);

  // 8. Luxury Golden Coin Resonance
  const playPayment = useCallback(() => {
    if (isAudioMuted()) return;
    triggerHaptic([20, 35, 20, 35, 40]);
    synthesizeSequence(PRESETS.PAYMENT, 'payment');
  }, []);

  // 9. Ceramic Precision Switch
  const playSwitch = useCallback(() => {
    if (isAudioMuted()) return;
    triggerHaptic(8);
    synthesizeSequence(PRESETS.SWITCH, 'switch');
  }, []);

  // 10. Aerodynamic Sent Swoop
  const playSent = useCallback(() => {
    if (isAudioMuted()) return;
    triggerHaptic(14);
    synthesizeSequence(PRESETS.SENT, 'sent');
  }, []);

  // 11. Soft Archival Disposal
  const playDelete = useCallback(() => {
    if (isAudioMuted()) return;
    triggerHaptic(22);
    synthesizeSequence(PRESETS.DELETE, 'delete');
  }, []);

  // 12. Biometric Face ID Suite
  const playFaceIdMatch = useCallback(() => {
    if (isAudioMuted()) return;
    triggerHaptic([18, 50, 30]);
    synthesizeSequence(PRESETS.FACE_ID_MATCH, 'faceid_match');
  }, []);

  const playFaceIdDenied = useCallback(() => {
    if (isAudioMuted()) return;
    triggerHaptic([40, 30, 40]);
    synthesizeSequence(PRESETS.FACE_ID_DENIED, 'faceid_denied');
  }, []);

  const playFaceIdDuplicate = useCallback(() => {
    if (isAudioMuted()) return;
    triggerHaptic([15, 30, 15]);
    synthesizeSequence(PRESETS.FACE_ID_DUPLICATE, 'faceid_dup');
  }, []);

  const playLaserScan = useCallback(() => {
    if (isAudioMuted()) return;
    synthesizeSequence(PRESETS.LASER_SCAN, 'laser_scan');
  }, []);

  // Universal dispatcher
  const playPreset = useCallback(
    (preset: AcousticPreset) => {
      switch (preset) {
        case 'pop':
          playPop();
          break;
        case 'tick':
          playTick();
          break;
        case 'success':
          playSuccess();
          break;
        case 'error':
          playError();
          break;
        case 'notification':
          playNotification();
          break;
        case 'celebration':
          playCelebration();
          break;
        case 'shutter':
          playShutter();
          break;
        case 'payment':
          playPayment();
          break;
        case 'switch':
          playSwitch();
          break;
        case 'sent':
          playSent();
          break;
        case 'delete':
          playDelete();
          break;
        case 'faceid_match':
          playFaceIdMatch();
          break;
        case 'faceid_denied':
          playFaceIdDenied();
          break;
        case 'faceid_duplicate':
          playFaceIdDuplicate();
          break;
        case 'laser_scan':
          playLaserScan();
          break;
      }
    },
    [
      playPop,
      playTick,
      playSuccess,
      playError,
      playNotification,
      playCelebration,
      playShutter,
      playPayment,
      playSwitch,
      playSent,
      playDelete,
      playFaceIdMatch,
      playFaceIdDenied,
      playFaceIdDuplicate,
      playLaserScan,
    ]
  );

  const playCustomTone = useCallback(
    (freq: number, type: OscillatorType = 'sine', duration = 0.08, volume = 0.08) => {
      synthesizeSequence([{ freq, type, duration, volume, filterFreq: 2400 }]);
    },
    []
  );

  const toggleMute = useCallback(() => {
    setAudioMuted(!isAudioMuted());
  }, []);

  const toggleHaptics = useCallback(() => {
    setHapticsEnabled(!isHapticsEnabled());
  }, []);

  /** Safe universal play helper for any preset or named sound */
  const play = useCallback(
    (presetOrName?: string, _volume?: number) => {
      if (!presetOrName) return;
      try {
        switch (presetOrName) {
          case 'pop':
            playPop();
            break;
          case 'tick':
            playTick();
            break;
          case 'success':
            playSuccess();
            break;
          case 'error':
            playError();
            break;
          case 'notification':
            playNotification();
            break;
          case 'celebration':
          case 'victory':
            playCelebration();
            break;
          case 'shutter':
            playShutter();
            break;
          case 'payment':
            playPayment();
            break;
          case 'switch':
            playSwitch();
            break;
          case 'sent':
            playSent();
            break;
          case 'delete':
          case 'defeat':
            playDelete();
            break;
          case 'faceid_match':
            playFaceIdMatch();
            break;
          case 'faceid_denied':
            playFaceIdDenied();
            break;
          case 'faceid_duplicate':
            playFaceIdDuplicate();
            break;
          case 'laser_scan':
          case 'whoosh':
          case 'zap':
            playLaserScan();
            break;
          default:
            playTick();
            break;
        }
      } catch {
        // Safe acoustic fallback: never throw in interactive UI
      }
    },
    [
      playPop,
      playTick,
      playSuccess,
      playError,
      playNotification,
      playCelebration,
      playShutter,
      playPayment,
      playSwitch,
      playSent,
      playDelete,
      playFaceIdMatch,
      playFaceIdDenied,
      playFaceIdDuplicate,
      playLaserScan,
    ]
  );

  return {
    play,
    playSound: play,
    playPop,
    playSuccess,
    playError,
    playTick,
    playNotification,
    playCelebration,
    playShutter,
    playPayment,
    playSwitch,
    playSent,
    playDelete,
    playFaceIdMatch,
    playFaceIdDenied,
    playFaceIdDuplicate,
    playLaserScan,
    playPreset,
    playCustomTone,
    isMuted,
    volume,
    hapticsEnabled,
    toggleMute,
    toggleMuted: toggleMute,
    toggleHaptics,
    setMuted: setAudioMuted,
    setVolume: setAudioVolume,
    setHapticsEnabled,
  };
}
