import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOfflineFaceQueue } from '../useOfflineFaceQueue';

describe('useOfflineFaceQueue', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('initializes with an empty queue', () => {
    const { result } = renderHook(() => useOfflineFaceQueue());
    expect(result.current.queueCount).toBe(0);
    expect(result.current.queue).toEqual([]);
    expect(result.current.isSyncing).toBe(false);
  });

  it('enqueues items into the queue and stores in localStorage', () => {
    const { result } = renderHook(() => useOfflineFaceQueue());

    act(() => {
      const added = result.current.enqueue({
        sessionId: 'session-123',
        imageBase64: 'data:image/jpeg;base64,mockdata',
      });
      expect(added).toBe(true);
    });

    expect(result.current.queueCount).toBe(1);
    expect(result.current.queue[0].sessionId).toBe('session-123');

    const stored = JSON.parse(localStorage.getItem('medu_offline_face_queue') || '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0].sessionId).toBe('session-123');
  });

  it('syncs queue successfully when online', async () => {
    const { result } = renderHook(() => useOfflineFaceQueue());

    act(() => {
      result.current.enqueue({
        sessionId: 'session-1',
        imageBase64: 'data:image/jpeg;base64,frame1',
      });
      result.current.enqueue({
        sessionId: 'session-2',
        imageBase64: 'data:image/jpeg;base64,frame2',
      });
    });

    expect(result.current.queueCount).toBe(2);

    const mockSubmit = vi.fn().mockResolvedValue({ success: true });

    let syncResult: any;
    await act(async () => {
      syncResult = await result.current.syncQueue(mockSubmit);
    });

    expect(mockSubmit).toHaveBeenCalledTimes(2);
    expect(syncResult).toEqual({ synced: 2, failed: 0 });
    expect(result.current.queueCount).toBe(0);
  });

  it('retains failed items up to max retry count', async () => {
    const { result } = renderHook(() => useOfflineFaceQueue());

    act(() => {
      result.current.enqueue({
        sessionId: 'session-failing',
        imageBase64: 'data:image/jpeg;base64,frameFail',
      });
    });

    const mockSubmit = vi.fn().mockRejectedValue(new Error('Network error'));

    let syncResult: any;
    await act(async () => {
      syncResult = await result.current.syncQueue(mockSubmit);
    });

    expect(syncResult).toEqual({ synced: 0, failed: 1 });
    expect(result.current.queueCount).toBe(1);
    expect(result.current.queue[0].retryCount).toBe(1);
  });

  it('clears queue when clearQueue is invoked', () => {
    const { result } = renderHook(() => useOfflineFaceQueue());

    act(() => {
      result.current.enqueue({
        sessionId: 'session-1',
        imageBase64: 'data:image/jpeg;base64,frame1',
      });
      result.current.clearQueue();
    });

    expect(result.current.queueCount).toBe(0);
    expect(result.current.queue).toEqual([]);
    expect(localStorage.getItem('medu_offline_face_queue')).toBe('[]');
  });

  it('operates safely when localStorage quota is exceeded or storage is blocked', () => {
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = vi.fn().mockImplementation(() => {
      const err = new Error('QuotaExceededError');
      err.name = 'QuotaExceededError';
      throw err;
    });

    const { result } = renderHook(() => useOfflineFaceQueue());

    act(() => {
      const added = result.current.enqueue({
        sessionId: 'session-quota',
        imageBase64: 'data:image/jpeg;base64,largeFrame',
      });
      expect(added).toBe(true);
    });

    // In-memory queue remains intact even when storage throws
    expect(result.current.queueCount).toBe(1);
    expect(result.current.queue[0].sessionId).toBe('session-quota');

    localStorage.setItem = originalSetItem;
  });
});
