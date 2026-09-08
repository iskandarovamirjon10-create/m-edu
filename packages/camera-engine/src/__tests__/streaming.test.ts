import { describe, it, expect } from 'vitest';
import {
  BoundedFrameQueue,
  CameraHealthTracker,
  FrameSampler,
  FfmpegStreamIngester,
} from '../index';
import type { VideoFrame } from '../types';

import { perceptualHash } from '../index';

const frame = (t: number): VideoFrame => ({ buffer: Buffer.from([1, 2, 3]), timestamp: t });

describe('BoundedFrameQueue', () => {
  it('drops oldest frame when capacity exceeded', () => {
    const q = new BoundedFrameQueue(2);
    q.push(frame(1));
    q.push(frame(2));
    const { dropped } = q.push(frame(3));
    expect(dropped).toBe(true);
    expect(q.size).toBe(2);
    expect(q.pop()?.timestamp).toBe(2);
    expect(q.pop()?.timestamp).toBe(3);
  });

  it('clears all frames', () => {
    const q = new BoundedFrameQueue(3);
    q.push(frame(1));
    q.push(frame(2));
    q.clear();
    expect(q.size).toBe(0);
    expect(q.pop()).toBeNull();
  });
});

describe('FrameSampler', () => {
  it('limits sampling rate', async () => {
    const sampler = new FrameSampler(1); // ~1 fps
    expect(sampler.shouldSample(frame(1))).toBe(true);
    expect(sampler.shouldSample(frame(2))).toBe(false); // too soon
  });

  it('acquires and releases lock exclusively', () => {
    const sampler = new FrameSampler(30);
    expect(sampler.acquireLock()).toBe(true);
    expect(sampler.acquireLock()).toBe(false); // already locked
    sampler.releaseLock();
    expect(sampler.acquireLock()).toBe(true);
  });
});

describe('CameraHealthTracker', () => {
  it('tracks frames and errors', () => {
    const tracker = new CameraHealthTracker('cam-1', 3);
    tracker.setStatus('ONLINE');
    tracker.recordFrameReceived();
    tracker.recordFrameProcessed();
    tracker.recordError(new Error('stream down'));

    const snap = tracker.getSnapshot();
    expect(snap.cameraId).toBe('cam-1');
    expect(snap.status).toBe('ERROR');
    expect(snap.framesReceived).toBe(1);
    expect(snap.framesProcessed).toBe(1);
    expect(snap.errors).toBe(1);
    expect(snap.lastErrorMessage).toBe('stream down');
  });

  it('reports frozenFrame=false before any frames are observed', () => {
    const tracker = new CameraHealthTracker('cam-1', 3);
    const snap = tracker.getSnapshot();
    expect(snap.frozenFrame).toBe(false);
    expect(snap.frozenFrameEvents).toBe(0);
    expect(snap.lastFrozenAt).toBeNull();
  });

  it('reports frozenFrame=true after repeated identical hashes fill the window', () => {
    const tracker = new CameraHealthTracker('cam-1', 3);
    const h = perceptualHash(Buffer.alloc(2048, 0x42));
    for (let i = 0; i < 30; i++) tracker.observeFrameHash(h);
    const snap = tracker.getSnapshot();
    expect(snap.frozenFrame).toBe(true);
    expect(snap.frozenFrameEvents).toBe(1);
    expect(snap.lastFrozenAt).not.toBeNull();
  });

  it('clears frozen state on resetFrozenFrameTracker', () => {
    const tracker = new CameraHealthTracker('cam-1', 3);
    const h = perceptualHash(Buffer.alloc(2048, 0x42));
    for (let i = 0; i < 30; i++) tracker.observeFrameHash(h);
    expect(tracker.getSnapshot().frozenFrame).toBe(true);
    tracker.resetFrozenFrameTracker();
    const snap = tracker.getSnapshot();
    expect(snap.frozenFrame).toBe(false);
    expect(snap.frozenFrameEvents).toBe(0);
    expect(snap.lastFrozenAt).toBeNull();
  });

  it('observeFrameHash returns true when frozen state is entered', () => {
    const tracker = new CameraHealthTracker('cam-1', 3);
    const h = perceptualHash(Buffer.alloc(2048, 0x42));
    const beforeFrozen = tracker.observeFrameHash(h);
    expect(beforeFrozen).toBe(false);
    for (let i = 1; i < 30; i++) tracker.observeFrameHash(h);
    const frozen = tracker.observeFrameHash(h);
    expect(frozen).toBe(true);
  });

  it('implements exponential reconnect backoff capped at 60s', () => {
    const tracker = new CameraHealthTracker('cam-1', 3);
    tracker.recordError(new Error('e1'));
    const d1 = tracker.getNextReconnectDelayMs();
    tracker.recordError(new Error('e2'));
    const d2 = tracker.getNextReconnectDelayMs();
    tracker.recordError(new Error('e3'));
    tracker.recordError(new Error('e4'));
    const d4 = tracker.getNextReconnectDelayMs();
    expect(d2).toBeGreaterThan(d1);
    expect(d4).toBeLessThanOrEqual(60000);
    expect(d4).toBeGreaterThan(d2);
  });
});

describe('FfmpegStreamIngester.buildArgs', () => {
  it('adds -rtsp_transport only for rtsp:// sources', () => {
    const rtsp = FfmpegStreamIngester.buildArgs('rtsp://192.168.1.10:554/ch1', 3, 'tcp');
    expect(rtsp[0]).toBe('-rtsp_transport');
    expect(rtsp[1]).toBe('tcp');
    expect(rtsp).toContain('-i');

    const http = FfmpegStreamIngester.buildArgs('http://cam/videostream.cgi', 3, 'tcp');
    expect(http).not.toContain('-rtsp_transport');
    expect(http).toContain('-i');

    const file = FfmpegStreamIngester.buildArgs('/tmp/fixture.jpg', 3, 'tcp');
    expect(file).not.toContain('-rtsp_transport');
  });

  it('caps output framerate between 1 and 30 fps', () => {
    const low = FfmpegStreamIngester.buildArgs('file.jpg', 0.1, 'tcp');
    expect(low).toContain('1');
    const high = FfmpegStreamIngester.buildArgs('file.jpg', 120, 'tcp');
    expect(high).toContain('30');
  });
});
