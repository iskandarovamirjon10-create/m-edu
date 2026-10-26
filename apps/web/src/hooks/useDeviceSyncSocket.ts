import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/auth/AuthContext';
import { useToasts } from '@/components/ui';
import { useI18n } from '@/i18n/I18nProvider';
import { authApi } from '@/lib/api';
import { getSocketBaseUrl } from '@/lib/socketUrl';

export interface SessionRevokedPayload {
  sessionId: string | null;
  reason: string;
  allOthers?: boolean;
  exceptSessionId?: string;
  timestamp: number;
}

export interface UserSyncPayload {
  type: string;
  payload?: unknown;
  timestamp: number;
}

/**
 * Real-time device synchronization hook.
 * Synchronizes sessions, active device status, and user settings across all devices
 * connected under the same user account.
 *
 * NOTE: Uses refs for all internal socket management to guarantee ZERO extra re-renders
 * on host components, completely preventing any "Maximum update depth exceeded" loops.
 */
export function useDeviceSyncSocket() {
  const { isAuthenticated, user, logout } = useAuth();
  const queryClient = useQueryClient();
  const { push } = useToasts();
  const { t } = useI18n();

  const pushRef = useRef(push);
  pushRef.current = push;

  const tRef = useRef(t);
  tRef.current = t;

  const logoutRef = useRef(logout);
  logoutRef.current = logout;

  const socketRef = useRef<Socket | null>(null);
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    // Reuse existing socket if already connected
    if (socketRef.current?.connected) {
      return;
    }

    const socketInstance = io(`${getSocketBaseUrl()}/sync`, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2500,
      timeout: 10000,
      autoConnect: true,
    });

    socketRef.current = socketInstance;

    socketInstance.on('connect', () => {
      // Re-fetch sessions on reconnection
      queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] });
    });

    socketInstance.on('connect_error', () => {
      // Graceful degradation when offline or backend sync gateway not yet ready
    });

    socketInstance.on('session:revoked', async () => {
      // Invalidate active sessions list across all open tabs
      queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] });

      // Check if this device's own session was revoked by another device
      try {
        await authApi.me();
      } catch (err: unknown) {
        const status = (err as { status?: number })?.status;
        if (status === 401 || status === 403) {
          pushRef.current({
            type: 'error',
            title: tRef.current('settings.devices.sessionRevokedTitle', 'Sessiya yakunlandi'),
            message: tRef.current(
              'settings.devices.sessionRevokedRemote',
              'Sizning sessiyangiz boshqa qurilma orqali yakunlandi. Iltimos qayta kiring.',
            ),
          });
          if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
          logoutTimerRef.current = setTimeout(() => {
            logoutRef.current({ redirect: true });
          }, 1200);
        }
      }
    });

    socketInstance.on('user:sync', () => {
      // Invalidate user profile and settings so changes mirror instantly on this device
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      queryClient.invalidateQueries({ queryKey: ['user', 'settings'] });
      queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] });
    });

    return () => {
      if (logoutTimerRef.current) {
        clearTimeout(logoutTimerRef.current);
        logoutTimerRef.current = null;
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [isAuthenticated, user?.id, queryClient]);

  return { socket: socketRef.current };
}
