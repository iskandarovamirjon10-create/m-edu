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

describe('RealEmbedder P1-1: SFace RGB/BGR Contract', () => {
  afterEach(() => {
    mockRun.mockClear();
  });

  it('swaps RGB channels to BGR for SFace during preprocessing', async () => {
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
    // Red pixel (0,0): RGB = 255, 0, 0 -> BGR = 0, 0, 255
    // Green pixel (1,0): RGB = 0, 255, 0 -> BGR = 0, 255, 0
    // Blue pixel (0,1): RGB = 0, 0, 255 -> BGR = 255, 0, 0
    // White pixel (1,1): RGB = 255, 255, 255 -> BGR = 255, 255, 255

    // c=0 (B):
    expect(data[0]).toBe(0);   // (0,0) Blue component of Red pixel is 0
    expect(data[1]).toBe(0);   // (1,0) Blue component of Green pixel is 0
    expect(data[2]).toBe(255); // (0,1) Blue component of Blue pixel is 255
    expect(data[3]).toBe(255); // (1,1) Blue component of White pixel is 255

    // c=1 (G):
    expect(data[4]).toBe(0);   // Green comp of Red pixel
    expect(data[5]).toBe(255); // Green comp of Green pixel
    expect(data[6]).toBe(0);   // Green comp of Blue pixel
    expect(data[7]).toBe(255); // Green comp of White pixel

    // c=2 (R):
    expect(data[8]).toBe(255); // Red comp of Red pixel
    expect(data[9]).toBe(0);   // Red comp of Green pixel
    expect(data[10]).toBe(0);  // Red comp of Blue pixel
    expect(data[11]).toBe(255);// Red comp of White pixel
  });
});
