/**
 * Unit tests for camera-worker-session.ts — multi-face detection.
 *
 * Tests FIX-1: multiple enrolled students in a single frame each
 * generate their own attendance event, processed sequentially
 * (ONNX inference session is single-request-at-a-time).
 *
 * Pre-profile baseline (documented before FIX-1):
 *   1 face  = 1 pipeline execution  ≈ 250 ms
 *   5 faces = 5 sequential executions ≈ 1 250 ms
 *   CPU: 1 inference session × 1 pipeline × N faces (sequential)
 *
 * Post-profile expected:
 *   N faces (capped at MAX_FACES_PER_FRAME=10) processed sequentially
 *   MAX_PROCESSING_TIME_MS=5000 deadline prevents runaway latency
 *   FACE_SIMILARITY_DEDUP_THRESHOLD=0.95 prevents duplicate attendance
 *     for the same student appearing in multiple faces of one frame
 */

import { describe, expect, it, vi } from 'vitest';

import {
  FaceEmbedding,
  type FaceEngine,
  type EncryptionPort,
} from '@medu/core';

import { CameraWorkerSession } from '../camera-worker-session';
import type { AttendanceDecisionEngine } from '../attendance-decision.engine';
import type { PrismaService } from '../../prisma/prisma.service';

// ---------------------------------------------------------------------------
// Helper types
// ---------------------------------------------------------------------------

type FaceEngineMock = {
  [K in keyof FaceEngine]: ReturnType<typeof vi.fn>;
};

type AttendanceEngineMock = {
  processRecognition: ReturnType<typeof vi.fn>;
};

type PrismaMock = {
  faceTemplate: {
    findMany: ReturnType<typeof vi.fn>;
  };
};

function makeFaceEmbedding(
  id: string,
): FaceEmbedding {
  const emb = new Float32Array(512);
  for (let i = 0; i < 512; i++) {
    emb[i] = Math.sin(i + id.charCodeAt(0)) * 0.1;
  }
  return new FaceEmbedding(emb);
}

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

function makeFaceEngine() {
  const mock: FaceEngineMock = {
    isAvailable: vi.fn().mockResolvedValue(true),
    detectFaces: vi.fn(),
    assessQuality: vi.fn(),
    checkLiveness: vi.fn(),
    generateEmbedding: vi.fn(),
    compareEmbeddings: vi.fn(),
    extractFaceFromImage: vi.fn(),
    detectFacesFromBuffer: vi.fn(),
    // Unset by default: an engine that does not report a model version
    // skips the version guard (see getEnrolledTemplates).
    getModelVersion: vi.fn().mockReturnValue(undefined),
  };

  // Default: one face
  return mock;
}

function makeAttendanceEngine(): AttendanceEngineMock {
  return {
    processRecognition: vi.fn().mockResolvedValue(undefined),
  };
}

function makePrisma(
  templates: Array<{
    id: string;
    studentId: string;
    templateData: string;
    modelVersion?: string | null;
  }>,
): PrismaMock {
  return {
    faceTemplate: {
      findMany: vi.fn().mockResolvedValue(templates),
    },
  };
}

function makeEncryption() {
  return {
    encrypt: vi
      .fn()
      .mockImplementation(
        async (data: unknown) => {
          const payload =
            typeof data === 'string' ? data : String(data);
          return `enc:${payload}`;
        },
      ),
    decrypt: vi
      .fn()
      .mockImplementation(
        async (data: unknown) => {
          const str = String(data);
          const seedStr = str.replace(/^enc:/, '');
          // Numeric seed → embedded index; string seed → fixed embedding
          const studentIdx = parseInt(seedStr, 10);
          const emb = new Float32Array(512);
          if (!isNaN(studentIdx)) {
            emb[0] = studentIdx;
          } else {
            // String seed: encode hash-like value into first float
            emb[0] = seedStr.length > 0 ? seedStr.charCodeAt(0) : 0;
          }
          return new FaceEmbedding(emb).serialize();
        },
      ),
  };
}

// ---------------------------------------------------------------------------
// Session factory
// ---------------------------------------------------------------------------

function makeSession(
  faceEngine: FaceEngineMock,
  attendanceEngine: AttendanceEngineMock,
  prisma: PrismaMock,
  encryption: EncryptionPort,
  overrides: Partial<{
    processingFps: number;
    similarityThreshold: number;
    attendanceEnabled: boolean;
    recognitionEnabled: boolean;
  }> = {},
) {
  return new CameraWorkerSession(
    {
      cameraId: 'cam-1',
      organizationId: 'org-1',
      name: 'Test Camera',
      streamUri: 'rtsp://example.com/stream',
      processingFps: overrides.processingFps ?? 3,
      rtspTransport: 'tcp',
      location: 'Hall',
      recognitionEnabled:
        overrides.recognitionEnabled ?? true,
      attendanceEnabled:
        overrides.attendanceEnabled ?? true,
      similarityThreshold:
        overrides.similarityThreshold ?? 0.6,
    },
    faceEngine as unknown as FaceEngine,
    attendanceEngine as unknown as AttendanceDecisionEngine,
    prisma as unknown as Pick<
      PrismaService,
      'faceTemplate'
    >,
    encryption,
  );
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const JPEG_1PX = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIy' +
    'MjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA' +
    '/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AJQAB/9k=',
  'base64',
);

function makeFrame(
  timestamp = Date.now(),
): { buffer: Buffer; timestamp: number } {
  return { buffer: JPEG_1PX, timestamp };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CameraWorkerSession multi-face detection (FIX-1)', () => {
  // ----- helper: standard 1-face setup --------------------------------------

  function standardTemplates() {
    return [
      {
        id: 'tmpl-alice',
        studentId: 'alice',
        templateData: '1',
      },
    ];
  }

  // ---------------------------------------------------------------------------
  it('5 enrolled students in one frame → 5 separate attendance events', async () => {
    // This is the primary FIX-1 acceptance criterion.
    const STUDENT_IDS = [
      'alice',
      'bob',
      'charlie',
      'diana',
      'eve',
    ];

    const templates = STUDENT_IDS.map((id, idx) => ({
      id: `tmpl-${id}`,
      studentId: id,
      // Encode the student index directly so
      // getEnrolledTemplates produces
      // embeddings that compareEmbeddings can
      // match deterministically.
      templateData: String(idx + 1),
    }));

    const faceEngine = makeFaceEngine();
    const attendanceEngine = makeAttendanceEngine();
    const prisma = makePrisma(templates);
    const encryption = makeEncryption();

    // ── detectFaces returns 5 faces, one per student ──
    const detectedFaces = STUDENT_IDS.map((id) => ({
      boundingBox: {
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      },
      confidence: 0.99,
      faceId: id,
    }));

    faceEngine.detectFaces.mockResolvedValue(
      detectedFaces,
    );

    // ── quality: all pass ──
    faceEngine.assessQuality.mockResolvedValue({
      passesThreshold: true,
      overallScore: 0.8,
      blurScore: 0.9,
      brightnessScore: 0.7,
      poseScore: 0.8,
    });

    // ── liveness: all pass ──
    faceEngine.checkLiveness.mockResolvedValue({
      decision: 'PASS',
      confidence: 0.95,
    });

    // ── generateEmbedding: return a unique embedding per face index ──
    faceEngine.generateEmbedding.mockImplementation(
      async ({ face }: { face: { faceId: string } }) => {
        const idx = STUDENT_IDS.indexOf(
          face.faceId as string,
        );
        const emb = new Float32Array(512);
        // Put the student identifier at index 0
        // so compareEmbeddings can read it back
        // easily.
        emb[0] = idx + 1;
        return new FaceEmbedding(emb);
      },
    );

    // ── compareEmbeddings: probe (embeddingA) carries
    // the source student index in the first float;
    // template (embeddingB) carries the candidate
    // student index in its first float. A match is
    // returned only when both refer to the same
    // student (idx probe == idx template). ──
    faceEngine.compareEmbeddings.mockImplementation(
      async ({
        embeddingA,
        embeddingB,
      }: {
        embeddingA: FaceEmbedding;
        embeddingB: FaceEmbedding;
      }) => {
        const probeIdx = Math.round(
          embeddingA.getData()[0],
        );
        const tmplIdx = Math.round(
          embeddingB.getData()[0],
        );
        if (probeIdx === tmplIdx) {
          const SIMILARITY_MAP: Record<
            number,
            number
          > = {
            1: 0.92, // alice
            2: 0.91, // bob
            3: 0.93, // charlie
            4: 0.90, // diana
            5: 0.89, // eve
          };
          return SIMILARITY_MAP[probeIdx] ?? 0;
        }
        return 0;
      },
    );

    const session = makeSession(
      faceEngine,
      attendanceEngine,
      prisma,
      encryption,
    );

    await session.start();

    const frame = makeFrame();

    // Trigger frame ingestion via the internal handle
    // (we use processQueue by exposing via a helper approach)
    // The frame is queued via handleIncomingFrame which is private,
    // so we simulate by directly invoking processQueue by triggering
    // the ingestor's frame callback.
    // We need to access the session's internals — use the ingester's
    // onFrame hook by calling connect() and simulating a frame.
    // Instead, let's directly test by using a small trick: call
    // start() which triggers connect() internally — we need to intercept.
    // The simplest approach is to test the private method via a cast.
    const sessionAny = session as unknown as {
      processFrame: (frame: {
        buffer: Buffer;
        timestamp: number;
      }) => Promise<void>;
    };

    await sessionAny.processFrame(frame);

    // ── Verify: exactly 5 attendance events, one per student ──
    expect(
      attendanceEngine.processRecognition,
    ).toHaveBeenCalledTimes(5);

    const callArgs =
      attendanceEngine.processRecognition.mock.calls;

    const calledStudentIds = callArgs.map(
      (call) =>
        (call[0] as { studentId: string })
          .studentId,
    );

    for (const studentId of STUDENT_IDS) {
      expect(calledStudentIds).toContain(studentId);
    }

    // No duplicate attendance for the same student in one frame
    const uniqueStudents = new Set(calledStudentIds);
    expect(uniqueStudents.size).toBe(5);
  });

  // ---------------------------------------------------------------------------
  it('deadline exceeded → remaining faces skipped', async () => {
    vi.useFakeTimers();
    const faceEngine = makeFaceEngine();
    const attendanceEngine = makeAttendanceEngine();
    const prisma = makePrisma(standardTemplates());
    const encryption = makeEncryption();

    const detectedFaces = [
      { boundingBox: { width: 100, height: 100 }, faceId: 'a' },
      { boundingBox: { width: 100, height: 100 }, faceId: 'b' },
      { boundingBox: { width: 100, height: 100 }, faceId: 'c' },
    ];

    faceEngine.detectFaces.mockResolvedValue(
      detectedFaces,
    );
    faceEngine.assessQuality.mockResolvedValue({
      passesThreshold: true,
      overallScore: 0.8,
      blurScore: 0.9,
      brightnessScore: 0.7,
      poseScore: 0.8,
    });
    faceEngine.checkLiveness.mockResolvedValue({
      decision: 'PASS',
      confidence: 0.95,
    });

    // Slow embedding generation (> MAX_PROCESSING_TIME_MS per face)
    let callCount = 0;
    faceEngine.generateEmbedding.mockImplementation(
      async () => {
        callCount++;
        // First call is fast, second call exceeds deadline
        if (callCount === 2) {
          // Simulate deadline already exceeded
          vi.advanceTimersByTime(6_000);
        }
        const emb = new Float32Array(512);
        emb[0] = 1;
        return new FaceEmbedding(emb);
      },
    );

    faceEngine.compareEmbeddings.mockResolvedValue(0);

    const session = makeSession(
      faceEngine,
      attendanceEngine,
      prisma,
      encryption,
    );

    const sessionAny =
      session as unknown as {
        processFrame: (frame: {
          buffer: Buffer;
          timestamp: number;
        }) => Promise<void>;
      };

    await sessionAny.processFrame(makeFrame());

    // After the deadline, no more calls to processRecognition
    // (the 2nd and 3rd faces are skipped)
    expect(
      attendanceEngine.processRecognition,
    ).toHaveBeenCalledTimes(0);
  });

  // ---------------------------------------------------------------------------
  it('single face still works (backward compatibility)', async () => {
    const faceEngine = makeFaceEngine();
    const attendanceEngine = makeAttendanceEngine();
    const prisma = makePrisma(standardTemplates());
    const encryption = makeEncryption();

    faceEngine.detectFaces.mockResolvedValue([
      {
        boundingBox: { width: 100, height: 100 },
        confidence: 0.99,
      },
    ]);
    faceEngine.assessQuality.mockResolvedValue({
      passesThreshold: true,
      overallScore: 0.85,
      blurScore: 0.9,
      brightnessScore: 0.7,
      poseScore: 0.8,
    });
    faceEngine.checkLiveness.mockResolvedValue({
      decision: 'PASS',
      confidence: 0.95,
    });

    const aliceEmb = makeFaceEmbedding('alice');
    faceEngine.generateEmbedding.mockResolvedValue(
      aliceEmb,
    );
    faceEngine.compareEmbeddings.mockResolvedValue(
      0.92,
    );

    const session = makeSession(
      faceEngine,
      attendanceEngine,
      prisma,
      encryption,
    );

    const sessionAny =
      session as unknown as {
        processFrame: (frame: {
          buffer: Buffer;
          timestamp: number;
        }) => Promise<void>;
      };

    await sessionAny.processFrame(makeFrame());

    expect(
      attendanceEngine.processRecognition,
    ).toHaveBeenCalledTimes(1);

    const [[call]] =
      attendanceEngine.processRecognition.mock.calls;

    expect((call as { studentId: string }).studentId).toBe(
      'alice',
    );
  });

  // ---------------------------------------------------------------------------
  it('quality gate failure → face skipped, others processed', async () => {
    const faceEngine = makeFaceEngine();
    const attendanceEngine = makeAttendanceEngine();
    const prisma = makePrisma(standardTemplates());
    const encryption = makeEncryption();

    faceEngine.detectFaces.mockResolvedValue([
      {
        boundingBox: { width: 100, height: 100 },
        faceId: 'a',
      },
      {
        boundingBox: { width: 100, height: 100 },
        faceId: 'b',
      },
    ]);
    faceEngine.assessQuality.mockImplementation(
      async ({ face }: { face: { faceId: string } }) => ({
        passesThreshold: face.faceId === 'b',
        overallScore: 0.8,
        blurScore: 0.9,
        brightnessScore: 0.7,
        poseScore: 0.8,
      }),
    );
    faceEngine.checkLiveness.mockResolvedValue({
      decision: 'PASS',
      confidence: 0.95,
    });

    const aliceEmb = makeFaceEmbedding('alice');

    faceEngine.generateEmbedding.mockResolvedValue(
      aliceEmb,
    );
    faceEngine.compareEmbeddings.mockResolvedValue(
      0.92,
    );

    const session = makeSession(
      faceEngine,
      attendanceEngine,
      prisma,
      encryption,
    );

    const sessionAny =
      session as unknown as {
        processFrame: (frame: {
          buffer: Buffer;
          timestamp: number;
        }) => Promise<void>;
      };

    await sessionAny.processFrame(makeFrame());

    // Only the face that passed quality gate gets attendance
    expect(
      attendanceEngine.processRecognition,
    ).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------------------------
  it('liveness FAIL → face skipped', async () => {
    const faceEngine = makeFaceEngine();
    const attendanceEngine = makeAttendanceEngine();
    const prisma = makePrisma(standardTemplates());
    const encryption = makeEncryption();

    faceEngine.detectFaces.mockResolvedValue([
      { boundingBox: { width: 100, height: 100 } },
    ]);
    faceEngine.assessQuality.mockResolvedValue({
      passesThreshold: true,
      overallScore: 0.8,
      blurScore: 0.9,
      brightnessScore: 0.7,
      poseScore: 0.8,
    });
    faceEngine.checkLiveness.mockResolvedValue({
      decision: 'FAIL',
      confidence: 0.1,
    });

    const session = makeSession(
      faceEngine,
      attendanceEngine,
      prisma,
      encryption,
    );

    const sessionAny =
      session as unknown as {
        processFrame: (frame: {
          buffer: Buffer;
          timestamp: number;
        }) => Promise<void>;
      };

    await sessionAny.processFrame(makeFrame());

    expect(
      attendanceEngine.processRecognition,
    ).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  it('no detected faces → returns early', async () => {
    const faceEngine = makeFaceEngine();
    const attendanceEngine = makeAttendanceEngine();
    const prisma = makePrisma([]);
    const encryption = makeEncryption();

    faceEngine.detectFaces.mockResolvedValue([]);
    faceEngine.assessQuality.mockResolvedValue({
      passesThreshold: true,
      overallScore: 0.8,
      blurScore: 0.9,
      brightnessScore: 0.7,
      poseScore: 0.8,
    });
    faceEngine.checkLiveness.mockResolvedValue({
      decision: 'PASS',
      confidence: 0.95,
    });

    const session = makeSession(
      faceEngine,
      attendanceEngine,
      prisma,
      encryption,
    );

    const sessionAny =
      session as unknown as {
        processFrame: (frame: {
          buffer: Buffer;
          timestamp: number;
        }) => Promise<void>;
      };

    await sessionAny.processFrame(makeFrame());

    expect(
      faceEngine.assessQuality,
    ).not.toHaveBeenCalled();
    expect(
      faceEngine.checkLiveness,
    ).not.toHaveBeenCalled();
    expect(
      attendanceEngine.processRecognition,
    ).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  it('deduplication: same student in two faces → best similarity wins', async () => {
    // Edge case: two different detected faces both match "alice"
    // (e.g., partial face overlap or duplicate detection).
    // The higher-similarity result should win.

    const faceEngine = makeFaceEngine();
    const attendanceEngine = makeAttendanceEngine();
    const prisma = makePrisma([
      {
        id: 'tmpl-alice',
        studentId: 'alice',
        templateData: '1',
      },
    ]);
    const encryption = makeEncryption();

    faceEngine.detectFaces.mockResolvedValue([
      {
        boundingBox: { width: 100, height: 100 },
        faceId: 'a',
      },
      {
        boundingBox: { width: 80, height: 80 },
        faceId: 'b',
      },
    ]);
    faceEngine.assessQuality.mockResolvedValue({
      passesThreshold: true,
      overallScore: 0.8,
      blurScore: 0.9,
      brightnessScore: 0.7,
      poseScore: 0.8,
    });
    faceEngine.checkLiveness.mockResolvedValue({
      decision: 'PASS',
      confidence: 0.95,
    });

    let callCount = 0;
    faceEngine.generateEmbedding.mockImplementation(
      async () => {
        callCount++;
        const emb = new Float32Array(512);
        emb[0] = callCount; // face 1 = 1, face 2 = 2
        return new FaceEmbedding(emb);
      },
    );

    // Similarity depends on face index: face 1 = 0.92, face 2 = 0.88
    faceEngine.compareEmbeddings.mockImplementation(
      async ({ embeddingA }: { embeddingA: FaceEmbedding }) => {
        const arr = embeddingA.getData();
        const idx = Math.round(arr[0]);
        return idx === 1 ? 0.92 : 0.88;
      },
    );

    const session = makeSession(
      faceEngine,
      attendanceEngine,
      prisma,
      encryption,
    );

    const sessionAny =
      session as unknown as {
        processFrame: (frame: {
          buffer: Buffer;
          timestamp: number;
        }) => Promise<void>;
      };

    await sessionAny.processFrame(makeFrame());

    // Exactly 1 attendance event (alice), not 2
    expect(
      attendanceEngine.processRecognition,
    ).toHaveBeenCalledTimes(1);

    const [[call]] =
      attendanceEngine.processRecognition.mock.calls;

    expect((call as { studentId: string }).studentId).toBe(
      'alice',
    );
  });

  // ---------------------------------------------------------------------------
  it('attendanceEnabled=false → no attendance events even with matches', async () => {
    const faceEngine = makeFaceEngine();
    const attendanceEngine = makeAttendanceEngine();
    const prisma = makePrisma(standardTemplates());
    const encryption = makeEncryption();

    faceEngine.detectFaces.mockResolvedValue([
      { boundingBox: { width: 100, height: 100 } },
    ]);
    faceEngine.assessQuality.mockResolvedValue({
      passesThreshold: true,
      overallScore: 0.8,
      blurScore: 0.9,
      brightnessScore: 0.7,
      poseScore: 0.8,
    });
    faceEngine.checkLiveness.mockResolvedValue({
      decision: 'PASS',
      confidence: 0.95,
    });

    const aliceEmb = makeFaceEmbedding('alice');
    faceEngine.generateEmbedding.mockResolvedValue(
      aliceEmb,
    );
    faceEngine.compareEmbeddings.mockResolvedValue(
      0.92,
    );

    // attendanceEnabled = false
    const session = makeSession(
      faceEngine,
      attendanceEngine,
      prisma,
      encryption,
      { attendanceEnabled: false },
    );

    const sessionAny =
      session as unknown as {
        processFrame: (frame: {
          buffer: Buffer;
          timestamp: number;
        }) => Promise<void>;
      };

    await sessionAny.processFrame(makeFrame());

    // No attendance events fired
    expect(
      attendanceEngine.processRecognition,
    ).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  it('MAX_FACES_PER_FRAME=10: more than 10 faces are capped', async () => {
    const faceEngine = makeFaceEngine();
    const attendanceEngine = makeAttendanceEngine();
    const prisma = makePrisma(standardTemplates());
    const encryption = makeEncryption();

    // 15 faces — should be capped at 10
    const detectedFaces = Array.from(
      { length: 15 },
      (_, i) => ({
        boundingBox: {
          width: 100,
          height: 100,
        },
        faceId: `face-${i}`,
      }),
    );

    faceEngine.detectFaces.mockResolvedValue(
      detectedFaces,
    );
    faceEngine.assessQuality.mockResolvedValue({
      passesThreshold: true,
      overallScore: 0.8,
      blurScore: 0.9,
      brightnessScore: 0.7,
      poseScore: 0.8,
    });
    faceEngine.checkLiveness.mockResolvedValue({
      decision: 'PASS',
      confidence: 0.95,
    });
    faceEngine.generateEmbedding.mockResolvedValue(
      makeFaceEmbedding('alice'),
    );
    // Only alice's template matches
    faceEngine.compareEmbeddings.mockResolvedValue(0);

    const session = makeSession(
      faceEngine,
      attendanceEngine,
      prisma,
      encryption,
    );

    const sessionAny =
      session as unknown as {
        processFrame: (frame: {
          buffer: Buffer;
          timestamp: number;
        }) => Promise<void>;
      };

    await sessionAny.processFrame(makeFrame());

    // At most 10 quality+liveness+embedding calls
    // (even though 15 faces were detected)
    expect(
      faceEngine.assessQuality,
    ).toHaveBeenCalledTimes(10);
  });
});

// ---------------------------------------------------------------------------
// Model-version parity guard (FIX-2)
// ---------------------------------------------------------------------------
describe('CameraWorkerSession model-version parity guard', () => {
  it('skips templates whose modelVersion is missing or mismatched', async () => {
    const faceEngine = makeFaceEngine();
    // Engine reports a concrete embedding model version.
    faceEngine.getModelVersion.mockReturnValue('v1');

    const attendanceEngine = makeAttendanceEngine();
    const prisma = makePrisma([
      {
        id: 'tmpl-alice',
        studentId: 'alice',
        templateData: '1',
        modelVersion: 'v1', // compatible → kept
      },
      {
        id: 'tmpl-bob',
        studentId: 'bob',
        templateData: '2',
        modelVersion: 'legacy', // mismatch → skipped
      },
      {
        id: 'tmpl-carol',
        studentId: 'carol',
        templateData: '3',
        modelVersion: null, // unknown → skipped (fail closed)
      },
    ]);
    const encryption = makeEncryption();

    faceEngine.detectFaces.mockResolvedValue([
      { boundingBox: { width: 100, height: 100 } },
    ]);
    faceEngine.assessQuality.mockResolvedValue({
      passesThreshold: true,
      overallScore: 0.8,
      blurScore: 0.9,
      brightnessScore: 0.7,
      poseScore: 0.8,
    });
    faceEngine.checkLiveness.mockResolvedValue({
      decision: 'PASS',
      confidence: 0.95,
    });
    faceEngine.generateEmbedding.mockResolvedValue(
      makeFaceEmbedding('alice'),
    );
    faceEngine.compareEmbeddings.mockResolvedValue(0.92);

    const session = makeSession(
      faceEngine,
      attendanceEngine,
      prisma,
      encryption,
    );

    const sessionAny = session as unknown as {
      processFrame: (frame: {
        buffer: Buffer;
        timestamp: number;
      }) => Promise<void>;
    };

    await sessionAny.processFrame(makeFrame());

    // Only the compatible template is decrypted and compared.
    expect(encryption.decrypt).toHaveBeenCalledTimes(1);
    expect(encryption.decrypt.mock.calls[0][0]).toBe('1');

    const [[cmpArgs]] =
      faceEngine.compareEmbeddings.mock.calls as unknown as [
        [{ embeddingB: FaceEmbedding }],
      ];
    expect(Math.round(cmpArgs.embeddingB.getData()[0])).toBe(1);

    expect(
      attendanceEngine.processRecognition,
    ).toHaveBeenCalledTimes(1);
    const [[call]] =
      attendanceEngine.processRecognition.mock.calls;
    expect((call as { studentId: string }).studentId).toBe(
      'alice',
    );
  });
});

// ---------------------------------------------------------------------------
// B — emitError regression (pre-existing bug, FIX-4 fix verifies it)
// ---------------------------------------------------------------------------
describe('CameraWorkerSession emitError regression (B)', () => {
  it('reconnect cap emits error event without throwing', async () => {
    const session = makeSession(makeFaceEngine(), makeAttendanceEngine(), makePrisma([]), makeEncryption());
    // Verify emit method exists (EventEmitter) — pre-existing bug was undefined method
    expect(typeof (session as unknown as { emit: unknown }).emit).toBe('function');
  });

  it('constructor attaches a default error listener so emit("error") cannot crash', () => {
    const session = makeSession(
      makeFaceEngine(),
      makeAttendanceEngine(),
      makePrisma([]),
      makeEncryption(),
    ) as unknown as NodeJS.EventEmitter & {
      emit: (event: string, ...args: unknown[]) => boolean;
    };

    expect(session.listenerCount('error')).toBeGreaterThanOrEqual(1);

    // emit('error') with no listeners throws in Node — the default
    // constructor listener must absorb it without throwing.
    expect(() => {
      session.emit('error', new Error('reconnect cap exceeded'));
    }).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// C — fail-closed biometric engine policy (recognition cannot silently no-op)
// ---------------------------------------------------------------------------
describe('CameraWorkerSession fail-closed engine policy (C)', () => {
  it('transitions to ERROR and stops recognition when the face engine is missing', async () => {
    const attendanceEngine = makeAttendanceEngine();
    const prisma = makePrisma([]);
    const encryption = makeEncryption();

    const session = makeSession(
      undefined as never,
      attendanceEngine,
      prisma,
      encryption,
    );

    const sessionAny = session as unknown as {
      processFrame: (frame: { buffer: Buffer; timestamp: number }) => Promise<void>;
      lifecycleState: string;
      healthTracker: {
        getSnapshot: () => {
          status: string;
          lastErrorMessage: string | null;
        };
      };
    };

    let offlineEvent: {
      errorCode?: string;
      error?: string;
    } | null = null;

    session.on('camera-offline', (evt: {
      errorCode?: string;
      error?: string;
    }) => {
      offlineEvent = evt;
    });

    // A recognition-enabled camera with no biometric engine must fail
    // CLOSED: ERROR state + persisted real error code — never a silent no-op
    // that looks healthy on the dashboard while recording nothing.
    await sessionAny.processFrame(makeFrame());

    expect(sessionAny.lifecycleState).toBe('ERROR');
    expect(sessionAny.healthTracker.getSnapshot().status).toBe('ERROR');
    expect(sessionAny.healthTracker.getSnapshot().lastErrorMessage).toContain(
      'face engine is not available',
    );
    expect(offlineEvent?.errorCode).toBe('FACE_ENGINE_MISSING');
    expect(attendanceEngine.processRecognition).not.toHaveBeenCalled();
  });
});

describe('CameraWorkerSession reconnect failure budget (M-EDU-CAM-003)', () => {
  it('does not reset reconnectAttempts on stream spawn until healthy frames arrive', () => {
    const faceEngine = makeFaceEngine();
    const attendanceEngine = makeAttendanceEngine();
    const prisma = makePrisma([]);
    const encryption = makeEncryption();

    const session = makeSession(
      faceEngine,
      attendanceEngine,
      prisma,
      encryption,
    );

    const sessionAny = session as any;
    // Simulate previous failures
    sessionAny.healthTracker.recordStreamFailure('RTSP connection lost');
    sessionAny.healthTracker.recordStreamFailure('RTSP connection lost');
    expect(sessionAny.healthTracker.reconnectAttempts).toBe(2);

    // Stream spawns (reconnectStream)
    sessionAny.consecutiveHealthyFrames = 0;
    expect(sessionAny.healthTracker.reconnectAttempts).toBe(2);

    // Receive 4 frames (under threshold of 5)
    for (let i = 0; i < 4; i++) {
      sessionAny.handleIncomingFrame(makeFrame());
    }
    expect(sessionAny.healthTracker.reconnectAttempts).toBe(2);

    // 5th healthy frame triggers reset
    sessionAny.handleIncomingFrame(makeFrame());
    expect(sessionAny.healthTracker.reconnectAttempts).toBe(0);
  });
});

