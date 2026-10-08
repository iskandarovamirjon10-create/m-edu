/**
 * Regression tests:
 *
 * Disabling or deleting a camera MUST stop its running worker first.
 *
 * Otherwise a worker can continue ingesting frames, performing face
 * recognition and potentially recording attendance even after the camera
 * has been disabled or deleted.
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
  createCamera: ReturnType<typeof vi.fn>;
  listCameras: ReturnType<typeof vi.fn>;
  getCamera: ReturnType<typeof vi.fn>;
  updateCamera: ReturnType<typeof vi.fn>;
  assertCameraDeletable: ReturnType<typeof vi.fn>;
  enableCamera: ReturnType<typeof vi.fn>;
  disableCamera: ReturnType<typeof vi.fn>;
  deleteCamera: ReturnType<typeof vi.fn>;
  testCameraConnection: ReturnType<typeof vi.fn>;
  discoverCameras: ReturnType<typeof vi.fn>;
  getCameraHealth: ReturnType<typeof vi.fn>;
  getCameraEvents: ReturnType<typeof vi.fn>;
  updateCameraConfig: ReturnType<typeof vi.fn>;
}

interface WorkerManagerMock {
  startWorker: ReturnType<typeof vi.fn>;
  stopWorker: ReturnType<typeof vi.fn>;
  restartWorker: ReturnType<typeof vi.fn>;
  getWorkerStatus: ReturnType<typeof vi.fn>;
}

function makeReq(
  organizationId = 'org-1',
): AuthenticatedRequest {
  return {
    user: {
      organizationId,
    },
  };
}

function makeController(): {
  controller: CameraController;
  cameraService: CameraServiceMock;
  workerManager: WorkerManagerMock;
} {
  const cameraService: CameraServiceMock = {
    createCamera: vi.fn(),
    listCameras: vi.fn(),
    getCamera: vi.fn(),
    updateCamera: vi.fn(),

    assertCameraDeletable: vi
      .fn()
      .mockResolvedValue(undefined),

    enableCamera: vi.fn().mockResolvedValue({
      id: 'cam-1',
      enabled: true,
    }),

    disableCamera: vi.fn().mockResolvedValue({
      id: 'cam-1',
      enabled: false,
    }),

    deleteCamera: vi.fn().mockResolvedValue({
      success: true,
    }),

    testCameraConnection: vi.fn(),
    discoverCameras: vi.fn(),
    getCameraHealth: vi.fn(),
    getCameraEvents: vi.fn(),
    updateCameraConfig: vi.fn(),
  };

  const workerManager: WorkerManagerMock = {
    startWorker: vi.fn(),
    stopWorker: vi.fn().mockResolvedValue(undefined),
    restartWorker: vi.fn(),
    getWorkerStatus: vi.fn(),
  };

  const controller = new CameraController(
    cameraService,
    workerManager,
  );

  return {
    controller,
    cameraService,
    workerManager,
  };
}

describe('CameraController — worker lifecycle on disable/delete', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('disableCamera()', () => {
    it('stops the worker before disabling the camera', async () => {
      const {
        controller,
        cameraService,
        workerManager,
      } = makeController();

      await controller.disableCamera(
        makeReq(),
        'cam-1',
      );

      expect(
        workerManager.stopWorker,
      ).toHaveBeenCalledTimes(1);

      expect(
        workerManager.stopWorker,
      ).toHaveBeenCalledWith(
        'org-1',
        'cam-1',
      );

      expect(
        cameraService.disableCamera,
      ).toHaveBeenCalledTimes(1);

      expect(
        cameraService.disableCamera,
      ).toHaveBeenCalledWith(
        'org-1',
        'cam-1',
      );

      const stopOrder =
        workerManager.stopWorker.mock.invocationCallOrder[0];

      const disableOrder =
        cameraService.disableCamera.mock.invocationCallOrder[0];

      expect(stopOrder).toBeLessThan(disableOrder);
    });

    it('does not disable the camera when worker shutdown fails', async () => {
      const {
        controller,
        cameraService,
        workerManager,
      } = makeController();

      workerManager.stopWorker.mockRejectedValueOnce(
        new Error('worker shutdown failed'),
      );

      await expect(
        controller.disableCamera(
          makeReq(),
          'cam-1',
        ),
      ).rejects.toThrow(
        'worker shutdown failed',
      );

      expect(
        workerManager.stopWorker,
      ).toHaveBeenCalledTimes(1);

      expect(
        cameraService.disableCamera,
      ).not.toHaveBeenCalled();
    });

    it('does not accidentally stop another organization worker', async () => {
      const {
        controller,
        cameraService,
        workerManager,
      } = makeController();

      await controller.disableCamera(
        makeReq('org-target'),
        'cam-1',
      );

      expect(
        workerManager.stopWorker,
      ).toHaveBeenCalledWith(
        'org-target',
        'cam-1',
      );

      expect(
        cameraService.disableCamera,
      ).toHaveBeenCalledWith(
        'org-target',
        'cam-1',
      );
    });

    it('stops exactly one worker for one disable request', async () => {
      const {
        controller,
        workerManager,
      } = makeController();

      await controller.disableCamera(
        makeReq(),
        'cam-1',
      );

      expect(
        workerManager.stopWorker,
      ).toHaveBeenCalledTimes(1);
    });
  });

  describe('deleteCamera()', () => {
    it('stops the worker before deleting the camera', async () => {
      const {
        controller,
        cameraService,
        workerManager,
      } = makeController();

      await controller.deleteCamera(
        makeReq(),
        'cam-1',
      );

      expect(
        workerManager.stopWorker,
      ).toHaveBeenCalledTimes(1);

      expect(
        workerManager.stopWorker,
      ).toHaveBeenCalledWith(
        'org-1',
        'cam-1',
      );

      expect(
        cameraService.deleteCamera,
      ).toHaveBeenCalledTimes(1);

      expect(
        cameraService.deleteCamera,
      ).toHaveBeenCalledWith(
        'org-1',
        'cam-1',
      );

      const stopOrder =
        workerManager.stopWorker.mock.invocationCallOrder[0];

      const deleteOrder =
        cameraService.deleteCamera.mock.invocationCallOrder[0];

      expect(stopOrder).toBeLessThan(deleteOrder);
    });

    it('does not delete the camera when worker shutdown fails', async () => {
      const {
        controller,
        cameraService,
        workerManager,
      } = makeController();

      workerManager.stopWorker.mockRejectedValueOnce(
        new Error('worker shutdown failed'),
      );

      await expect(
        controller.deleteCamera(
          makeReq(),
          'cam-1',
        ),
      ).rejects.toThrow(
        'worker shutdown failed',
      );

      expect(
        workerManager.stopWorker,
      ).toHaveBeenCalledTimes(1);

      expect(
        cameraService.deleteCamera,
      ).not.toHaveBeenCalled();
    });

    it('preserves tenant isolation during deletion', async () => {
      const {
        controller,
        cameraService,
        workerManager,
      } = makeController();

      await controller.deleteCamera(
        makeReq('org-secure'),
        'cam-sensitive',
      );

      expect(
        workerManager.stopWorker,
      ).toHaveBeenCalledWith(
        'org-secure',
        'cam-sensitive',
      );

      expect(
        cameraService.deleteCamera,
      ).toHaveBeenCalledWith(
        'org-secure',
        'cam-sensitive',
      );
    });

    it('stops exactly one worker before one delete operation', async () => {
      const {
        controller,
        cameraService,
        workerManager,
      } = makeController();

      await controller.deleteCamera(
        makeReq(),
        'cam-1',
      );

      expect(
        workerManager.stopWorker,
      ).toHaveBeenCalledTimes(1);

      expect(
        cameraService.deleteCamera,
      ).toHaveBeenCalledTimes(1);
    });
  });

  describe('enableCamera()', () => {
    it('does not stop an existing worker', async () => {
      const {
        controller,
        workerManager,
        cameraService,
      } = makeController();

      await controller.enableCamera(
        makeReq(),
        'cam-1',
      );

      expect(
        workerManager.stopWorker,
      ).not.toHaveBeenCalled();

      expect(
        cameraService.enableCamera,
      ).toHaveBeenCalledWith(
        'org-1',
        'cam-1',
      );
    });

    it('does not start a worker implicitly', async () => {
      const {
        controller,
        workerManager,
      } = makeController();

      await controller.enableCamera(
        makeReq(),
        'cam-1',
      );

      expect(
        workerManager.startWorker,
      ).not.toHaveBeenCalled();
    });
  });
});
