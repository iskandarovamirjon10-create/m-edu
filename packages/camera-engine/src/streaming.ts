/**
 * Streaming primitives: BoundedFrameQueue, FrameSampler, CameraHealthTracker,
 * FfmpegStreamIngester.
 *
 * Reconstructed from camera worker usage evidence.
 */

import { spawn, ChildProcess } from 'node:child_process';
import type { VideoFrame } from './types';
import type { PerceptualHash } from './perceptual-hash';
import { FrozenFrameTracker } from './perceptual-hash';

// ============================================================================
// BoundedFrameQueue
// ============================================================================

export class BoundedFrameQueue {
  private readonly items: VideoFrame[] = [];
  private readonly capacity: number;

  constructor(capacity: number) {
    this.capacity = Math.max(1, Math.floor(capacity));
  }

  get size(): number {
    return this.items.length;
  }

  /** Push a frame; drops the oldest frame when full. Returns { dropped }. */
  push(frame: VideoFrame): { dropped: boolean } {
    let dropped = false;
    if (this.items.length >= this.capacity) {
      this.items.shift();
      dropped = true;
    }
    this.items.push(frame);
    return { dropped };
  }

  pop(): VideoFrame | null {
    return this.items.shift() ?? null;
  }

  clear(): void {
    this.items.length = 0;
  }
}

// ============================================================================
// FrameSampler
// ============================================================================

export class FrameSampler {
  private readonly intervalMs: number;
  private lastSampleAt = 0;
  private processing = false;

  constructor(fps: number) {
    this.intervalMs = Math.max(1000 / Math.max(0.5, fps), 33);
  }

  /** Whether this frame should be sampled (rate-limited). */
  shouldSample(_frame: VideoFrame): boolean {
    const now = Date.now();
    if (now - this.lastSampleAt >= this.intervalMs) {
      this.lastSampleAt = now;
      return true;
    }
    return false;
  }

  /** Acquire the processing lock; returns false if already processing. */
  acquireLock(): boolean {
    if (this.processing) return false;
    this.processing = true;
    return true;
  }

  releaseLock(): void {
    this.processing = false;
  }
}

// ============================================================================
// CameraHealthTracker
// ============================================================================

export type CameraHealthStatus = 'DISABLED' | 'CONNECTING' | 'ONLINE' | 'ERROR';

export interface CameraHealthSnapshot {
  cameraId: string;
  status: CameraHealthStatus;
  framesReceived: number;
  framesProcessed: number;
  framesDropped: number;
  errors: number;
  reconnectAttempts: number;
  lastErrorAt: number | null;
  lastErrorMessage: string | null;
  processingFps: number;
  startedAt: number;
  /**
   * True when the recent frame window is visually static
   * (likely the camera feed has stalled or the lens is covered).
   * Operators should treat a sustained `frozenFrame` as a
   * hardware/network problem, not a recognition problem.
   */
  frozenFrame: boolean;
  /** Number of consecutive "frozen" events acknowledged so far. */
  frozenFrameEvents: number;
  /** Wall-clock ms when the last freeze was first detected. */
  lastFrozenAt: number | null;
}

export class CameraHealthTracker {
  private status: CameraHealthStatus = 'DISABLED';
  private framesReceived = 0;
  private framesProcessed = 0;
  private framesDropped = 0;
  private errors = 0;
  private _reconnectAttempts = 0;
  private lastErrorAt: number | null = null;
  private lastErrorMessage: string | null = null;
  private readonly startedAt = Date.now();
  private readonly cameraId: string;
  private readonly processingFps: number;
  private readonly frozenTracker = new FrozenFrameTracker({
    windowSize: 30,
    similarityThreshold: 2,
  });
  private frozenFrameEvents = 0;
  private lastFrozenAt: number | null = null;

  constructor(cameraId: string, processingFps: number) {
    this.cameraId = cameraId;
    this.processingFps = processingFps;
  }

  setStatus(status: CameraHealthStatus): void {
    this.status = status;
  }

  recordFrameReceived(): void {
    this.framesReceived++;
  }

  recordFrameProcessed(): void {
    this.framesProcessed++;
  }

  recordFrameDropped(): void {
    this.framesDropped++;
  }

  /**
   * Record a non-stream error (e.g. a single frame failed processing).
   * Errors are tracked but must NOT consume the reconnect budget — only
   * actual stream/connection failures may count toward MAX_RECONNECT_ATTEMPTS.
   */
  recordError(err: Error | string): void {
    this.errors++;
    this.lastErrorAt = Date.now();
    this.lastErrorMessage = err instanceof Error ? err.message : String(err);
    this.status = 'ERROR';
  }

  /**
   * Record a stream/connection failure that should count toward the
   * reconnect-attempt budget and drive exponential backoff.
   */
  recordStreamFailure(err: Error | string): void {
    this.recordError(err);
    this._reconnectAttempts++;
  }

  /**
   * Reset the reconnect budget after a successful (re)connect so a camera
   * that has been healthy for a while gets a fresh set of attempts instead
   * of staying permanently near the ERROR cap.
   */
  resetReconnectAttempts(): void {
    this._reconnectAttempts = 0;
  }

  /** Exponential backoff: 5s → 10s → 20s → … capped at 60s. */
  getNextReconnectDelayMs(): number {
    const base = 5000;
    const capped = Math.min(base * 2 ** Math.min(this._reconnectAttempts - 1, 3), 60000);
    return capped;
  }

  get reconnectAttempts(): number {
    return this._reconnectAttempts;
  }

  observeFrameHash(hash: PerceptualHash): boolean {
    this.frozenTracker.observe(hash);
    const frozen = this.frozenTracker.isFrozen();
    if (frozen) {
      const now = Date.now();
      if (this.frozenTracker.acknowledgeFreeze(now)) {
        this.frozenFrameEvents++;
        this.lastFrozenAt = now;
      } else if (this.lastFrozenAt !== null && now - this.lastFrozenAt > 60_000) {
        this.frozenFrameEvents++;
        this.lastFrozenAt = now;
        this.frozenTracker.acknowledgeFreeze(now);
      }
    }
    return frozen;
  }

  getSnapshot(): CameraHealthSnapshot {
    return {
      cameraId: this.cameraId,
      status: this.status,
      framesReceived: this.framesReceived,
      framesProcessed: this.framesProcessed,
      framesDropped: this.framesDropped,
      errors: this.errors,
      reconnectAttempts: this._reconnectAttempts,
      lastErrorAt: this.lastErrorAt,
      lastErrorMessage: this.lastErrorMessage,
      processingFps: this.processingFps,
      startedAt: this.startedAt,
      frozenFrame: this.frozenTracker.isFrozen(),
      frozenFrameEvents: this.frozenFrameEvents,
      lastFrozenAt: this.lastFrozenAt,
    };
  }

  resetFrozenFrameTracker(): void {
    this.frozenTracker.reset();
    this.frozenFrameEvents = 0;
    this.lastFrozenAt = null;
  }
}

// ============================================================================
// FfmpegStreamIngester
// ============================================================================

export class FfmpegStreamIngester {
  private proc: ChildProcess | null = null;
  private frameBuffer: Buffer | null = null;
  private frameStart: number | null = null;
  private readonly cameraId: string;
  private readonly streamUri: string;
  private readonly fps: number;
  private readonly transport: 'tcp' | 'udp';
  private frameCb: ((frame: VideoFrame) => void) | null = null;
  private errorCb: ((err: Error) => void) | null = null;
  private closeCb: ((code: number | null) => void) | null = null;
  private stopping = false;

  constructor(config: { cameraId: string; streamUri: string; fps: number; transport?: 'tcp' | 'udp' }) {
    this.cameraId = config.cameraId;
    this.streamUri = config.streamUri;
    this.fps = config.fps;
    this.transport = config.transport ?? 'tcp';
  }

  /**
   * Check whether ffmpeg is available in the current environment PATH.
   */
  static async checkAvailability(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const proc = spawn('ffmpeg', ['-version'], { stdio: 'ignore', shell: false });
        proc.on('error', () => resolve(false));
        proc.on('close', (code) => resolve(code === 0));
      } catch {
        resolve(false);
      }
    });
  }

  onFrame(cb: (frame: VideoFrame) => void): void {
    this.frameCb = cb;
  }

  onError(cb: (err: Error) => void): void {
    this.errorCb = cb;
  }

  onClose(cb: (code: number | null) => void): void {
    this.closeCb = cb;
  }

  /**
   * Build the ffmpeg argument list for the stream.
   *
   * `-rtsp_transport` is an RTSP-demuxer-only option: passing it for any
   * other input (HTTP-MJPEG camera URLs, local files, test fixtures) makes
   * ffmpeg fail with "Option rtsp_transport not found" (exit 8). It is
   * therefore only applied to rtsp:// sources, which keeps RTSP-over-TCP/UDP
   * working while enabling MJPEG-over-HTTP cameras and local test streams.
   * Exposed as a static helper for deterministic unit testing.
   */
  static buildArgs(streamUri: string, fps: number, transport: 'tcp' | 'udp'): string[] {
    const args: string[] = [];
    if (streamUri.toLowerCase().startsWith('rtsp://')) {
      args.push(
        '-rtsp_transport', transport,
        // Hikvision RTSP optimization: reduces initial delay and prevents stream stalling
        '-analyzeduration', '5000000',
        '-probesize', '5000000'
      );
    }
    args.push(
      '-fflags', 'nobuffer', // Professional low-latency flag
      '-flags', 'low_delay', // Reduce delay for real-time streaming
      '-i', streamUri,
      '-an', // No audio
      '-f', 'image2pipe', // More robust than mjpeg for pipe extraction
      '-vcodec', 'mjpeg',
      '-q:v', '5', // Balance between quality and decoding speed
      '-r', String(Math.max(1, Math.min(30, Math.round(fps)))),
      'pipe:1',
    );
    return args;
  }

  async start(): Promise<void> {
    if (this.proc) return;
    this.stopping = false;
    this.frameBuffer = null;
    this.frameStart = null;

    const args = FfmpegStreamIngester.buildArgs(this.streamUri, this.fps, this.transport);

    this.proc = spawn('ffmpeg', args, { 
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false 
    });

    this.proc.stdout?.on('data', (chunk: Buffer) => this.handleData(chunk));
    this.proc.stderr?.on('data', () => {
      // ffmpeg logs are noisy; ignore unless we need diagnostics
    });
    this.proc.on('error', (err: any) => {
      if (err?.code === 'ENOENT') {
        this.emitError(new Error('ffmpeg executable not found in system PATH. Camera streaming requires ffmpeg.'));
      } else {
        this.emitError(err instanceof Error ? err : new Error(String(err)));
      }
    });
    this.proc.on('close', (code) => {
      const proc = this.proc;
      this.proc = null;
      if (this.stopping) return;
      if (code && code !== 0) {
        this.emitError(new Error(`ffmpeg exited with code ${code}`));
      }
      this.closeCb?.(code);
      void proc;
    });
  }

  async stop(): Promise<void> {
    this.stopping = true;
    if (this.proc) {
      const p = this.proc;
      this.proc = null;
      p.kill('SIGKILL');
    }
    this.frameBuffer = null;
    this.frameStart = null;
  }

  private handleData(chunk: Buffer): void {
    // Parse MJPEG frames from stdout (SOI 0xFFD8 ... EOI 0xFFD9)
    let offset = 0;
    const data = this.frameBuffer ? Buffer.concat([this.frameBuffer, chunk]) : chunk;
    this.frameBuffer = null;

    // Bound the in-flight frame buffer: an attacker (or a corrupted stream)
    // that never produces the EOI marker can otherwise make this buffer grow
    // without limit. 10 MB comfortably fits an uncompressed 4K JPEG and
    // catches pathological growth early.
    const MAX_FRAME_BUFFER = 10 * 1024 * 1024;
    if (data.length > MAX_FRAME_BUFFER) {
      this.frameBuffer = null;
      this.frameStart = null;
      this.emitError(new Error(
        `Frame buffer exceeded ${MAX_FRAME_BUFFER} bytes without an EOI marker; dropping partial frame.`,
      ));
      return;
    }

    while (offset < data.length) {
      if (this.frameStart === null) {
        const soi = data.indexOf(Buffer.from([0xff, 0xd8]), offset);
        if (soi === -1) return;
        this.frameStart = soi;
        offset = soi;
      }
      const eoi = data.indexOf(Buffer.from([0xff, 0xd9]), offset + 2);
      if (eoi === -1) {
        // Incomplete frame — keep remainder, but bound it.
        this.frameBuffer = data.slice(offset);
        return;
      }
      const frameEnd = eoi + 2;
      const frame = data.slice(this.frameStart, frameEnd);
      this.frameStart = null;
      offset = frameEnd;
      this.frameCb?.({ buffer: frame, timestamp: Date.now() });
    }
  }

  private emitError(err: Error): void {
    this.errorCb?.(err);
  }
}
