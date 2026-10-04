import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/auth/AuthContext';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

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

    const socketInstance = io(`${SOCKET_URL}/attendance`, {
      withCredentials: true,
      transports: ['websocket'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socketInstance.on('connect', () => {
      console.log('Connected to Realtime Attendance Gateway');
      setIsConnected(true);
      // Invalidate history to reconcile any missed events during disconnect
      queryClient.invalidateQueries({ queryKey: ['face', 'history'] });
    });

    socketInstance.on('disconnect', () => {
      console.warn('Disconnected from Realtime Attendance Gateway');
      setIsConnected(false);
    });

    socketInstance.on('attendance.created', (_payload: AttendanceEventPayload) => {
      // Opt 1: Invalidate queries to fetch the fresh list
      queryClient.invalidateQueries({ queryKey: ['face', 'history'] });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-analytics'] });
      
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
