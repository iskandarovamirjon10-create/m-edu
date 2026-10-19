import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AttendanceGateway, ATTENDANCE_CREATED_EVENT } from '../attendance.gateway';
import { JwtService } from '@nestjs/jwt';
import { RedisPubSubService } from '../../common/redis/redis-pubsub.service';
import { AuthenticatedSocket } from '../../chat/ws-jwt.guard';

describe('AttendanceGateway', () => {
  let gateway: AttendanceGateway;
  let jwtService: { verify: ReturnType<typeof vi.fn> };
  let redisPubSub: { subscribe: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    jwtService = {
      verify: vi.fn(),
    };
    redisPubSub = {
      subscribe: vi.fn(),
    };
    gateway = new AttendanceGateway(
      redisPubSub as unknown as RedisPubSubService,
      jwtService as unknown as JwtService,
    );
    gateway.server = {
      to: vi.fn().mockReturnThis(),
      emit: vi.fn(),
    } as any;
  });

  it('rejects connection if no token is provided in auth, headers, or cookies', async () => {
    const socket = {
      id: 'socket-1',
      handshake: {
        auth: {},
        headers: {},
      },
      disconnect: vi.fn(),
    } as unknown as AuthenticatedSocket;

    await gateway.handleConnection(socket);
    expect(socket.disconnect).toHaveBeenCalled();
  });

  it('authenticates with Bearer token in headers and joins org room', async () => {
    jwtService.verify.mockReturnValue({
      sub: 'user-1',
      organizationId: 'org-123',
      role: 'ADMIN',
    });

    const socket = {
      id: 'socket-2',
      handshake: {
        auth: {},
        headers: {
          authorization: 'Bearer valid.jwt.token',
        },
      },
      join: vi.fn(),
      disconnect: vi.fn(),
    } as unknown as AuthenticatedSocket;

    await gateway.handleConnection(socket);
    expect(jwtService.verify).toHaveBeenCalledWith('valid.jwt.token');
    expect(socket.join).toHaveBeenCalledWith('org:org-123');
    expect(socket.disconnect).not.toHaveBeenCalled();
    expect(socket.user).toEqual({
      sub: 'user-1',
      organizationId: 'org-123',
      role: 'ADMIN',
    });
  });

  it('authenticates with token in handshake.auth', async () => {
    jwtService.verify.mockReturnValue({
      sub: 'user-2',
      organizationId: 'org-456',
    });

    const socket = {
      id: 'socket-3',
      handshake: {
        auth: { token: 'auth.token.val' },
        headers: {},
      },
      join: vi.fn(),
      disconnect: vi.fn(),
    } as unknown as AuthenticatedSocket;

    await gateway.handleConnection(socket);
    expect(jwtService.verify).toHaveBeenCalledWith('auth.token.val');
    expect(socket.join).toHaveBeenCalledWith('org:org-456');
    expect(socket.disconnect).not.toHaveBeenCalled();
  });

  it('authenticates with access_token cookie fallback', async () => {
    jwtService.verify.mockReturnValue({
      sub: 'user-3',
      organizationId: 'org-789',
    });

    const socket = {
      id: 'socket-4',
      handshake: {
        auth: {},
        headers: {
          cookie: 'session_id=abc; access_token=cookie.jwt.val; other=123',
        },
      },
      join: vi.fn(),
      disconnect: vi.fn(),
    } as unknown as AuthenticatedSocket;

    await gateway.handleConnection(socket);
    expect(jwtService.verify).toHaveBeenCalledWith('cookie.jwt.val');
    expect(socket.join).toHaveBeenCalledWith('org:org-789');
    expect(socket.disconnect).not.toHaveBeenCalled();
  });

  it('disconnects if token verification fails', async () => {
    jwtService.verify.mockImplementation(() => {
      throw new Error('Token expired');
    });

    const socket = {
      id: 'socket-5',
      handshake: {
        auth: { token: 'expired.token' },
        headers: {},
      },
      join: vi.fn(),
      disconnect: vi.fn(),
    } as unknown as AuthenticatedSocket;

    await gateway.handleConnection(socket);
    expect(socket.disconnect).toHaveBeenCalled();
    expect(socket.join).not.toHaveBeenCalled();
  });

  it('disconnects if authenticated payload lacks organizationId', async () => {
    jwtService.verify.mockReturnValue({
      sub: 'user-no-org',
    });

    const socket = {
      id: 'socket-6',
      handshake: {
        auth: { token: 'valid.token' },
        headers: {},
      },
      join: vi.fn(),
      disconnect: vi.fn(),
    } as unknown as AuthenticatedSocket;

    await gateway.handleConnection(socket);
    expect(socket.disconnect).toHaveBeenCalled();
    expect(socket.join).not.toHaveBeenCalled();
  });

  it('broadcasts attendance events to org-scoped room via Redis pubsub', () => {
    let messageHandler: (payload: string) => void = () => {};
    redisPubSub.subscribe.mockImplementation((event, handler) => {
      if (event === ATTENDANCE_CREATED_EVENT) {
        messageHandler = handler;
      }
    });

    gateway.onModuleInit();
    expect(redisPubSub.subscribe).toHaveBeenCalledWith(
      ATTENDANCE_CREATED_EVENT,
      expect.any(Function),
    );

    const eventPayload = {
      attendanceId: 'att-1',
      studentId: 'stud-1',
      organizationId: 'org-tenant-a',
    };
    messageHandler(JSON.stringify(eventPayload));

    expect(gateway.server.to).toHaveBeenCalledWith('org:org-tenant-a');
    expect(gateway.server.emit).toHaveBeenCalledWith(ATTENDANCE_CREATED_EVENT, eventPayload);
  });
});
