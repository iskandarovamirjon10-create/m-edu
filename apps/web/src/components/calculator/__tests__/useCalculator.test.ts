import { renderHook, act } from '@testing-library/react';
import { useCalculator } from '../useCalculator';
import { describe, it, expect } from 'vitest';

describe('useCalculator', () => {
  it('should handle basic addition', () => {
    const { result } = renderHook(() => useCalculator());

    act(() => { result.current.inputDigit('5'); });
    act(() => { result.current.performOperation('+'); });
    act(() => { result.current.inputDigit('3'); });
    act(() => { result.current.calculateEquals(); });

    expect(result.current.currentValue).toBe('8');
  });

  it('should handle percentage', () => {
    const { result } = renderHook(() => useCalculator());

    act(() => { result.current.inputDigit('5'); });
    act(() => { result.current.inputDigit('0'); });
    act(() => { result.current.inputPercent(); });

    expect(result.current.currentValue).toBe('0.5');
  });

  it('should handle division by zero (Infinity handled gracefully)', () => {
    const { result } = renderHook(() => useCalculator());

    act(() => { result.current.inputDigit('5'); });
    // Use the division symbol as declared in useCalculator.ts
    act(() => { result.current.performOperation('\u00f7' as any); });
    act(() => { result.current.inputDigit('0'); });
    act(() => { result.current.calculateEquals(); });

    expect(result.current.currentValue).toBe('Error');
  });

  it('should handle decimal inputs properly', () => {
    const { result } = renderHook(() => useCalculator());

    act(() => { result.current.inputDigit('5'); });
    act(() => { result.current.inputDot(); });
    act(() => { result.current.inputDigit('5'); });

    expect(result.current.currentValue).toBe('5.5');
  });

  it('should prevent multiple dots', () => {
    const { result } = renderHook(() => useCalculator());

    act(() => { result.current.inputDigit('5'); });
    act(() => { result.current.inputDot(); });
    act(() => { result.current.inputDigit('5'); });
    act(() => { result.current.inputDot(); });
    act(() => { result.current.inputDigit('5'); });

    expect(result.current.currentValue).toBe('5.55');
  });

  it('should handle educational prorate calculation', () => {
    const { result } = renderHook(() => useCalculator());

    // 1 200 000 tuition for 12 lessons, attended 6
    act(() => {
      '1200000'.split('').forEach((d) => result.current.inputDigit(d));
    });
    act(() => {
      result.current.calculateProrate(6, 12);
    });

    expect(result.current.currentValue).toBe('600000');
  });

  it('should handle teacher revenue split calculation', () => {
    const { result } = renderHook(() => useCalculator());

    // 1 000 000 with 45% teacher split
    act(() => {
      '1000000'.split('').forEach((d) => result.current.inputDigit(d));
    });
    act(() => {
      result.current.calculateTeacherShare(45);
    });

    expect(result.current.currentValue).toBe('450000');
  });

  it('should handle discount calculation', () => {
    const { result } = renderHook(() => useCalculator());

    // 1 000 000 with 15% discount
    act(() => {
      '1000000'.split('').forEach((d) => result.current.inputDigit(d));
    });
    act(() => {
      result.current.calculateDiscount(15);
    });

    expect(result.current.currentValue).toBe('850000');
  });
});
