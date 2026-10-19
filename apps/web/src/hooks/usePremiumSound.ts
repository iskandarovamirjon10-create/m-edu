import { useCallback, useSyncExternalStore } from 'react';

// ============================================================================
// 1. CONSTANTS & TYPES
// ============================================================================

const STORAGE_KEY = 'm-edu.sound-muted';
const MUTE_EVENT = 'm-edu:sound-muted-changed';

type SoundNote = {
  /** Boshlang'ich chastota (Hz) */
  freq: number;
  /** Tugash chastotasi (Hz) - Apple-style pitch bend/glide uchun (ixtiyoriy) */
  endFreq?: number;
  /** To'lqin shakli */
  type: OscillatorType;
  /** Davomiyligi (soniya) */
  duration: number;
  /** Boshlanish kechikishi - ctx.currentTime ga nisbatan (soniya) */
  delay?: number;
  /** Maksimal balandlik (0.0 - 1.0) */
  volume?: number;
  /** Hujum (Attack) vaqti - click chiqmasligi uchun (soniya) */
  attack?: number;
  /** Quloqqa yoqimli qilish uchun Low-Pass Filter chegarasi (Hz) */
  filterFreq?: number;
};

// WebKit (Safari) uchun qat'iy tiplashtirilgan Window interfeysi (`any` siz)
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
    // Private browsing yoki bloklangan localStorage xatosini yutib yuborish
    return false;
  }
}

function initStoreIfNeeded(): void {
  if (isStoreInitialized || typeof window === 'undefined') return;
  isStoreInitialized = true;
  isMutedState = readMutedFromStorage();

  // Boshqa tablarda ovoz o'chirilsa, joriy tabni ham sinxronlash
  window.addEventListener('storage', (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      const nextMuted = e.newValue === 'true';
      if (isMutedState !== nextMuted) {
        isMutedState = nextMuted;
        emitChange();
      }
    }
  });
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
  return false; // SSR Hydration xatosini 100% oldini oladi
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
      // Ignore storage quota / security errors
    }
    window.dispatchEvent(new CustomEvent<boolean>(MUTE_EVENT, { detail: muted }));
  }

  // Agar ovoz o'chirilsa, audio protsessorni uxlatib CPU/Batareyani tejaymiz
  if (muted && sharedAudioCtx && sharedAudioCtx.state === 'running') {
    sharedAudioCtx.suspend().catch(() => {});
  }

  emitChange();
}

// ============================================================================
// 3. SINGLETON CORE AUDIO ENGINE (Master Bus + Dynamics Compressor)
// ============================================================================

let sharedAudioCtx: AudioContext | null = null;
let masterCompressor: DynamicsCompressorNode | null = null;

function getAudioEngine(): { ctx: AudioContext; destination: AudioNode } | null {
  if (typeof window === 'undefined' || isAudioMuted()) return null;

  if (!sharedAudioCtx) {
    const AudioCtx = window.AudioContext || (window as WebkitWindow).webkitAudioContext;
    if (!AudioCtx) return null;

    sharedAudioCtx = new AudioCtx({ latencyHint: 'interactive' });

    // Apple-style Master Dynamics Compressor:
    // Bir nechta ovoz ustma-ust tushganda (clipping/distortion) xirillashni oldini oladi
    masterCompressor = sharedAudioCtx.createDynamicsCompressor();
    masterCompressor.threshold.setValueAtTime(-12, sharedAudioCtx.currentTime);
    masterCompressor.knee.setValueAtTime(30, sharedAudioCtx.currentTime);
    masterCompressor.ratio.setValueAtTime(8, sharedAudioCtx.currentTime);
    masterCompressor.attack.setValueAtTime(0.003, sharedAudioCtx.currentTime);
    masterCompressor.release.setValueAtTime(0.15, sharedAudioCtx.currentTime);
    masterCompressor.connect(sharedAudioCtx.destination);
  }

  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }

  return {
    ctx: sharedAudioCtx,
    destination: masterCompressor ?? sharedAudioCtx.destination,
  };
}

/**
 * Hardware-clock scheduled synthesizer.
 * `setTimeout` ishlatmaydi, xotirani avtomatik tozalaydi va click/pop artefaktlarini yo'qotadi.
 */
function synthesizeSequence(notes: readonly SoundNote[]): void {
  const engine = getAudioEngine();
  if (!engine) return;

  const { ctx, destination } = engine;
  // Audio kartadan 5ms keyingi aniq vaqtni olamiz (Scheduling lookahead)
  const baseTime = ctx.currentTime + 0.005;

  for (const note of notes) {
    const startTime = baseTime + (note.delay ?? 0);
    const duration = Math.max(0.015, note.duration);
    const stopTime = startTime + duration;
    const peakVolume = Math.max(0.001, Math.min(1.0, note.volume ?? 0.12));
    const attackTime = Math.min( duration * 0.3, note.attack ?? 0.006);

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    let filterNode: BiquadFilterNode | null = null;

    osc.type = note.type;
    osc.frequency.setValueAtTime(note.freq, startTime);

    // Apple UI kabi silliq chastota sirpanishi (Pitch Glide)
    if (note.endFreq && note.endFreq > 0) {
      osc.frequency.exponentialRampToValueAtTime(note.endFreq, stopTime);
    }

    // Qattiq to'lqinlarni (triangle/sawtooth) yumshatish uchun Low-Pass Filter
    if (note.filterFreq) {
      filterNode = ctx.createBiquadFilter();
      filterNode.type = 'lowpass';
      filterNode.frequency.setValueAtTime(note.filterFreq, startTime);
      filterNode.Q.setValueAtTime(0.707, startTime); // Butterworth flat response
    }

    // ADSR Envelope: Click chiqmasligi uchun 0.0001 dan boshlab silliq ko'taramiz
    gainNode.gain.setValueAtTime(0.0001, startTime);
    gainNode.gain.linearRampToValueAtTime(peakVolume, startTime + attackTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, stopTime);

    // Audio Graph ulanishi
    if (filterNode) {
      osc.connect(filterNode);
      filterNode.connect(gainNode);
    } else {
      osc.connect(gainNode);
    }
    gainNode.connect(destination);

    osc.start(startTime);
    osc.stop(stopTime + 0.01);

    // MEMORY LEAK PREVENTION: Ovoz tugashi bilan barcha tugunlarni xotiradan uzamiz
    osc.onended = () => {
      try {
        osc.disconnect();
        if (filterNode) filterNode.disconnect();
        gainNode.disconnect();
      } catch {
        // Ignore already disconnected nodes
      }
    };
  }
}

// ============================================================================
// 4. APPLE HIG ACOUSTIC PRESETS (Pre-allocated Readonly Arrays)
// ============================================================================

const PRESETS = {
  // iOS Taptic Engine uslubidagi yumshoq "Pop" (280Hz -> 440Hz pitch lift)
  POP: [
    { freq: 280, endFreq: 440, type: 'sine', duration: 0.075, volume: 0.16, attack: 0.004 },
  ] as const satisfies readonly SoundNote[],

  // Muvaffaqiyat: Toza Major beshinchi interval (C5 -> G5) + yengil oberton
  SUCCESS: [
    { freq: 523.25, type: 'sine', duration: 0.14, delay: 0, volume: 0.12 },
    { freq: 783.99, type: 'sine', duration: 0.32, delay: 0.085, volume: 0.14 },
    { freq: 1567.98, type: 'triangle', duration: 0.25, delay: 0.085, volume: 0.03, filterFreq: 2500 },
  ] as const satisfies readonly SoundNote[],

  // Xatolik: Yumshatilgan pastki ikki urilish (Low-pass filtered triangle)
  ERROR: [
    { freq: 260, endFreq: 220, type: 'triangle', duration: 0.14, delay: 0, volume: 0.2, filterFreq: 800 },
    { freq: 200, endFreq: 150, type: 'triangle', duration: 0.24, delay: 0.12, volume: 0.22, filterFreq: 650 },
  ] as const satisfies readonly SoundNote[],

  // iOS Picker / Scroll wheel mikro-tikillashi
  TICK: [
    { freq: 1100, endFreq: 750, type: 'sine', duration: 0.025, volume: 0.07, attack: 0.002 },
  ] as const satisfies readonly SoundNote[],

  // Haqiqiy Apple Face ID / Apple Pay Match Chime (G5 -> C6) + Kristall harmonika
  FACE_ID_MATCH: [
    { freq: 783.99, type: 'sine', duration: 0.16, delay: 0, volume: 0.14 },
    { freq: 1567.98, type: 'sine', duration: 0.12, delay: 0, volume: 0.035 }, // Oktava obertoni
    { freq: 1046.5, type: 'sine', duration: 0.38, delay: 0.09, volume: 0.16 },
    { freq: 2093.0, type: 'sine', duration: 0.28, delay: 0.09, volume: 0.04 }, // Yuqori shisha jarangdorligi
  ] as const satisfies readonly SoundNote[],

  // Biometrik rad etish / Spoof ogohlantirishi (Filtrlangan jiddiy ohang)
  FACE_ID_DENIED: [
    { freq: 220, endFreq: 196, type: 'sawtooth', duration: 0.13, delay: 0, volume: 0.14, filterFreq: 950 },
    { freq: 164.81, endFreq: 130.81, type: 'sawtooth', duration: 0.26, delay: 0.11, volume: 0.16, filterFreq: 750 },
  ] as const satisfies readonly SoundNote[],

  // Takroriy davomat (Duplicate): Muloyim, xotirjam ikki notali tasdiq (C5 -> E5)
  FACE_ID_DUPLICATE: [
    { freq: 523.25, type: 'sine', duration: 0.12, delay: 0, volume: 0.1 },
    { freq: 659.25, type: 'sine', duration: 0.22, delay: 0.08, volume: 0.1 },
  ] as const satisfies readonly SoundNote[],

  // Biometrik radar kadr skaneri: Yuqori texnologiyali chastota sirpanishi
  LASER_SCAN: [
    { freq: 1350, endFreq: 950, type: 'sine', duration: 0.028, volume: 0.045, attack: 0.002 },
  ] as const satisfies readonly SoundNote[],
};

// ============================================================================
// 5. REACT HOOK (Zero-Dependency Re-renders, Stable Callbacks)
// ============================================================================

/**
 * Apple HIG darajasidagi Web Audio sintezatori.
 * Hech qanday mp3/wav fayllarsiz toza matematik sintez orqali UI ovozlarini yaratadi.
 */
export function usePremiumSound() {
  const isMuted = useSyncExternalStore(
    subscribeMuteStore,
    getMuteSnapshot,
    getServerMuteSnapshot
  );

  const playPop = useCallback(() => synthesizeSequence(PRESETS.POP), []);
  const playSuccess = useCallback(() => synthesizeSequence(PRESETS.SUCCESS), []);
  const playError = useCallback(() => synthesizeSequence(PRESETS.ERROR), []);
  const playTick = useCallback(() => synthesizeSequence(PRESETS.TICK), []);
  const playFaceIdMatch = useCallback(() => synthesizeSequence(PRESETS.FACE_ID_MATCH), []);
  const playFaceIdDenied = useCallback(() => synthesizeSequence(PRESETS.FACE_ID_DENIED), []);
  const playFaceIdDuplicate = useCallback(() => synthesizeSequence(PRESETS.FACE_ID_DUPLICATE), []);
  const playLaserScan = useCallback(() => synthesizeSequence(PRESETS.LASER_SCAN), []);

  /** Maxsus chastotali ovoz chiqarish kerak bo'lganda foydalanish uchun */
  const playCustomTone = useCallback(
    (freq: number, type: OscillatorType = 'sine', duration = 0.1, volume = 0.1) => {
      synthesizeSequence([{ freq, type, duration, volume }]);
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