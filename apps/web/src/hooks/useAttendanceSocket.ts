import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/auth/AuthContext';
import { getSocketBaseUrl } from '@/lib/socketUrl';
import { queryKeys } from '@/lib/query-keys.factory';

export interface AttendanceEventPayload {
  type: 'AttendanceCreated';
  organizationId: string;
  attendanceId: string;
  studentId: string;
  cameraId: string;
  status: string;
  timestamp: string;
  eventId: string;
}

export function useAttendanceSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAuthenticated) return;

    const socketInstance = io(`${getSocketBaseUrl()}/attendance`, {
      withCredentials: true,
      transports: ['websocket'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socketInstance.on('connect', () => {
      setIsConnected(true);
      // Invalidate history to reconcile any missed events during disconnect
      queryClient.invalidateQueries({ queryKey: queryKeys.face.history() });
      queryClient.invalidateQueries({ queryKey: queryKeys.face.all() });
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
    });

    socketInstance.on('attendance.created', (_payload: AttendanceEventPayload) => {
      // Invalidate queries using centralized query key registry
      queryClient.invalidateQueries({ queryKey: queryKeys.face.history() });
      queryClient.invalidateQueries({ queryKey: queryKeys.face.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.attendance.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.attendance.analyticsAll() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all() });
      
      // Opt 2 (Optional): Update local state or toast notification
      // We rely on React Query cache update to avoid duplicate render issues
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [isAuthenticated, queryClient]);

  return { isConnected, socket };
}
