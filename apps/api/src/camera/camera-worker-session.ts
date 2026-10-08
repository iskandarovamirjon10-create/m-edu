import {
  EventEmitter,
} from 'node:events';

import {
  FaceEmbedding,
  type EncryptionPort,
  type FaceEngine,
} from '@medu/core';

import {
  BoundedFrameQueue,
  CameraHealthTracker,
  FfmpegStreamIngester,
  FrameSampler,
  perceptualHashSync,
} from '@medu/camera-engine';

import type { VideoFrame } from '@medu/camera-engine';
import { SecureLogger } from '@medu/face-security';

import { getErrorMessage } from '../lib/error';
import type { PrismaService } from '../prisma/prisma.service';
import type { AttendanceDecisionEngine } from './attendance-decision.engine';
import {
  DEFAULT_AMBIGUITY_MARGIN,
  DEFAULT_SIMILARITY_THRESHOLD,
  MIN_QUALITY_SCORE,
} from './camera-thresholds';

export interface CameraWorkerConfig {
  cameraId: string;
  organizationId: string;
  name: string;
  streamUri: string;

  processingFps: number;

  rtspTransport: 'tcp' | 'udp';

  location: string | null;

  recognitionEnabled: boolean;
  attendanceEnabled: boolean;

  similarityThreshold: number;
  minAmbiguityMargin?: number;
}

interface EnrolledTemplate {
  id: string;
  studentId: string;
  embedding: FaceEmbedding;
}

type WorkerLifecycleState =
  | 'IDLE'
  | 'CONNECTING'
  | 'ONLINE'
  | 'DEGRADED'
  | 'STOPPING'
  | 'DISABLED'
  | 'ERROR';

const TEMPLATE_CACHE_TTL_MS = 30_000;

const FRAME_QUEUE_SIZE = 2;

const DEFAULT_PROCESSING_FPS = 3;

// MIN_QUALITY_SCORE / DEFAULT_SIMILARITY_THRESHOLD / DEFAULT_AMBIGUITY_MARGIN
// come from ./camera-thresholds — the single, env-tunable source of truth
// shared with CameraWorkerManagerService.

/**
 * Maximum age of a queued frame before it is discarded.
 *
 * FFmpeg can buffer during network stalls; recognizing a minutes-old frame
 * would record attendance for an event that is no longer happening.
 */
const MAX_FRAME_AGE_MS = 10_000;

// Maximum reconnection attempts before the worker transitions to ERROR state
// and stops trying. Without this, a persistently failing camera (or an
// attacker blocking a camera's IP) causes infinite reconnect loops, each
// spawning a new FFmpeg process — exhausting file descriptors and process
// slots across the API server.
const MAX_RECONNECT_ATTEMPTS = 10;

/**
 * Maximum faces to process per video frame.
 * Sequential ONNX inference session processes each face one-by-one.
 * 10 is a safe upper bound that prevents runaway CPU in crowded scenes.
 */
const MAX_FACES_PER_FRAME = 10;

/**
 * Per-frame processing deadline in milliseconds.
 * A frame that takes longer than this is abandoned to protect throughput.
 * This prevents a single "hard" frame (e.g., heavy occlusion, extreme
 * lighting) from stalling the recognition pipeline and causing frame drops.
 * Chosen to exceed one full pipeline cycle for 10 faces (~2.5s at 250ms/face)
 * with comfortable headroom.
 */
const MAX_PROCESSING_TIME_MS = 5_000;

/**
 * Deduplication threshold across faces in the same frame.
 * If two different faces of the same student score within this range,
 * the higher-confidence one wins. Prevents the same student from getting
 * multiple attendance events from a single frame.
 */
const FACE_SIMILARITY_DEDUP_THRESHOLD = 0.95;

export class CameraWorkerSession extends EventEmitter {
  private readonly logger = new SecureLogger('info');

  private readonly cameraId: string;
  private readonly organizationId: string;
  private readonly config: CameraWorkerConfig;

  private readonly faceEngine: FaceEngine;
  private readonly attendanceEngine: AttendanceDecisionEngine;

  private readonly prisma: Pick<
    PrismaService,
    'faceTemplate'
  >;

  private readonly encryption: EncryptionPort;

  private readonly queue: BoundedFrameQueue;

  private readonly sampler: FrameSampler;

  private readonly healthTracker: CameraHealthTracker;

  private ingester: FfmpegStreamIngester | null = null;

  private lifecycleState: WorkerLifecycleState = 'IDLE';

  private reconnectTimer: NodeJS.Timeout | null = null;

  private reconnectInProgress = false;

  /**
   * True once the current stream failure has been recorded.
   *
   * FfmpegStreamIngester emits BOTH `error` (non-zero exit) and `close` for
   * the same death — without this guard each crash double-counted against
   * the reconnect budget and emitted duplicate offline alerts.
   */
  private streamFailureRecorded = false;

  private frameProcessing = false;

  private activeTemplatesCache:
    | EnrolledTemplate[]
    | null = null;

  private lastTemplateCacheUpdate = 0;

  private readonly activeRecognitions = new Map<string, number>();

  private stopped = false;

  constructor(
    config: CameraWorkerConfig,
    faceEngine: FaceEngine,
    attendanceEngine: AttendanceDecisionEngine,
    prisma: Pick<PrismaService, 'faceTemplate'>,
    encryption: EncryptionPort,
  ) {
    super();

    this.cameraId = config.cameraId;
    this.organizationId = config.organizationId;
    this.config = {
      ...config,
      processingFps: this.normalizeFps(
        config.processingFps,
      ),
      similarityThreshold:
        this.normalizeSimilarityThreshold(
          config.similarityThreshold,
        ),
    };

    this.faceEngine = faceEngine;
    this.attendanceEngine = attendanceEngine;
    this.prisma = prisma;
    this.encryption = encryption;

    this.queue =
      new BoundedFrameQueue(
        FRAME_QUEUE_SIZE,
      );

    this.sampler =
      new FrameSampler(
        this.config.processingFps,
      );

    this.healthTracker =
      new CameraHealthTracker(
        this.cameraId,
        this.config.processingFps,
      );

    // Default 'error' listener: Node throws if EventEmitter.emit('error')
    // has no listeners. The manager wires additional handlers later, but a
    // constructor-time default prevents an unhandled error event from
    // crashing the process if the session emits before listeners attach.
    this.on('error', (err: unknown) => {
      this.logger.error(
        'Camera worker error event',
        {
          cameraId: this.cameraId,
          organizationId: this.organizationId,
          error: getErrorMessage(err),
        },
      );
    });
  }

  // ============================================================
  // PUBLIC LIFECYCLE
  // ============================================================

  private _isStarting = false;

  async start(): Promise<void> {
    if (this._isStarting) return;
    this._isStarting = true;
    try {
      if (
        this.lifecycleState === 'ONLINE' ||
        this.lifecycleState === 'CONNECTING'
      ) {
        return;
      }

      if (
        this.lifecycleState === 'STOPPING'
      ) {
        throw new Error(
          'Camera worker is currently stopping',
        );
      }

      this.stopped = false;

      this.lifecycleState = 'CONNECTING';

      this.healthTracker.setStatus(
        'CONNECTING',
      );

      await this.connect();
    } finally {
      this._isStarting = false;
    }
  }

  async stop(): Promise<void> {
    if (
      this.lifecycleState ===
      'DISABLED'
    ) {
      return;
    }

    this.stopped = true;

    this.lifecycleState = 'STOPPING';

    this.clearReconnectTimer();

    this.queue.clear();

    this.activeTemplatesCache = null;

    this.lastTemplateCacheUpdate = 0;

    try {
      await this.stopIngester();
    } finally {
      this.frameProcessing = false;
      this.lifecycleState = 'DISABLED';

      this.healthTracker.setStatus(
        'DISABLED',
      );
    }
  }

  getHealth() {
    return this.healthTracker.getSnapshot();
  }

  getState(): WorkerLifecycleState {
    return this.lifecycleState;
  }

  // ============================================================
  // STREAM CONNECTION
  // ============================================================

  private async connect(): Promise<void> {
    if (this.stopped) {
      return;
    }

    if (this.reconnectInProgress) {
      return;
    }

    this.reconnectInProgress = true;

    // Hoisted so the failure path can still tear down the process it spawned.
    let ingester: FfmpegStreamIngester | null = null;

    try {
      await this.stopIngester();

      if (this.stopped) {
        return;
      }

      this.lifecycleState = 'CONNECTING';

      this.healthTracker.setStatus(
        'CONNECTING',
      );

      ingester =
        new FfmpegStreamIngester({
          cameraId: this.cameraId,

          streamUri:
            this.config.streamUri,

          fps:
            this.config.processingFps,

          transport:
            this.config.rtspTransport,
        });

      this.ingester = ingester;

      ingester.onFrame(
        (frame) => {
          this.handleIncomingFrame(
            frame,
          );
        },
      );

      ingester.onError(
        (error) => {
          this.handleStreamError(
            error,
          );
        },
      );

      ingester.onClose(
        (code) => {
          this.handleStreamClose(
            code,
          );
        },
      );

      await ingester.start();

      if (this.stopped) {
        /*
         * A concurrent `stop()` (the 30s start-timeout cleanup path) already
         * ran and nulled `this.ingester`, so stopping *that* reference is a
         * no-op — while THIS ingester may just have spawned a live FFmpeg that
         * nobody owns any more. Always tear down the instance we created.
         */
        await this.stopIngester(ingester);
        return;
      }

      this.lifecycleState = 'ONLINE';

      this.healthTracker.setStatus(
        'ONLINE',
      );

      // Healthy again: clear the per-episode failure guard and give the
      // worker a fresh reconnect budget (P1: attempts never reset before).
      this.streamFailureRecorded = false;
      this.healthTracker.resetReconnectAttempts();

      // FIX-4: emit recovered event (clear alert debounce)
      this.emit('camera-recovered', {
        cameraId: this.cameraId,
        organizationId: this.organizationId,
        timestamp: Date.now(),
      });

      // New stream — reset the frozen-frame baseline.
      this.healthTracker.resetFrozenFrameTracker();

      this.logger.info(
        'Camera stream connected',
        {
          cameraId: this.cameraId,
          organizationId:
            this.organizationId,
        },
      );
    } catch (err: unknown) {
      if (this.stopped) {
        if (ingester) await this.stopIngester(ingester);
        return;
      }

      this.lifecycleState = 'ERROR';

      this.healthTracker.recordStreamFailure(
        getErrorMessage(err),
      );

      this.logger.error(
        'Camera stream connection failed',
        {
          cameraId: this.cameraId,
          organizationId:
            this.organizationId,
          error: getErrorMessage(err),
        },
      );

      this.scheduleReconnect();
    } finally {
      this.reconnectInProgress = false;
    }
  }

  private async stopIngester(
    target?: FfmpegStreamIngester,
  ): Promise<void> {
    const current = target ?? this.ingester;

    if (current === this.ingester) {
      this.ingester = null;
    }

    if (!current) {
      return;
    }

    try {
      await current.stop();
    } catch (err: unknown) {
      this.logger.warn(
        'Camera stream ingester stop failed',
        {
          cameraId: this.cameraId,
          error: getErrorMessage(err),
        },
      );
    }
  }

  // ============================================================
  // FRAME INGESTION
  // ============================================================

  private handleIncomingFrame(
    frame: VideoFrame,
  ): void {
    if (this.stopped) {
      return;
    }

    this.healthTracker.recordFrameReceived();

    if (
      !this.sampler.shouldSample(frame)
    ) {
      return;
    }

    // Frozen-frame detection: hash this sampled frame so that
    // identical stalled frames accumulate in the FrozenFrameTracker
    // window. We hash only the frames that already passed the
    // sampler to avoid double work and to keep the cost aligned
    // with the recognition cadence.
    try {
      // handleIncomingFrame is synchronous: use the sync hash (async
      // perceptualHash returns a Promise, which was being passed to the
      // tracker as if it were a bigint — typecheck TS2345 / latent bug).
      const hash = perceptualHashSync(frame.buffer);
      const isFrozen = this.healthTracker.observeFrameHash(hash);
      if (isFrozen) {
        this.logger.warn('Frozen frame detected', {
          cameraId: this.cameraId,
          organizationId: this.organizationId,
        });
      }
    } catch (e: unknown) {
      // pHash can throw on extreme corruption; treat as a
      // health event but do not crash the worker pipeline.
      this.logger.warn('Perceptual hash failed', {
        cameraId: this.cameraId,
        error: String(e),
      });
    }

    const { dropped } =
      this.queue.push(frame);

    if (dropped) {
      this.healthTracker.recordFrameDropped();
    }

    void this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.stopped) {
      return;
    }

    /**
     * Only one recognition pipeline is allowed
     * to execute at a time.
     *
     * This protects the ONNX engine and prevents
     * multiple frames from performing simultaneous
     * expensive embedding comparisons.
     */
    if (this.frameProcessing) {
      return;
    }

    const frame =
      this.queue.pop();

    if (!frame) {
      return;
    }

    // P1: drop stale frames — a frame that sat in the queue through a
    // network stall must not produce attendance for a past moment.
    const frameAgeMs = Date.now() - frame.timestamp;
    if (frameAgeMs > MAX_FRAME_AGE_MS) {
      this.healthTracker.recordFrameDropped();
      this.logger.warn('Stale frame discarded', {
        cameraId: this.cameraId,
        organizationId: this.organizationId,
        ageMs: frameAgeMs,
      });
      if (this.queue.size > 0) {
        setImmediate(() => {
          void this.processQueue();
        });
      }
      return;
    }

    this.frameProcessing = true;

    try {
      await this.processFrame(
        frame,
      );

      this.healthTracker.recordFrameProcessed();
    } catch (err: unknown) {
      this.healthTracker.recordError(
        getErrorMessage(err),
      );

      this.lifecycleState =
        this.lifecycleState === 'ONLINE'
          ? 'DEGRADED'
          : this.lifecycleState;

      this.logger.error(
        'Camera frame processing failed',
        {
          cameraId: this.cameraId,
          organizationId:
            this.organizationId,
          error: getErrorMessage(err),
        },
      );
    } finally {
      this.frameProcessing = false;

      if (
        !this.stopped &&
        this.queue.size > 0
      ) {
        setImmediate(() => {
          void this.processQueue();
        });
      }
    }
  }

  // ============================================================
  // FACE RECOGNITION PIPELINE
  // ============================================================

  /**
   * Fail the camera CLOSED when the biometric engine required for
   * recognition is unavailable.
   *
   * A recognition-enabled camera whose engine is missing must not keep
   * "running" silently — an operator looking at the dashboard would assume
   * attendance is being captured when it is not. Transition to ERROR,
   * record the REAL reason, and surface it through the same offline path
   * the manager uses to persist camera ERROR status + alerting.
   */
  private failCameraForEngine(
    errorCode: string,
    message: string,
  ): void {
    if (this.stopped) {
      return;
    }

    this.lifecycleState = 'ERROR';
    this.healthTracker.recordError(
      new Error(message),
    );

    this.logger.error(
      message,
      {
        cameraId: this.cameraId,
        organizationId: this.organizationId,
        errorCode,
      },
    );

    // The manager persists camera ERROR with the code + message and sends
    // the offline alert, so the dashboard shows exactly why recognition
    // stopped instead of a generic STREAM_ERROR.
    this.emit('camera-offline', {
      cameraId: this.cameraId,
      organizationId: this.organizationId,
      error: message,
      errorCode,
      timestamp: Date.now(),
    });
  }

  private async processFrame(
    frame: VideoFrame,
  ): Promise<void> {
    if (
      this.stopped ||
      !this.config.recognitionEnabled
    ) {
      return;
    }

    /**
     * Fail closed if the real engine is unavailable.
     */
    /**
     * Fail closed when there is no engine at all.
     *
     * `CameraWorkerManagerService.initializeFaceEngine()` only warns outside
     * production, so `faceEngine` can be undefined while an enabled camera
     * still starts a worker. The availability probe below cannot catch that:
     * reading `.isAvailable` off an undefined engine throws before `typeof` is
     * evaluated, so the intended fail-closed path became an exception.
     */
    if (!this.faceEngine) {
      this.failCameraForEngine(
        'FACE_ENGINE_MISSING',
        'Recognition disabled because the face engine is not available',
      );
      return;
    }

    if (
      typeof this.faceEngine
        .isAvailable === 'function'
    ) {
      const available =
        await this.faceEngine.isAvailable();

      if (!available) {
        this.failCameraForEngine(
          'FACE_ENGINE_UNAVAILABLE',
          'Recognition disabled because the real face engine is unavailable',
        );
        return;
      }
    }

    const detectedFaces =
      await this.faceEngine.detectFaces({
        imageBuffer: frame.buffer,
        format: 'jpeg',
      });

    if (
      !detectedFaces ||
      detectedFaces.length === 0
    ) {
      return;
    }

    const processingStartedAt = Date.now();

    /**
     * Limit to MAX_FACES_PER_FRAME strongest faces.
     * sortFacesByArea returns them in descending order by area.
     */
    const facesToProcess =
      this.sortFacesByArea(
        detectedFaces,
      ).slice(0, MAX_FACES_PER_FRAME);

    const faceCount = facesToProcess.length;

    const attendedStudents: Map<
      string,
      {
        studentId: string;
        similarity: number;
        qualityScore: number;
      }
    > = new Map();

    const templates =
      await this.getEnrolledTemplates();

    if (templates.length === 0) {
      return;
    }

    // ----------------------------------------------------------
    // PROCESS EACH FACE SEQUENTIALLY
    // Sequential: ONNX inference session is single-request-at-a-time.
    // ----------------------------------------------------------

    for (
      let faceIndex = 0;
      faceIndex < faceCount;
      faceIndex++
    ) {
      /**
       * Deadline check: abandon the rest of this frame if we have
       * exceeded MAX_PROCESSING_TIME_MS. This prevents a "hard"
       * frame (heavy occlusion, extreme lighting) from consuming
       * all frame budget and cascading into the next frame's timing.
       */
      if (
        Date.now() - processingStartedAt >
        MAX_PROCESSING_TIME_MS
      ) {
        this.logger.warn(
          'Frame processing deadline exceeded — remaining faces skipped',
          {
            cameraId: this.cameraId,
            organizationId:
              this.organizationId,
            facesProcessed: faceIndex,
            facesRemaining:
              faceCount - faceIndex,
          },
        );
        break;
      }

      const face = facesToProcess[faceIndex];

      // ----------------------------------------------------------
      // QUALITY GATE
      // ----------------------------------------------------------

      const quality =
        await this.faceEngine.assessQuality({
          imageBuffer: frame.buffer,
          face,
        });

      if (
        !quality.passesThreshold ||
        quality.overallScore <
          MIN_QUALITY_SCORE
      ) {
        continue;
      }

      // ----------------------------------------------------------
      // LIVENESS GATE
      // ----------------------------------------------------------

      if (
        !this.faceEngine ||
        typeof this.faceEngine
          .checkLiveness !== 'function'
      ) {
        this.failCameraForEngine(
          'LIVENESS_ENGINE_UNAVAILABLE',
          'Recognition disabled because the liveness engine is unavailable',
        );
        return;
      }

      const liveness =
        await this.faceEngine.checkLiveness({
          imageBuffer: frame.buffer,
          face,
        });

      if (
        liveness.decision !== 'PASS'
      ) {
        continue;
      }

      // ----------------------------------------------------------
      // EMBEDDING
      // ----------------------------------------------------------

      const probeEmbedding =
        await this.faceEngine.generateEmbedding({
          imageBuffer: frame.buffer,
          face,
        });

      // ----------------------------------------------------------
      // TEMPLATE MATCHING
      // ----------------------------------------------------------

      const match =
        await this.findBestMatch(
          probeEmbedding,
          templates,
        );

      if (!match) {
        continue;
      }

      /**
       * Deduplication: if the same student appeared in a
       * previous face of this frame with equal-or-better
       * similarity, skip this result.
       */
      const existing =
        attendedStudents.get(
          match.studentId,
        );

      if (
        existing &&
        existing.similarity >=
          match.similarity *
            FACE_SIMILARITY_DEDUP_THRESHOLD
      ) {
        continue;
      }

      attendedStudents.set(
        match.studentId,
        {
          studentId: match.studentId,
          similarity: match.similarity,
          qualityScore:
            quality.overallScore,
        },
      );
    }

    /**
     * Attendance is explicitly controlled by
     * camera configuration.
     */
    if (
      !this.config.attendanceEnabled ||
      attendedStudents.size === 0
    ) {
      return;
    }

    // ----------------------------------------------------------
    // FIRE ATTENDANCE EVENTS FOR EACH UNIQUE STUDENT
    // ----------------------------------------------------------

    const recognizedAt = new Date(
      frame.timestamp,
    );

    const now = Date.now();
    for (const entry of attendedStudents.values()) {
      const lastRecognized = this.activeRecognitions.get(entry.studentId);
      if (lastRecognized && now - lastRecognized < 60_000) {
        // Recognized within the last minute. Skip to save database writes.
        continue;
      }
      /*
       * The cooldown is claimed BEFORE the write so a failing database is
       * retried once per minute instead of once per frame. Without that, a
       * transient error would be hammered ~3x/second for the whole session.
       */
      this.activeRecognitions.set(entry.studentId, now);

      try {
        await this.attendanceEngine.processRecognition(
          {
            organizationId:
              this.organizationId,

            cameraId: this.cameraId,

            studentId: entry.studentId,

            recognizedAt,

            confidence: entry.similarity,

            similarityScore: entry.similarity,

            qualityScore: entry.qualityScore,

            cameraLocation:
              this.config.location,

            cameraName: this.config.name,
          },
        );
      } catch (err: unknown) {
        /*
         * One student's attendance write must never abort the remaining
         * students recognized in the SAME frame (a classroom full of faces
         * would silently lose everyone after the first DB hiccup).
         */
        this.logger.error(
          'Attendance write failed for recognized student',
          {
            cameraId: this.cameraId,
            organizationId: this.organizationId,
            studentId: entry.studentId,
            recognizedAt: recognizedAt.toISOString(),
            error: getErrorMessage(err),
          },
        );
      }
    }
    
    // Purge stale cache entries to prevent memory leak
    if (Math.random() < 0.05) {
      for (const [studentId, time] of this.activeRecognitions.entries()) {
        if (now - time >= 60_000) {
          this.activeRecognitions.delete(studentId);
        }
      }
    }
  }

  // ============================================================
  // FACE MATCHING
  // ============================================================

  private async findBestMatch(
    probeEmbedding: FaceEmbedding,
    templates: EnrolledTemplate[],
  ): Promise<{
    studentId: string;
    similarity: number;
  } | null> {
    /**
     * Best similarity PER STUDENT (one student may own several templates),
     * then rank the two best DISTINCT students.
     *
     * The ambiguity margin MUST include candidates below the similarity
     * threshold: dropping them first made a second student scoring just
     * under the threshold invisible, so near-ties were wrongly accepted —
     * strictly more permissive than the core RecognitionService, which
     * ranks every candidate.
     */
    const bestByStudent = new Map<string, number>();

    for (const template of templates) {
      // Dimension compatibility: probe and template produced by different
      // embedding models must never be compared (garbage similarity in,
      // false attendance out). FaceEmbedding.cosine would throw, but an
      // engine adapter could silently return NaN — reject explicitly here.
      if (
        template.embedding.getDimension() !==
        probeEmbedding.getDimension()
      ) {
        this.logger.warn(
          'Face template skipped: embedding dimension mismatch',
          {
            cameraId: this.cameraId,
            templateId: template.id,
            templateDimension: template.embedding.getDimension(),
            probeDimension: probeEmbedding.getDimension(),
          },
        );
        continue;
      }

      try {
        const similarity =
          await this.faceEngine.compareEmbeddings({
            embeddingA: probeEmbedding,
            embeddingB: template.embedding,
          });

        if (!Number.isFinite(similarity)) {
          continue;
        }

        const previous =
          bestByStudent.get(template.studentId);

        if (
          previous === undefined ||
          similarity > previous
        ) {
          bestByStudent.set(
            template.studentId,
            similarity,
          );
        }
      } catch (err: unknown) {
        this.logger.warn(
          'Face template comparison failed',
          {
            cameraId: this.cameraId,
            templateId: template.id,
            error: getErrorMessage(err),
          },
        );
      }
    }

    if (bestByStudent.size === 0) {
      return null;
    }

    const ranked = [...bestByStudent.entries()]
      .map(([studentId, similarity]) => ({
        studentId,
        similarity,
      }))
      .sort((a, b) => b.similarity - a.similarity);

    const top1 = ranked[0];
    const top2 = ranked[1];

    if (top1.similarity < this.config.similarityThreshold) {
      return null;
    }

    const minMargin =
      this.config.minAmbiguityMargin ??
      DEFAULT_AMBIGUITY_MARGIN;

    if (
      top2 &&
      top1.similarity - top2.similarity < minMargin
    ) {
      this.logger.warn(
        'Ambiguous face match detected — rejected to prevent false positive',
        {
          cameraId: this.cameraId,
          top1StudentId: top1.studentId,
          top1Similarity: top1.similarity,
          top2StudentId: top2.studentId,
          top2Similarity: top2.similarity,
          margin: top1.similarity - top2.similarity,
          requiredMargin: minMargin,
        },
      );
      return null;
    }

    return top1;
  }

  // ============================================================
  // TEMPLATE CACHE
  // ============================================================

  private async getEnrolledTemplates(): Promise<
    EnrolledTemplate[]
  > {
    const now = Date.now();

    if (
      this.activeTemplatesCache &&
      now -
        this.lastTemplateCacheUpdate <
        TEMPLATE_CACHE_TTL_MS
    ) {
      return this.activeTemplatesCache;
    }

    const rawTemplates =
      await this.prisma.faceTemplate.findMany(
        {
          where: {
            organizationId:
              this.organizationId,

            status: 'ACTIVE',
            /*
             * A template is only matchable while its enrollment is ACTIVE.
             * Enforced on READ (not only by the revoke write path) so a
             * revoked student can never keep producing attendance if any
             * future code flips `FaceEnrollment.status` without revoking the
             * templates. Mirrors PrismaEnrollmentAdapter used by the
             * face-session pipeline — both paths must agree.
             */
            enrollment: { status: 'ACTIVE' },
          },

          select: {
            id: true,
            studentId: true,
            templateData: true,
            modelVersion: true,
          },
        },
      );

    // Parity with the core RecognitionService model-version guard: a template
    // extracted with a different (or unknown) embedding model produces
    // meaningless similarity scores. When the engine can report its version we
    // enforce compatibility strictly and fail closed on a missing version.
    // (An engine that cannot report a version — e.g. a test double — skips the
    // guard rather than silently discarding every template.)
    const engineVersion =
      typeof this.faceEngine?.getModelVersion === 'function'
        ? this.faceEngine.getModelVersion()
        : undefined;

    const parsed: EnrolledTemplate[] =
      [];

    for (const template of rawTemplates) {
      try {
        if (
          !template.templateData
        ) {
          continue;
        }

        if (
          engineVersion &&
          (!template.modelVersion ||
            template.modelVersion !== engineVersion)
        ) {
          this.logger.warn(
            'Face template skipped: embedding model version mismatch',
            {
              cameraId: this.cameraId,
              templateId: template.id,
              templateModelVersion: template.modelVersion,
              engineModelVersion: engineVersion,
            },
          );
          continue;
        }

        const decrypted =
          await this.encryption.decrypt(
            template.templateData,
          );

        const embedding =
          FaceEmbedding.deserialize(
            decrypted,
          );

        parsed.push({
          id: template.id,
          studentId:
            template.studentId,
          embedding,
        });
      } catch (err: unknown) {
        /**
         * A corrupted biometric template must
         * never crash the entire camera worker.
         *
         * It is excluded from matching and logged
         * without exposing biometric contents.
         */
        this.logger.warn(
          'Invalid face template skipped',
          {
            cameraId:
              this.cameraId,
            templateId:
              template.id,
            error:
              getErrorMessage(err),
          },
        );
      }
    }

    this.activeTemplatesCache =
      parsed;

    this.lastTemplateCacheUpdate =
      now;

    return parsed;
  }

  /**
   * Allows future external invalidation after
   * enrollment/revoke operations.
   */
  invalidateTemplateCache(): void {
    this.activeTemplatesCache = null;
    this.lastTemplateCacheUpdate = 0;
  }

  // ============================================================
  // STREAM ERROR / RECONNECT
  // ============================================================

  private handleStreamError(
    error: Error | string,
  ): void {
    if (this.stopped) {
      return;
    }

    const message =
      typeof error === 'string'
        ? error
        : getErrorMessage(error);

    this.logger.warn(
      'Camera stream error',
      {
        cameraId: this.cameraId,
        organizationId:
          this.organizationId,
        error: message,
      },
    );

    // Record at most once per failure episode: the ingester fires both
    // `error` and `close` for the same process death.
    if (!this.streamFailureRecorded) {
      this.streamFailureRecorded = true;

      this.healthTracker.recordStreamFailure(
        message,
      );

      this.lifecycleState =
        'DEGRADED';

      // FIX-4: emit offline event for 15-minute debounce alerting
      this.emit('camera-offline', {
        cameraId: this.cameraId,
        organizationId: this.organizationId,
        error: message,
        timestamp: Date.now(),
      });
    }

    this.scheduleReconnect();
  }

  private handleStreamClose(
    code: number | null,
  ): void {
    if (this.stopped) {
      return;
    }

    const message =
      `Stream process exited with code ${code ?? 'unknown'}`;

    this.logger.warn(
      'Camera stream closed',
      {
        cameraId: this.cameraId,
        organizationId:
          this.organizationId,
        code,
      },
    );

    if (!this.streamFailureRecorded) {
      this.streamFailureRecorded = true;

      this.healthTracker.recordStreamFailure(
        message,
      );

      this.lifecycleState =
        'DEGRADED';

      // FIX-4: emit offline event for 15-minute debounce alerting
      this.emit('camera-offline', {
        cameraId: this.cameraId,
        organizationId: this.organizationId,
        error: message,
        timestamp: Date.now(),
      });
    }

    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (
      this.stopped ||
      this.reconnectTimer ||
      this.reconnectInProgress
    ) {
      return;
    }

    // Reconnect cap: a persistently failing camera (or attacker blocking
    // its IP) must not produce infinite reconnect attempts. After
    // MAX_RECONNECT_ATTEMPTS we transition to ERROR and stop.
    if (
      this.healthTracker.reconnectAttempts >=
      MAX_RECONNECT_ATTEMPTS
    ) {
      this.lifecycleState = 'ERROR';
      this.healthTracker.setStatus('ERROR');
      this.logger.error(
        'Camera worker reached max reconnect attempts; transitioning to ERROR',
        {
          cameraId: this.cameraId,
          organizationId: this.organizationId,
          attempts: this.healthTracker.reconnectAttempts,
        },
      );
      this.emit("error", 
        new Error(
          `Reconnect cap (${MAX_RECONNECT_ATTEMPTS}) exceeded; worker stopped.`,
        ),
      );
      return;
    }

    const delayMs =
      this.healthTracker
        .getNextReconnectDelayMs();

    this.lifecycleState =
      'CONNECTING';

    this.healthTracker.setStatus(
      'CONNECTING',
    );

    this.logger.info(
      'Scheduling camera reconnect',
      {
        cameraId: this.cameraId,
        organizationId:
          this.organizationId,
        delayMs,
      },
    );

    this.reconnectTimer =
      setTimeout(() => {
        this.reconnectTimer = null;

        if (this.stopped) {
          return;
        }

        void this.connect();
      }, delayMs);
  }

  private clearReconnectTimer(): void {
    if (!this.reconnectTimer) {
      return;
    }

    clearTimeout(
      this.reconnectTimer,
    );

    this.reconnectTimer = null;
  }

  // ============================================================
  // FACE SELECTION
  // ============================================================

  /**
   * Sort faces in descending order by bounding box area.
   * The largest faces are processed first because they are
   * more likely to produce high-quality embeddings and
   * reliable matches — when the frame budget is tight, we
   * want to process the most confident candidates first.
   */
  private sortFacesByArea<
    T extends {
      boundingBox?: {
        width?: number;
        height?: number;
      };
    },
  >(faces: T[]): T[] {
    return [...faces].sort(
      (a, b) =>
        this.getFaceArea(b) -
        this.getFaceArea(a),
    );
  }

  private getFaceArea<
    T extends {
      boundingBox?: {
        width?: number;
        height?: number;
      };
    },
  >(face: T): number {
    const width =
      Number(
        face.boundingBox?.width,
      ) || 0;

    const height =
      Number(
        face.boundingBox?.height,
      ) || 0;

    return width * height;
  }

  // ============================================================
  // CONFIGURATION VALIDATION
  // ============================================================

  private normalizeFps(
    value: number,
  ): number {
    if (
      !Number.isFinite(value) ||
      value <= 0
    ) {
      return DEFAULT_PROCESSING_FPS;
    }

    return Math.min(
      Math.max(value, 0.5),
      30,
    );
  }

  private normalizeSimilarityThreshold(
    value: number,
  ): number {
    if (
      !Number.isFinite(value)
    ) {
      return DEFAULT_SIMILARITY_THRESHOLD;
    }

    return Math.min(
      Math.max(value, 0),
      1,
    );
  }
}
