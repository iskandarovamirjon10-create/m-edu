import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RedisPubSubService } from '../common/redis/redis-pubsub.service';
import { ChatGateway } from '../chat/chat.gateway';

export const SYNC_SESSION_REVOKED_EVENT = 'session:revoked';
export const SYNC_USER_SYNC_EVENT = 'user:sync';
const REDIS_SYNC_CHANNEL = 'medu:device_sync';

/**
 * A socket is authenticated ONCE, at `handleConnection`. Without a periodic
 * re-check a revoked/expired session (logout, admin revocation, password
 * reset) kept receiving per-user events until the client chose to close the
 * connection — revocation was therefore only advisory.
 */
const SESSION_REVALIDATE_INTERVAL_MS = 30_000;

export interface AuthenticatedSyncSocket extends Socket {
  user?: {
    id: string;
    email: string;
    organizationId: string;
    role: string;
    sid?: string;
  };
}

@Injectable()
@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/sync',
})
export class SyncGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnModuleDestroy
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(SyncGateway.name);

  /**
   * Identifies THIS process on the relay so a publisher never re-delivers its
   * own message (previously `emitSessionRevoked` emitted locally AND received
   * its own Redis echo, so every client was told twice).
   */
  private readonly relayOrigin = randomUUID();
  private revalidateTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    @Optional() private readonly redisPubSub?: RedisPubSubService,
    @Optional() @Inject(forwardRef(() => ChatGateway)) private readonly chatGateway?: ChatGateway,
  ) {}

  onModuleInit() {
    if (this.redisPubSub) {
      try {
        this.redisPubSub.subscribe(REDIS_SYNC_CHANNEL, (rawPayload) => {
          try {
            const data = JSON.parse(rawPayload);
            if (!data?.userId || !data?.event) return;
            // Our own publish already went out locally — do not echo it back.
            if (data.origin && data.origin === this.relayOrigin) return;

            this.server?.to(`user_${data.userId}`).emit(data.event, data.payload);
            this.chatGateway?.server?.to(`user_${data.userId}`).emit(data.event, data.payload);
          } catch (e) {
            this.logger.error('Failed to handle Redis sync message', e);
          }
        });
      } catch (err) {
        this.logger.warn('Could not subscribe to Redis sync channel', err);
      }
    }

    if (!this.revalidateTimer) {
      this.revalidateTimer = setInterval(() => {
        void this.revalidateConnectedSessions();
      }, SESSION_REVALIDATE_INTERVAL_MS);
      // A pending sweep must never hold the event loop open on shutdown.
      this.revalidateTimer.unref?.();
    }
  }

  onModuleDestroy() {
    if (this.revalidateTimer) {
      clearInterval(this.revalidateTimer);
      this.revalidateTimer = null;
    }
  }

  private extractToken(client: Socket): string | null {
    const authHeader = client.handshake.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.split(' ')[1];
    }

    if (client.handshake.auth?.token) {
      return client.handshake.auth.token;
    }

    const cookieHeader = client.handshake.headers.cookie;
    if (cookieHeader) {
      const cookies = cookieHeader.split(';').reduce<Record<string, string>>((acc, c) => {
        const [key, ...rest] = c.trim().split('=');
        if (key) acc[key] = rest.join('=');
        return acc;
      }, {});
      return cookies['access_token'] || null;
    }

    return null;
  }

  async handleConnection(client: AuthenticatedSyncSocket) {
    try {
      const token = this.extractToken(client);
      if (!token) throw new Error('No authentication token provided');

      const secret = this.configService.get<string>('JWT_SECRET');
      if (!secret) throw new Error('JWT_SECRET not configured');

      const payload = this.jwtService.verify(token, { secret });
      if (!payload || !payload.sub) throw new Error('Invalid token payload');

      if (payload.accountType === 'parent') {
        const parent = await this.prisma.parentAccount.findUnique({
          where: { id: payload.sub },
          select: { id: true, email: true, organizationId: true, isActive: true },
        });
        if (!parent || !parent.isActive) throw new Error('Parent not found or inactive');

        // Tokenâ†”account tenant binding (mirrors JwtStrategy): a token whose
        // organizationId disagrees with the account it names is rejected.
        if (payload.organizationId && payload.organizationId !== parent.organizationId) {
          throw new Error('Token organization mismatch');
        }

        // Session binding (mirrors JwtStrategy / WsJwtGuard): the `sid` in the
        // token must reference a live session for THIS parent and org. Without
        // this, a revoked/expired session kept a working /sync socket and its
        // owner kept receiving per-user sync events after logout or revocation.
        // Fail closed. `JwtStrategy` rejects every token without a `sid`, so a
        // socket that accepted one would be a strictly weaker surface than the
        // HTTP API it sits next to.
        if (!payload.sid) {
          throw new Error('Token missing sid');
        }
        {
          const session = await this.prisma.parentSession.findUnique({
            where: { id: payload.sid },
            select: { id: true, revokedAt: true, expiresAt: true, parentId: true, organizationId: true },
          });
          if (!session || session.revokedAt || session.expiresAt < new Date()) {
            throw new Error('Session expired or revoked');
          }
          if (session.parentId !== parent.id || session.organizationId !== parent.organizationId) {
            throw new Error('Session binding mismatch');
          }
        }

        client.user = {
          id: parent.id,
          email: parent.email,
          organizationId: parent.organizationId,
          role: 'PARENT',
          sid: payload.sid,
        };
      } else {
        const user = await this.prisma.user.findUnique({
          where: { id: payload.sub },
          select: { id: true, email: true, organizationId: true, role: true, isActive: true },
        });
        if (!user || !user.isActive) throw new Error('User not found or inactive');

        // Tokenâ†”account tenant binding (mirrors JwtStrategy).
        if (payload.organizationId && payload.organizationId !== user.organizationId) {
          throw new Error('Token organization mismatch');
        }

        // Session binding (mirrors JwtStrategy / WsJwtGuard).
        // Fail closed — see the parent branch above.
        if (!payload.sid) {
          throw new Error('Token missing sid');
        }
        {
          const session = await this.prisma.session.findUnique({
            where: { id: payload.sid },
            select: { id: true, revokedAt: true, expiresAt: true, userId: true, organizationId: true },
          });
          if (!session || session.revokedAt || session.expiresAt < new Date()) {
            throw new Error('Session expired or revoked');
          }
          if (session.userId !== user.id || session.organizationId !== user.organizationId) {
            throw new Error('Session binding mismatch');
          }
        }

        client.user = {
          id: user.id,
          email: user.email,
          organizationId: user.organizationId,
          role: user.role,
          sid: payload.sid,
        };
      }

      // Join room for this user across all their devices/tabs
      client.join(`user_${client.user.id}`);
      if (client.user.organizationId) {
        client.join(`org_${client.user.organizationId}`);
      }
      if (client.user.sid) {
        client.join(`session_${client.user.sid}`);
      }

      this.logger.debug(`Client ${client.id} joined sync rooms for user ${client.user.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.debug(`Rejecting unauthenticated sync connection: ${msg}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSyncSocket) {
    if (client.user) {
      this.logger.debug(`Sync client disconnected: ${client.id} (user: ${client.user.id})`);
    }
  }

  /**
   * Sockets owned by THIS process.
   *
   * `@WebSocketServer()` is typed as `Server` but Nest hands a gateway a
   * `Namespace` at runtime; the two expose the connection map at different
   * depths (`Server.sockets` is itself a Namespace). Resolve it structurally
   * instead of guessing, so a single wrong assumption cannot silently make the
   * re-validation sweep a no-op.
   */
  private localSockets(): AuthenticatedSyncSocket[] {
    const root = this.server?.sockets as unknown as
      | Map<string, AuthenticatedSyncSocket>
      | { sockets?: Map<string, AuthenticatedSyncSocket> }
      | undefined;

    if (!root) return [];
    if (root instanceof Map) return [...root.values()];
    return root.sockets ? [...root.sockets.values()] : [];
  }

  /**
   * Re-check every OPEN socket against the database.
   *
   * `handleConnection` is otherwise the only validation point, so a connection
   * that outlives its session (logout on another device, admin revocation,
   * password reset) kept receiving per-user events indefinitely.
   *
   * Two batched queries per sweep regardless of how many sockets are open —
   * no N+1, and a transient database error never tears down healthy sockets
   * (fail-open for availability; the next sweep re-checks them).
   */
  private async revalidateConnectedSessions(): Promise<void> {
    const connected = this.localSockets().filter((s) => Boolean(s.user));
    if (connected.length === 0) return;

    const now = new Date();

    try {
      const userIds = [...new Set(connected.map((s) => s.user!.id))];
      const sids = [
        ...new Set(
          connected
            .map((s) => s.user!.sid)
            .filter((sid): sid is string => typeof sid === 'string' && sid.length > 0),
        ),
      ];

      const [users, parents, sessions, parentSessions] = await Promise.all([
        this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: {
            id: true,
            organizationId: true,
            role: true,
            isActive: true,
            status: true,
          },
        }),
        this.prisma.parentAccount.findMany({
          where: { id: { in: userIds } },
          select: { id: true, organizationId: true, isActive: true },
        }),
        this.prisma.session.findMany({
          where: { id: { in: sids } },
          select: {
            id: true,
            userId: true,
            organizationId: true,
            revokedAt: true,
            expiresAt: true,
          },
        }),
        this.prisma.parentSession.findMany({
          where: { id: { in: sids } },
          select: {
            id: true,
            parentId: true,
            organizationId: true,
            revokedAt: true,
            expiresAt: true,
          },
        }),
      ]);

      const userById = new Map(users.map((u) => [u.id, u]));
      const parentById = new Map(parents.map((p) => [p.id, p]));
      const liveUserSids = new Set(
        sessions
          .filter((s) => !s.revokedAt && s.expiresAt > now)
          .map((s) => `${s.userId}|${s.id}`),
      );
      const liveParentSids = new Set(
        parentSessions
          .filter((s) => !s.revokedAt && s.expiresAt > now)
          .map((s) => `${s.parentId}|${s.id}`),
      );

      const stale: AuthenticatedSyncSocket[] = [];

      for (const socket of connected) {
        const principal = socket.user!;
        const isParent = principal.role === 'PARENT';
        const account = isParent ? parentById.get(principal.id) : userById.get(principal.id);
        const live = isParent
          ? liveParentSids.has(`${principal.id}|${principal.sid}`)
          : liveUserSids.has(`${principal.id}|${principal.sid}`);

        // Mirrors JwtStrategy exactly: account active, status ACTIVE, the
        // same organization as at connect time, and a live owning session.
        const statusOk =
          isParent ||
          (userById.get(principal.id)?.status ?? 'ACTIVE') === 'ACTIVE';
        const stillValid =
          Boolean(principal.sid) &&
          live &&
          account !== undefined &&
          account.isActive &&
          statusOk &&
          account.organizationId === principal.organizationId;

        if (!stillValid) {
          stale.push(socket);
          continue;
        }

        // A role demotion must not leave a stale principal on an open socket.
        const freshRole = isParent ? 'PARENT' : userById.get(principal.id)?.role;
        if (freshRole && freshRole !== principal.role) {
          principal.role = freshRole;
        }
      }

      // Disconnect AFTER the loop so mutating the socket map cannot skip
      // entries while we iterate it.
      for (const socket of stale) {
        this.logger.debug('Disconnecting sync socket: session no longer valid', {
          socketId: socket.id,
          userId: socket.user?.id,
        });
        socket.disconnect(true);
      }
    } catch (err: unknown) {
      this.logger.warn('Sync session re-validation failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  @SubscribeMessage('ping')
  handlePing() {
    return { event: 'pong', timestamp: Date.now() };
  }

  /**
   * Broadcast session revocation to the user's connected clients.
   * If sessionId is provided, that specific session was revoked.
   * If allOthers is true, all sessions EXCEPT exceptSessionId were revoked.
   */
  emitSessionRevoked(
    userId: string,
    sessionId: string | null,
    reason: string = 'revoked',
    exceptSessionId?: string,
  ) {
    const payload = {
      sessionId,
      reason,
      allOthers: !sessionId,
      exceptSessionId,
      timestamp: Date.now(),
    };

    // Emit locally to all sockets in the user's room
    if (this.server) {
      this.server.to(`user_${userId}`).emit(SYNC_SESSION_REVOKED_EVENT, payload);
    }

    // Also emit to ChatGateway room if active
    if (this.chatGateway?.server) {
      this.chatGateway.server.to(`user_${userId}`).emit(SYNC_SESSION_REVOKED_EVENT, payload);
    }

    // Publish to Redis for multi-instance deployments
    if (this.redisPubSub) {
      void this.redisPubSub
        .publish(
          REDIS_SYNC_CHANNEL,
          JSON.stringify({
            origin: this.relayOrigin,
            userId,
            event: SYNC_SESSION_REVOKED_EVENT,
            payload,
          }),
        )
        .catch((err: unknown) => {
          this.logger.warn('Failed to publish session revocation to Redis', err);
        });
    }
  }

  /**
   * Broadcast general user synchronization event (e.g. settings updated, profile updated).
   */
  emitUserSync(userId: string, data: { type: string; payload?: unknown }) {
    const eventPayload = {
      ...data,
      timestamp: Date.now(),
    };

    if (this.server) {
      this.server.to(`user_${userId}`).emit(SYNC_USER_SYNC_EVENT, eventPayload);
    }

    if (this.chatGateway?.server) {
      this.chatGateway.server.to(`user_${userId}`).emit(SYNC_USER_SYNC_EVENT, eventPayload);
    }

    if (this.redisPubSub) {
      void this.redisPubSub
        .publish(
          REDIS_SYNC_CHANNEL,
          JSON.stringify({
            origin: this.relayOrigin,
            userId,
            event: SYNC_USER_SYNC_EVENT,
            payload: eventPayload,
          }),
        )
        .catch((err: unknown) => {
          this.logger.warn('Failed to publish user sync to Redis', err);
        });
    }
  }
}


