/**
 * M-EDU Camera Pipeline Harness (software chain)
 * ---------------------------------------------
 * Validates the COMPLETE camera processing chain without physical hardware:
 *
 *   ffmpeg MJPEG stream -> FfmpegStreamIngester -> YuNet (detect)
 *     -> MiniFASNet (liveness) -> SFace (embedding)
 *
 * The stream source is a deterministic multi-frame MJPEG file generated from
 * the ground-truth real-face fixture (packages/face-engine/test-assets/image_T1.jpg),
 * so results are reproducible. This is the exact chain a physical camera
 * would feed; hardware validation steps are in docs/CAMERA-E2E.md.
 *
 * Usage:
 *   node packages/camera-engine/scripts/camera-pipeline-harness.mjs
 *
 * Exit code 0 = chain verified. Requires: ffmpeg on PATH, built packages
 * (turbo build), and the ONNX models under packages/face-engine/models.
 */
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const FIXTURE = join(ROOT, 'packages', 'face-engine', 'test-assets', 'image_T1.jpg');
const MODELS = join(ROOT, 'packages', 'face-engine', 'models');

const require = createRequire(HERE + '/');
const { FfmpegStreamIngester } = require(join(ROOT, 'packages', 'camera-engine', 'dist', 'streaming.js'));
const { RealFaceEngine } = require(join(ROOT, 'packages', 'face-engine', 'dist', 'providers', 'real-face-engine.js'));

// Generate a deterministic ~3s / 5fps MJPEG stream from the fixture.
const tmpDir = mkdtempSync(join(tmpdir(), 'medu-cam-harness-'));
const source = join(tmpDir, 'cam-src.mjpeg');
try {
  execFileSync('ffmpeg', [
    '-y', '-loop', '1', '-i', FIXTURE, '-an', '-t', '3', '-r', '5',
    '-f', 'mjpeg', '-q:v', '5', source,
  ], { stdio: 'ignore' });
} catch (e) {
  console.error('ffmpeg failed to generate the test stream:', e.message);
  console.error('Is ffmpeg installed and on PATH?');
  process.exit(2);
}

const engine = new RealFaceEngine({
  detectorModelPath: join(MODELS, 'face_detection_yunet_2023mar.onnx'),
  embedderModelPath: join(MODELS, 'face_recognition_sface_2021dec.onnx'),
  livenessModelPath: join(MODELS, 'minifasnet_v2.onnx'),
  embeddingDimension: 128,
});
await engine.initialize();

let frames = 0, detected = 0, livePassed = 0, embedded = 0;
let firstFace = null, settled = false, inflight = 0;

const result = await new Promise((resolve, reject) => {
  const ing = new FfmpegStreamIngester({ cameraId: 'harness-cam-1', streamUri: source, fps: 3 });
  const timeout = setTimeout(() => reject(new Error('harness timeout')), 25000);

  const settle = (fn) => { if (!settled) { settled = true; clearTimeout(timeout); ing.stop().then(fn); } };
  const maybeSettle = () => { if (inflight === 0 && !settled) settle(() => resolve({ frames, detected, livePassed, embedded, firstFace })); };

  ing.onFrame(async (frame) => {
    inflight++; frames++;
    try {
      const faces = await engine.detectFaces({ imageBuffer: frame.buffer, format: 'jpeg' });
      if (faces.length > 0) {
        detected++;
        const f = faces[0];
        const liveness = await engine.checkLiveness({ imageBuffer: frame.buffer, face: f });
        if (liveness.decision === 'PASS') livePassed++;
        const emb = await engine.generateEmbedding({ imageBuffer: frame.buffer, face: f, format: 'jpeg' });
        embedded++;
        if (!firstFace) firstFace = { confidence: f.confidence, liveness: liveness.decision, livenessConf: liveness.confidence, embDim: emb.getDimension() };
      }
    } catch (e) {
      settle(() => reject(e));
    } finally {
      inflight--;
      maybeSettle();
    }
  });
  ing.onError((e) => settle(() => reject(new Error('ingester error: ' + e.message))));
  ing.onClose(() => maybeSettle());
  ing.start().catch((e) => settle(() => reject(e)));
});

rmSync(tmpDir, { recursive: true, force: true });

console.log(JSON.stringify(result, null, 2));
if (result.frames < 3) throw new Error('too few frames ingested: ' + result.frames);
if (result.detected < 1) throw new Error('no face detected from stream frames');
if (result.livePassed < 1) throw new Error('liveness did not PASS on live fixture');
if (result.embedded < 1) throw new Error('no embedding generated');
console.log('CAMERA HARNESS CHAIN: OK (ffmpeg stream -> ingester -> YuNet -> MiniFASNet -> SFace)');
