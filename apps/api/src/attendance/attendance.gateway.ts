import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { UseGuards, Logger, Injectable, OnModuleInit, Optional } from '@nestjs/common';
import { WsJwtGuard, AuthenticatedSocket } from '../chat/ws-jwt.guard';
import { RedisPubSubService } from '../common/redis/redis-pubsub.service';
import { JwtService } from '@nestjs/jwt';

export const ATTENDANCE_CREATED_EVENT = 'attendance.created';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/attendance',
})
@UseGuards(WsJwtGuard)
export class AttendanceGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(AttendanceGateway.name);

  constructor(
    @Optional() private readonly redisPubSub?: RedisPubSubService,
    private readonly jwtService?: JwtService,
  ) {}

  onModuleInit() {
    if (this.redisPubSub) {
      this.redisPubSub.subscribe(ATTENDANCE_CREATED_EVENT, (payload) => {
        try {
          const data = JSON.parse(payload);
          if (data && data.organizationId) {
            // Broadcase ONLY to the room matching organizationId
            this.server.to(`org:${data.organizationId}`).emit(ATTENDANCE_CREATED_EVENT, data);
          }
        } catch (err) {
          this.logger.error('Failed to parse attendance event payload', err);
        }
      });
    }
  }

  private extractToken(client: AuthenticatedSocket): string | null {
    const auth = client.handshake?.auth?.token || client.handshake?.headers?.authorization;
    if (!auth) return null;
    return auth.replace('Bearer ', '');
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token = this.extractToken(client);
      if (!token) throw new Error('No token');
      if (!this.jwtService) throw new Error('JWT service not available');
      const payload = this.jwtService.verify(token);
      client.user = payload;
      
      const organizationId = payload.organizationId;
      if (organizationId) {
        client.join(`org:${organizationId}`);
        this.logger.log(`Client ${client.id} joined attendance room org:${organizationId}`);
      } else {
        this.logger.warn(`Client ${client.id} authenticated but no organizationId found`);
      }
    } catch (err) {
      this.logger.warn(`Attendance Gateway Connection rejected: ${err.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.logger.log(`Client disconnected from attendance: ${client.id}`);
  }
}
