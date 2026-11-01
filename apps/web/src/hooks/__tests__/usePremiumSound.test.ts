import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  usePremiumSound,
  setAudioMuted,
  setAudioVolume,
  setHapticsEnabled,
  isAudioMuted,
  getAudioVolume,
  isHapticsEnabled,
  ACOUSTIC_PRESET_NAMES,
} from '../usePremiumSound';

describe('usePremiumSound Spatial Acoustic Engine', () => {
  beforeEach(() => {
    localStorage.clear();
    setAudioMuted(false);
    setAudioVolume(0.8);
    setHapticsEnabled(true);
  });

  it('provides default sound states (unmuted, volume 80%, haptics enabled)', () => {
    const { result } = renderHook(() => usePremiumSound());
    expect(result.current.isMuted).toBe(false);
    expect(result.current.volume).toBe(0.8);
    expect(result.current.hapticsEnabled).toBe(true);
  });

  it('allows toggling and updating mute state reactively', () => {
    const { result } = renderHook(() => usePremiumSound());

    act(() => {
      result.current.toggleMute();
    });

    expect(result.current.isMuted).toBe(true);
    expect(isAudioMuted()).toBe(true);

    act(() => {
      result.current.setMuted(false);
    });

    expect(result.current.isMuted).toBe(false);
    expect(isAudioMuted()).toBe(false);
  });

  it('clamps and updates volume properly within [0, 1]', () => {
    const { result } = renderHook(() => usePremiumSound());

    act(() => {
      result.current.setVolume(0.5);
    });
    expect(result.current.volume).toBe(0.5);
    expect(getAudioVolume()).toBe(0.5);

    // Clamp over 1
    act(() => {
      result.current.setVolume(1.8);
    });
    expect(result.current.volume).toBe(1.0);

    // Clamp below 0
    act(() => {
      result.current.setVolume(-0.4);
    });
    expect(result.current.volume).toBe(0.0);
  });

  it('updates haptics preference', () => {
    const { result } = renderHook(() => usePremiumSound());

    act(() => {
      result.current.setHapticsEnabled(false);
    });
    expect(result.current.hapticsEnabled).toBe(false);
    expect(isHapticsEnabled()).toBe(false);

    act(() => {
      result.current.setHapticsEnabled(true);
    });
    expect(result.current.hapticsEnabled).toBe(true);
    expect(isHapticsEnabled()).toBe(true);
  });

  it('calls all acoustic presets without throwing exceptions', () => {
    const { result } = renderHook(() => usePremiumSound());

    expect(() => {
      act(() => {
        result.current.playTick();
        result.current.playPop();
        result.current.playSuccess();
        result.current.playError();
        result.current.playNotification();
        result.current.playCelebration();
        result.current.playShutter();
        result.current.playPayment();
        result.current.playSwitch();
        result.current.playSent();
        result.current.playDelete();
        result.current.playFaceIdMatch();
        result.current.playFaceIdDenied();
        result.current.playFaceIdDuplicate();
        result.current.playLaserScan();
        result.current.playCustomTone(440, 'sine', 0.05, 0.05);
      });
    }).not.toThrow();
  });

  it('dispatches every preset via playPreset() without error', () => {
    const { result } = renderHook(() => usePremiumSound());

    expect(() => {
      act(() => {
        for (const preset of ACOUSTIC_PRESET_NAMES) {
          result.current.playPreset(preset);
        }
      });
    }).not.toThrow();
  });
});
