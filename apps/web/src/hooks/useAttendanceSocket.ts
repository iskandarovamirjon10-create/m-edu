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
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 10,
        reconnectionDelay: 2000,
      });
    }

    const currentSocket = sharedSocket;
    setSocket(currentSocket);
    setIsConnected(currentSocket.connected);

    const onConnect = () => {
      setIsConnected(true);
      queryClient.invalidateQueries({ queryKey: queryKeys.face.history() });
      queryClient.invalidateQueries({ queryKey: queryKeys.face.all() });
    };

    const onConnectError = () => {
      setIsConnected(false);
    };

    const onDisconnect = () => {
      setIsConnected(false);
    };

    const onAttendanceCreated = (_payload: AttendanceEventPayload) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.face.history() });
      queryClient.invalidateQueries({ queryKey: queryKeys.face.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.attendance.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.attendance.analyticsAll() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all() });
    };

    currentSocket.on('connect', onConnect);
    currentSocket.on('connect_error', onConnectError);
    currentSocket.on('disconnect', onDisconnect);
    currentSocket.on('attendance.created', onAttendanceCreated);

    return () => {
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
