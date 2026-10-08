/**
 * Regression tests for the camera → attendance pipeline.
 *
 * Pinned invariants:
 *
 *  1. FAILURE ISOLATION — one student's attendance write failing must not
 *     prevent the OTHER students recognized in the SAME frame from being
 *     processed. Previously the `await processRecognition(...)` sat in a bare
 *     loop, so a single DB error aborted the frame and a classroom of faces
 *     silently lost attendance after the first hiccup.
 *
 *  2. TEMPLATE ELIGIBILITY — the camera path reads templates directly from
 *     `FaceTemplate`. It must only ever match templates whose ENROLLMENT is
 *     ACTIVE, exactly like the face-session path
 *     (PrismaEnrollmentAdapter), otherwise a revoked enrollment whose
 *     templates were not individually revoked keeps producing attendance.
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

const JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIy' +
    'MjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA' +
    '/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AJQAB/9k=',
  'base64',
);

const STUDENTS = ['alice', 'bob', 'charlie'];

function makeTemplates() {
  return STUDENTS.map((id, idx) => ({
    id: `tmpl-${id}`,
    studentId: id,
    templateData: String(idx + 1),
    modelVersion: null,
  }));
}

function makeEncryption(): EncryptionPort {
  return {
    encrypt: vi.fn(async (d: unknown) => `enc:${String(d)}`),
    decrypt: vi.fn(async (d: unknown) => {
      const seed = String(d).replace(/^enc:/, '');
      const idx = parseInt(seed, 10);
      const emb = new Float32Array(512);
      if (!Number.isNaN(idx)) emb[0] = idx;
      return new FaceEmbedding(emb).serialize();
    }),
  } as unknown as EncryptionPort;
}

function makeFaceEngine() {
  return {
    isAvailable: vi.fn().mockResolvedValue(true),
    detectFaces: vi.fn(),
    assessQuality: vi.fn(),
    checkLiveness: vi.fn(),
    generateEmbedding: vi.fn(),
    compareEmbeddings: vi.fn(),
    getModelVersion: vi.fn().mockReturnValue(undefined),
  } as Record<string, ReturnType<typeof vi.fn>>;
}

function wirePipeline(faceEngine: Record<string, ReturnType<typeof vi.fn>>) {
  // One detected face per student, tagged so embedding generation is per-face.
  faceEngine.detectFaces.mockResolvedValue(
    STUDENTS.map((id) => ({
      boundingBox: { x: 0, y: 0, width: 100, height: 100 },
      confidence: 0.99,
      faceId: id,
    })),
  );

  faceEngine.assessQuality.mockResolvedValue({
    passesThreshold: true,
    overallScore: 0.9,
  });

  faceEngine.checkLiveness.mockResolvedValue({
    decision: 'PASS',
    confidence: 0.99,
  });

  faceEngine.generateEmbedding.mockImplementation(
    async ({ face }: { face: { faceId: string } }) => {
      const emb = new Float32Array(512);
      emb[0] = STUDENTS.indexOf(face.faceId as string) + 1;
      return new FaceEmbedding(emb);
    },
  );

  faceEngine.compareEmbeddings.mockImplementation(
    async ({
      embeddingA,
      embeddingB,
    }: {
      embeddingA: FaceEmbedding;
      embeddingB: FaceEmbedding;
    }) =>
      Math.round(embeddingA.getData()[0]) ===
      Math.round(embeddingB.getData()[0])
        ? 0.95
        : 0,
  );
}

function makeSession(opts: {
  faceEngine: Record<string, ReturnType<typeof vi.fn>>;
  processRecognition: ReturnType<typeof vi.fn>;
  findMany: ReturnType<typeof vi.fn>;
}) {
  const prisma = {
    faceTemplate: { findMany: opts.findMany },
  };

  return new CameraWorkerSession(
    {
      cameraId: 'cam-1',
      organizationId: 'org-1',
      name: 'Hall Camera',
      streamUri: 'rtsp://example.invalid/stream',
      processingFps: 3,
      rtspTransport: 'tcp',
      location: 'Hall',
      recognitionEnabled: true,
      attendanceEnabled: true,
      similarityThreshold: 0.6,
    },
    opts.faceEngine as unknown as FaceEngine,
    {
      processRecognition: opts.processRecognition,
    } as unknown as AttendanceDecisionEngine,
    prisma as unknown as Pick<PrismaService, 'faceTemplate'>,
    makeEncryption(),
  );
}

describe('CameraWorkerSession — attendance pipeline isolation', () => {
  it('one failing attendance write does not drop the other students of the same frame', async () => {
    const faceEngine = makeFaceEngine();
    wirePipeline(faceEngine);

    const processRecognition = vi
      .fn()
      .mockRejectedValueOnce(new Error('database timeout'));
    const findMany = vi.fn().mockResolvedValue(makeTemplates());

    const session = makeSession({
      faceEngine,
      processRecognition,
      findMany,
    });

    const sessionAny = session as unknown as {
      processFrame: (f: { buffer: Buffer; timestamp: number }) => Promise<void>;
    };

    // Must NOT throw: a single student's failure is contained.
    await expect(
      sessionAny.processFrame({ buffer: JPEG, timestamp: Date.now() }),
    ).resolves.toBeUndefined();

    const called = processRecognition.mock.calls.map(
      (c) => (c[0] as { studentId: string }).studentId,
    );

    // Every student in the frame got its own attempt — the first rejection
    // did not short-circuit the loop.
    expect(new Set(called)).toEqual(new Set(STUDENTS));
    expect(called).toHaveLength(STUDENTS.length);
  });

  it('only loads templates whose enrollment is still ACTIVE', async () => {
    const faceEngine = makeFaceEngine();
    wirePipeline(faceEngine);

    const findMany = vi.fn().mockResolvedValue(makeTemplates());

    const session = makeSession({
      faceEngine,
      processRecognition: vi.fn().mockResolvedValue(undefined),
      findMany,
    });

    const sessionAny = session as unknown as {
      processFrame: (f: { buffer: Buffer; timestamp: number }) => Promise<void>;
    };

    await sessionAny.processFrame({ buffer: JPEG, timestamp: Date.now() });

    expect(findMany).toHaveBeenCalledTimes(1);
    const where = findMany.mock.calls[0][0].where;

    expect(where.organizationId).toBe('org-1');
    expect(where.status).toBe('ACTIVE');
    expect(where.enrollment).toEqual({ status: 'ACTIVE' });
  });

  it('claims the per-student cooldown so a failing DB is retried once per minute, not once per frame', async () => {
    const faceEngine = makeFaceEngine();
    wirePipeline(faceEngine);

    const processRecognition = vi
      .fn()
      .mockRejectedValue(new Error('database down'));
    const findMany = vi.fn().mockResolvedValue(makeTemplates());

    const session = makeSession({
      faceEngine,
      processRecognition,
      findMany,
    });

    const sessionAny = session as unknown as {
      processFrame: (f: { buffer: Buffer; timestamp: number }) => Promise<void>;
    };

    const frame = { buffer: JPEG, timestamp: Date.now() };
    await sessionAny.processFrame(frame);
    const afterFirst = processRecognition.mock.calls.length;

    // Same student, immediately next frame → suppressed by the cooldown.
    await sessionAny.processFrame(frame);

    expect(afterFirst).toBe(STUDENTS.length);
    expect(processRecognition.mock.calls.length).toBe(afterFirst);
  });
});
