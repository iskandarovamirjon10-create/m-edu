import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePersistSettings } from '../usePersistSettings';
import { usersApi } from '@/lib/api';
import * as AuthContextModule from '@/auth/AuthContext';

vi.mock('@/lib/api', () => ({
  usersApi: {
    updateSettings: vi.fn().mockResolvedValue({}),
  },
}));

describe('usePersistSettings (Regression: M-EDU-HOOK-001)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does NOT throw when rendered outside of <AuthProvider> (fail-safe)', () => {
    vi.spyOn(AuthContextModule, 'useOptionalAuthState').mockReturnValue(null);

    expect(() => {
      const { result } = renderHook(() => usePersistSettings());
      expect(result.current).toBeTypeOf('function');
    }).not.toThrow();
  });

  it('calling persist when unauthenticated or outside AuthProvider is a safe no-op', () => {
    vi.spyOn(AuthContextModule, 'useOptionalAuthState').mockReturnValue(null);

    const { result } = renderHook(() => usePersistSettings());
    act(() => {
      result.current({ language: 'uz', theme: 'dark' });
    });
    expect(usersApi.updateSettings).not.toHaveBeenCalled();
  });

  it('calling persist with empty settings is a no-op even if authenticated', () => {
    vi.spyOn(AuthContextModule, 'useOptionalAuthState').mockReturnValue({
      user: { id: 'usr-123', email: 'test@medu.uz', role: 'ADMIN', organizationId: 'org-1' },
      status: 'authenticated',
      loading: false,
    } as any);

    const { result } = renderHook(() => usePersistSettings());
    act(() => {
      result.current({});
    });
    expect(usersApi.updateSettings).not.toHaveBeenCalled();
  });

  it('persists preferences to usersApi when authenticated', () => {
    vi.spyOn(AuthContextModule, 'useOptionalAuthState').mockReturnValue({
      user: { id: 'usr-123', email: 'test@medu.uz', role: 'ADMIN', organizationId: 'org-1' },
      status: 'authenticated',
      loading: false,
    } as any);

    const { result } = renderHook(() => usePersistSettings());
    act(() => {
      result.current({ language: 'uz', theme: 'glass-dark' });
    });
    expect(usersApi.updateSettings).toHaveBeenCalledWith('usr-123', {
      language: 'uz',
      theme: 'glass-dark',
    });
  });
});
