import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/auth/AuthContext';
import { getSocketBaseUrl } from '@/lib/socketUrl';
import { queryKeys } from '@/lib/query-keys.factory';

export interface AttendanceEventPayload {
  type?: string;
  organizationId: string;
  attendanceId: string;
  studentId: string;
  studentName?: string;
  groupName?: string;
  cameraId?: string;
  status?: string;
  recognizedAt?: string;
  timestamp?: string;
  eventId?: string;
}

let sharedSocket: Socket | null = null;
let subscribersCount = 0;

export function useAttendanceSocket() {
  const [socket, setSocket] = useState<Socket | null>(sharedSocket);
  const [isConnected, setIsConnected] = useState(Boolean(sharedSocket?.connected));
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAuthenticated) return;

    subscribersCount++;

    if (!sharedSocket) {
      sharedSocket = io(`${getSocketBaseUrl()}/attendance`, {
        withCredentials: true,
        transports: ['polling', 'websocket'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
      });
    }

    const currentSocket = sharedSocket;
    setSocket(currentSocket);
    setIsConnected(currentSocket.connected);

    const onConnect = () => {
      setIsConnected(true);
      queryClient.invalidateQueries({ queryKey: queryKeys.face.history() });
      queryClient.invalidateQueries({ queryKey: queryKeys.face.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.attendance.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.attendance.analyticsAll() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all() });
    };

    const onConnectError = () => {
      setIsConnected(false);
    };

    const onDisconnect = () => {
      setIsConnected(false);
    };

    const handleOnline = () => {
      if (!currentSocket.connected) {
        currentSocket.connect();
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
    }

    const onAttendanceCreated = (payload: AttendanceEventPayload) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.face.history() });
      queryClient.invalidateQueries({ queryKey: queryKeys.face.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.attendance.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.attendance.analyticsAll() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all() });

      if (typeof window !== 'undefined') {
        const timeStr = payload?.recognizedAt || payload?.timestamp
          ? new Date(payload.recognizedAt || payload.timestamp || Date.now()).toLocaleTimeString('uz-UZ', {
              hour: '2-digit',
              minute: '2-digit',
            })
          : new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });

        window.dispatchEvent(
          new CustomEvent('medu:attendance-logged', {
            detail: {
              id: payload?.attendanceId || payload?.studentId || 'attendance',
              name: payload?.studentName || "O'quvchi",
              group: payload?.groupName || '',
              time: timeStr,
            },
          }),
        );
      }
    };

    currentSocket.on('connect', onConnect);
    currentSocket.on('connect_error', onConnectError);
    currentSocket.on('disconnect', onDisconnect);
    currentSocket.on('attendance.created', onAttendanceCreated);

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
      }
      currentSocket.off('connect', onConnect);
      currentSocket.off('connect_error', onConnectError);
      currentSocket.off('disconnect', onDisconnect);
      currentSocket.off('attendance.created', onAttendanceCreated);

      subscribersCount--;
      if (subscribersCount <= 0) {
        subscribersCount = 0;
        currentSocket.disconnect();
        sharedSocket = null;
      }
    };
  }, [isAuthenticated, queryClient]);

  return { isConnected, socket };
}
