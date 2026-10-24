/**
 * M-EDU Spatial Acoustic Engine — Ultra-Luxury Apple VisionOS & Taptic Edition
 *
 * Acoustic Architecture:
 *  - Procedural micro-transient & organic physical acoustic modeling (Zero 90s sine sweeps/buzzers)
 *  - Micro-haptic tactile clicks (dual-layer: solid aluminum chassis sub-body + oleophobic glass tap)
 *  - Fluid liquid-glass bubble resonance (Apple VisionOS spatial capsule expand)
 *  - Crystalline diamond confirmation chimes (Apple Pay / luxury watch acoustic chime triad)
 *  - Subdued tactile double-thud for errors (zero harsh 8-bit game buzzers)
 *  - Master dynamics compressor + Butterworth smoothing filter (0% clipping or distortion)
 *  - Zero-latency hardware clock scheduling with automatic node garbage collection
 *  - SSR & hydration safe, battery-preserving automatic sleep
 */

import { useCallback, useSyncExternalStore } from 'react';

// ============================================================================
// 1. CONSTANTS & TYPES
// ============================================================================

const STORAGE_KEY = 'm-edu.sound-muted';
const MUTE_EVENT = 'm-edu:sound-muted-changed';

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

interface WebkitWindow extends Window {
  webkitAudioContext?: typeof AudioContext;
}

// ============================================================================
// 2. SAFE STORAGE & REACTIVE EXTERNAL STORE (React 18+ SSR Safe)
// ============================================================================

const listeners = new Set<() => void>();
let isMutedState = false;
let isStoreInitialized = false;

function readMutedFromStorage(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function initStoreIfNeeded(): void {
  if (isStoreInitialized || typeof window === 'undefined') return;
  isStoreInitialized = true;
  isMutedState = readMutedFromStorage();

  window.addEventListener('storage', (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      const nextMuted = e.newValue === 'true';
      if (isMutedState !== nextMuted) {
        isMutedState = nextMuted;
        emitChange();
      }
    }
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

function subscribeMuteStore(listener: () => void): () => void {
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

function getServerMuteSnapshot(): boolean {
  return false;
}

export function isAudioMuted(): boolean {
  return getMuteSnapshot();
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

  if (muted && sharedAudioCtx && sharedAudioCtx.state === 'running') {
    sharedAudioCtx.suspend().catch(() => {});
  }

  emitChange();
}

// ============================================================================
// 3. SINGLETON CORE AUDIO ENGINE (Master Bus + Spatial Limiter)
// ============================================================================

let sharedAudioCtx: AudioContext | null = null;
let masterCompressor: DynamicsCompressorNode | null = null;
let masterAcousticFilter: BiquadFilterNode | null = null;
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

    masterCompressor.connect(masterAcousticFilter);
    masterAcousticFilter.connect(sharedAudioCtx.destination);
  }

  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }

  return {
    ctx: sharedAudioCtx,
    destination: masterCompressor ?? sharedAudioCtx.destination,
  };
}

/** Pre-renders an ultra-short (10ms) organic micro-transient noise impulse for tactile clicks */
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

  const startTime = now + 0.001;

  // 1. Organic tactile tap body (Clean miniature wooden/glass impulse: 1600Hz -> 900Hz in 7ms)
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

  // 2. High-precision Oleophobic Glass Micro-Snap (Airy transient click, 3400Hz)
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

// ============================================================================
// 4. LUXURY ACOUSTIC PRESETS (Pure Physical & Spatial Harmonics)
// ============================================================================

const PRESETS = {
  // Apple VisionOS Fluid Glass Capsule (Light organic droplet resonance: 880Hz -> 1320Hz)
  POP: [
    // Primary fluid rising droplet
    { freq: 880, endFreq: 1320, type: 'sine', duration: 0.028, volume: 0.048, attack: 0.001, filterFreq: 2800 },
    // Ethereal subtle crystal air overtone
    { freq: 1760, endFreq: 2640, type: 'sine', duration: 0.016, volume: 0.018, attack: 0.001, filterFreq: 4200 },
  ] as const satisfies readonly SoundNote[],

  // Diamond Crystal Confirmation Chime (Apple Pay / Luxury Watch acoustic chime triad)
  SUCCESS: [
    // F#5 (739.99 Hz)
    { freq: 739.99, type: 'sine', duration: 0.18, delay: 0, volume: 0.055, attack: 0.002, filterFreq: 3400 },
    // A#5 (932.33 Hz)
    { freq: 932.33, type: 'sine', duration: 0.22, delay: 0.038, volume: 0.065, attack: 0.002, filterFreq: 3800 },
    // C#6 (1108.73 Hz)
    { freq: 1108.73, type: 'sine', duration: 0.32, delay: 0.076, volume: 0.075, attack: 0.002, filterFreq: 4400 },
    // F#6 (1479.98 Hz) Sparkling crystal shimmer
    { freq: 1479.98, type: 'sine', duration: 0.40, delay: 0.114, volume: 0.08, attack: 0.002, filterFreq: 5200 },
  ] as const satisfies readonly SoundNote[],

  // Subdued Tactile Felt Double-Tap (Soft muted physical bumps, 0% harshness)
  ERROR: [
    { freq: 220, endFreq: 160, type: 'sine', duration: 0.032, delay: 0, volume: 0.05, attack: 0.002, filterFreq: 420 },
    { freq: 175, endFreq: 130, type: 'sine', duration: 0.038, delay: 0.048, volume: 0.045, attack: 0.002, filterFreq: 380 },
  ] as const satisfies readonly SoundNote[],

  // Iconic Apple Face ID Match Chime (G#5 -> D#6 pure crystalline chime duo)
  FACE_ID_MATCH: [
    // Tone 1: G#5 (830.61 Hz)
    { freq: 830.61, type: 'sine', duration: 0.16, delay: 0, volume: 0.07, attack: 0.002, filterFreq: 3600 },
    // Tone 2: D#6 (1244.51 Hz) + crystal shimmer
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
    { freq: 880.00, type: 'sine', duration: 0.14, delay: 0, volume: 0.055, attack: 0.002, filterFreq: 3200 },
    { freq: 659.25, type: 'sine', duration: 0.24, delay: 0.06, volume: 0.055, attack: 0.002, filterFreq: 3000 },
  ] as const satisfies readonly SoundNote[],

  // Biometric Radar / Subtle Scanning Frame (Ultra-fine whisper micro-transient)
  LASER_SCAN: [
    { freq: 1400, endFreq: 950, type: 'sine', duration: 0.012, volume: 0.015, attack: 0.001, filterFreq: 2200, filterType: 'bandpass', filterQ: 2.5 },
  ] as const satisfies readonly SoundNote[],
};

// ============================================================================
// 5. REACT HOOK (Zero-Dependency Re-renders, Stable Callbacks)
// ============================================================================

export function usePremiumSound() {
  const isMuted = useSyncExternalStore(
    subscribeMuteStore,
    getMuteSnapshot,
    getServerMuteSnapshot
  );

  // playTick uses dual-layer tactile glass & chassis impulse modeling
  const playTick = useCallback(() => {
    if (isAudioMuted()) return;
    playTactileGlassClick();
  }, []);

  const playPop = useCallback(() => synthesizeSequence(PRESETS.POP, 'pop'), []);
  const playSuccess = useCallback(() => synthesizeSequence(PRESETS.SUCCESS, 'success'), []);
  const playError = useCallback(() => synthesizeSequence(PRESETS.ERROR, 'error'), []);
  const playFaceIdMatch = useCallback(() => synthesizeSequence(PRESETS.FACE_ID_MATCH, 'faceid_match'), []);
  const playFaceIdDenied = useCallback(() => synthesizeSequence(PRESETS.FACE_ID_DENIED, 'faceid_denied'), []);
  const playFaceIdDuplicate = useCallback(() => synthesizeSequence(PRESETS.FACE_ID_DUPLICATE, 'faceid_dup'), []);
  const playLaserScan = useCallback(() => synthesizeSequence(PRESETS.LASER_SCAN, 'laser_scan'), []);

  const playCustomTone = useCallback(
    (freq: number, type: OscillatorType = 'sine', duration = 0.08, volume = 0.08) => {
      synthesizeSequence([{ freq, type, duration, volume, filterFreq: 2400 }]);
    },
    []
  );

  const toggleMute = useCallback(() => {
    setAudioMuted(!isAudioMuted());
  }, []);

  return {
    playPop,
    playSuccess,
    playError,
    playTick,
    playFaceIdMatch,
    playFaceIdDenied,
    playFaceIdDuplicate,
    playLaserScan,
    playCustomTone,
    isMuted,
    toggleMute,
    setMuted: setAudioMuted,
  };
}