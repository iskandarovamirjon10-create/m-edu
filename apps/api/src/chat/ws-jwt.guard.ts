import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

export interface AuthenticatedUser {
  id: string;
  email: string;
  organizationId: string;
  role: string;
}

export interface AuthenticatedSocket extends Socket {
  user?: AuthenticatedUser;
}

@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client = context.switchToWs().getClient<AuthenticatedSocket>();
      
      if (client.user) {
        return true;
      }

      const token = this.extractToken(client);
      if (!token) {
        throw new WsException('Missing access token');
      }

      const secret = this.configService.get<string>('JWT_SECRET');
      if (!secret) {
        throw new Error('JWT_SECRET is not configured');
      }
      
      const payload = this.jwtService.verify(token, { secret });

      let authenticatedUser;

      if (payload.accountType === 'parent') {
        const parent = await this.prisma.parentAccount.findUnique({
          where: { id: payload.sub },
          select: { id: true, email: true, organizationId: true, isActive: true }
        });
        if (!parent || !parent.isActive) throw new WsException('Parent not found or deactivated');
        
        if (payload.sid) {
          const session = await this.prisma.parentSession.findUnique({ where: { id: payload.sid } });
          if (!session || session.revokedAt || session.expiresAt < new Date()) throw new WsException('Session expired or revoked');
          if (session.parentId !== parent.id || session.organizationId !== parent.organizationId) throw new WsException('Session binding mismatch');
        }
        
        authenticatedUser = {
          id: parent.id,
          email: parent.email,
          organizationId: parent.organizationId,
          role: 'PARENT'
        };
      } else {
        const user = await this.prisma.user.findUnique({
          where: { id: payload.sub },
          select: { id: true, email: true, organizationId: true, role: true, isActive: true },
        });
        if (!user || !user.isActive) throw new WsException('User not found or deactivated');

        if (payload.sid) {
          const session = await this.prisma.session.findUnique({ where: { id: payload.sid } });
          if (!session || session.revokedAt || session.expiresAt < new Date()) throw new WsException('Session expired or revoked');
          if (session.userId !== user.id || session.organizationId !== user.organizationId) throw new WsException('Session binding mismatch');
        }
        
        authenticatedUser = user;
      }

      client.user = authenticatedUser;
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`WebSocket auth failed: ${msg}`);
      throw new WsException('Unauthorized');
    }
  }

  private extractToken(client: AuthenticatedSocket): string | null {
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
}
