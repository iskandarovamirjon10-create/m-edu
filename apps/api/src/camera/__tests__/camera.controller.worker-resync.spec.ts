/**
 * Regression tests: the camera CRUD endpoints must keep the worker registry in
 * step with the database.
 *
 * `CameraWorkerSession` captures its whole configuration once, at start — stream
 * URI, decrypted credentials, fps, similarity threshold and the
 * recognition/attendance flags. `updateCamera` and `updateCameraConfig` only
 * write the database, and `enableCamera` only flips a flag, while workers are
 * started in bulk by `startEnabledCameras()` at boot.
 *
 * Consequences these tests lock down:
 *   - enable: a re-enabled camera reported "enabled" but recorded nothing until
 *     the API was restarted.
 *   - update: a rotated camera password or moved stream path kept using the old
 *     values until the API was restarted.
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
} from 'vitest';

import { CameraController } from '../camera.controller';

interface AuthenticatedRequest {
  user: {
    organizationId: string;
  };
}

interface CameraServiceMock {
  updateCamera: ReturnType<typeof vi.fn>;
  enableCamera: ReturnType<typeof vi.fn>;
  updateCameraConfig: ReturnType<typeof vi.fn>;
}

interface WorkerManagerMock {
  startWorker: ReturnType<typeof vi.fn>;
  restartWorker: ReturnType<typeof vi.fn>;
  getWorkerStatus: ReturnType<typeof vi.fn>;
}

function makeReq(organizationId = 'org-1'): AuthenticatedRequest {
  return { user: { organizationId } };
}

function makeController(options: {
  recognitionEnabled?: boolean;
  workerRunning?: boolean;
} = {}): {
  controller: CameraController;
  cameraService: CameraServiceMock;
  workerManager: WorkerManagerMock;
} {
  const { recognitionEnabled = true, workerRunning = true } = options;

  const cameraService: CameraServiceMock = {
    updateCamera: vi.fn().mockResolvedValue({
      id: 'cam-1',
      enabled: true,
      recognitionEnabled,
    }),
    enableCamera: vi.fn().mockResolvedValue({
      id: 'cam-1',
      enabled: true,
      recognitionEnabled,
    }),
    updateCameraConfig: vi.fn().mockResolvedValue({
      id: 'cam-1',
      enabled: true,
      recognitionEnabled,
    }),
  };

  const workerManager: WorkerManagerMock = {
    startWorker: vi.fn().mockResolvedValue(undefined),
    restartWorker: vi.fn().mockResolvedValue(undefined),
    getWorkerStatus: vi.fn().mockResolvedValue({ running: workerRunning }),
  };

  const controller = new CameraController(
    cameraService as never,
    workerManager as never,
  );

  return { controller, cameraService, workerManager };
}

describe('CameraController — worker registry stays in step with the database', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('enableCamera()', () => {
    it('starts the recognition worker for a camera that has recognition enabled', async () => {
      const { controller, workerManager } = makeController({
        recognitionEnabled: true,
      });

      await controller.enableCamera(makeReq(), 'cam-1');

      expect(workerManager.startWorker).toHaveBeenCalledTimes(1);
      expect(workerManager.startWorker).toHaveBeenCalledWith('org-1', 'cam-1');
    });

    it('does not start a worker when recognition is disabled', async () => {
      const { controller, workerManager } = makeController({
        recognitionEnabled: false,
      });

      await controller.enableCamera(makeReq(), 'cam-1');

      expect(workerManager.startWorker).not.toHaveBeenCalled();
    });

    it('still enables the camera when the worker cannot start', async () => {
      const { controller, cameraService, workerManager } = makeController();
      workerManager.startWorker.mockRejectedValueOnce(
        new Error('Global camera worker capacity reached'),
      );

      const result = await controller.enableCamera(makeReq(), 'cam-1');

      // The stored flag is the durable outcome: a worker that cannot start must
      // not undo the operator's action.
      expect(cameraService.enableCamera).toHaveBeenCalledWith('org-1', 'cam-1');
      expect(result).toEqual({
        id: 'cam-1',
        enabled: true,
        recognitionEnabled: true,
      });
    });
  });

  describe('updateCamera()', () => {
    it('restarts a running worker so the new configuration takes effect', async () => {
      const { controller, workerManager } = makeController({
        workerRunning: true,
      });

      await controller.updateCamera(makeReq(), 'cam-1', {} as never);

      expect(workerManager.getWorkerStatus).toHaveBeenCalledWith('org-1', 'cam-1');
      expect(workerManager.restartWorker).toHaveBeenCalledWith('org-1', 'cam-1');
    });

    it('does not create a worker for a camera that is not running', async () => {
      const { controller, workerManager } = makeController({
        workerRunning: false,
      });

      await controller.updateCamera(makeReq(), 'cam-1', {} as never);

      expect(workerManager.restartWorker).not.toHaveBeenCalled();
      expect(workerManager.startWorker).not.toHaveBeenCalled();
    });

    it('does not fail the update when the worker cannot restart', async () => {
      const { controller, cameraService, workerManager } = makeController();
      workerManager.restartWorker.mockRejectedValueOnce(
        new Error('Camera worker lifecycle operation already in progress'),
      );

      const result = await controller.updateCamera(
        makeReq(),
        'cam-1',
        {} as never,
      );

      expect(cameraService.updateCamera).toHaveBeenCalled();
      expect(result).toEqual({
        id: 'cam-1',
        enabled: true,
        recognitionEnabled: true,
      });
    });
  });

  describe('updateCameraConfig()', () => {
    it('restarts a running worker so the new thresholds apply', async () => {
      const { controller, workerManager } = makeController({
        workerRunning: true,
      });

      await controller.updateConfig(makeReq(), 'cam-1', {} as never);

      expect(workerManager.restartWorker).toHaveBeenCalledWith('org-1', 'cam-1');
    });
  });
});
