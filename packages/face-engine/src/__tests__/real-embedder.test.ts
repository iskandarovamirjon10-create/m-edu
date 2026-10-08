import { describe, it, expect, vi, afterEach } from 'vitest';
import { RealEmbedder } from '../providers/real-embedder';
import * as ort from 'onnxruntime-node';
import * as fsLib from 'fs';
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(true),
    readFileSync: vi.fn((path) => {
      if (typeof path === 'string' && path.includes('test-rgb.png')) {
        return (actual as any).readFileSync(path);
      }
      return Buffer.from([]);
    }),
  };
});


import * as path from 'path';

// We just mock the ort.InferenceSession so it doesn't load a real model,
// we just want to spy on the tensor data.
const mockRun = vi.fn().mockResolvedValue({
  output: { data: new Float32Array(128).fill(0.5) }
});

vi.mock('onnxruntime-node', () => {
  return {
    InferenceSession: {
      create: vi.fn().mockResolvedValue({
        run: mockRun,
        inputNames: ['input'],
        outputNames: ['output']
      })
    },
    Tensor: class {
      type: string;
      data: any;
      dims: number[];
      constructor(type: string, data: any, dims: number[]) {
        this.type = type;
        this.data = data;
        this.dims = dims;
      }
    }
  };
});

describe('RealEmbedder P1-1: SFace RGB Contract', () => {
  afterEach(() => {
    mockRun.mockClear();
  });

  // OpenCV SFace feeds the network RGB (blobFromImage swapRB=true on a BGR
  // imread result). sharp already gives us RGB, so the tensor is passthrough.
  it('feeds RGB channel order (no BGR swap) to SFace during preprocessing', async () => {
    const embedder = new RealEmbedder({ modelPath: 'dummy-path',
      inputSize: 2,
      embeddingDimension: 128,
      normalize: true,
      mean: [0, 0, 0], // use 0 for easier math
      std: [1, 1, 1],  // use 1 for easier math
    });

    await embedder.initialize();

    const imgPath = path.join(__dirname, 'test-rgb.png');
    const image = fsLib.readFileSync(imgPath);

    // Create a mock bounding box that spans the whole 2x2 image
    await embedder.generateEmbedding({ imageBuffer: image, orientedWidth: 2, orientedHeight: 2, face: { boundingBox: { x: 0, y: 0, width: 2, height: 2 } } } as any);

    expect(mockRun).toHaveBeenCalled();
    const args = mockRun.mock.calls[0][0];
    const tensor = args['input'];

    expect(tensor.dims).toEqual([1, 3, 2, 2]); // NCHW

    const data = tensor.data as Float32Array;

    // We used: Red (255, 0, 0), Green (0, 255, 0), Blue (0, 0, 255), White (255, 255, 255)
    // SFace consumes RGB directly, so the tensor keeps RGB order.

    // c=0 (R):
    expect(data[0]).toBe(255); // (0,0) Red pixel, R component
    expect(data[1]).toBe(0);   // (1,0) Green pixel, R component
    expect(data[2]).toBe(0);   // (0,1) Blue pixel, R component
    expect(data[3]).toBe(255); // (1,1) White pixel, R component

    // c=1 (G):
    expect(data[4]).toBe(0);   // Green comp of Red pixel
    expect(data[5]).toBe(255); // Green comp of Green pixel
    expect(data[6]).toBe(0);   // Green comp of Blue pixel
    expect(data[7]).toBe(255); // Green comp of White pixel

    // c=2 (B):
    expect(data[8]).toBe(0);   // Blue comp of Red pixel
    expect(data[9]).toBe(0);   // Blue comp of Green pixel
    expect(data[10]).toBe(255);// Blue comp of Blue pixel
    expect(data[11]).toBe(255);// Blue comp of White pixel
  });
});

describe('RealEmbedder embedding dimension contract (regression: FE-1)', () => {
  afterEach(() => {
    mockRun.mockClear();
    mockRun.mockResolvedValue({
      output: { data: new Float32Array(128).fill(0.5) },
    });
  });

  const makeEmbedder = () =>
    new RealEmbedder({
      modelPath: 'dummy-path',
      inputSize: 2,
      embeddingDimension: 128,
      normalize: true,
      mean: [0, 0, 0],
      std: [1, 1, 1],
    });

  // A minimal valid 1x1 PNG so sharp decode succeeds before the embedding
  // dimension contract is evaluated.
  const image = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
  const face = { boundingBox: { x: 0, y: 0, width: 2, height: 2 } };

  it('throws when the model output dimension does not match configuration', async () => {
    mockRun.mockResolvedValue({ output: { data: new Float32Array(64).fill(0.5) } });
    const embedder = makeEmbedder();
    await embedder.initialize();
    await expect(
      embedder.generateEmbedding({ imageBuffer: image, face } as any),
    ).rejects.toThrow(/dimension mismatch/i);
  });

  it('throws on a degenerate (zero-norm) embedding instead of returning one', async () => {
    mockRun.mockResolvedValue({ output: { data: new Float32Array(128).fill(0) } });
    const embedder = makeEmbedder();
    await embedder.initialize();
    await expect(
      embedder.generateEmbedding({ imageBuffer: image, face } as any),
    ).rejects.toThrow(/norm is 0/i);
  });
});
