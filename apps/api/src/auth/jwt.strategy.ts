import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from './types';

function cookieExtractor(req: Request): string | null {
  const cookie = (req?.cookies as Record<string, string> | undefined)?.access_token;
  return cookie || null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        cookieExtractor,
      ]),
      ignoreExpiration: false,
      secretOrKey: (() => {
        const secret = configService.get('JWT_SECRET');
        if (!secret) {
          if (process.env.NODE_ENV === 'production') {
            throw new Error('JWT_SECRET must be set in production');
          }
          return 'medu-dev-secret-do-not-use-in-production';
        }
        if (process.env.NODE_ENV === 'production' && secret.length < 32) {
          throw new Error('JWT_SECRET must be at least 32 characters in production');
        }
        return secret;
      })(),
    });
  }

  async validate(payload: JwtPayload & { accountType?: string }) {
    // Parent tokens are resolved against the ParentAccount table
    if (payload.accountType === 'parent') {
      const parent = await this.prisma.parentAccount.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true, organizationId: true, isActive: true },
      });

      if (!parent || !parent.isActive) {
        throw new UnauthorizedException('Parent account not found or deactivated');
      }

      if (payload.organizationId !== parent.organizationId) {
        throw new UnauthorizedException('Token organization mismatch');
      }

      if (payload.sid) {
        const session = await this.prisma.parentSession.findUnique({
          where: { id: payload.sid },
          select: { id: true, revokedAt: true, expiresAt: true, parentId: true, organizationId: true },
        });
        if (!session || session.revokedAt || session.expiresAt < new Date()) {
          throw new UnauthorizedException('Session expired or revoked');
        }
        if (session.parentId !== parent.id || session.organizationId !== parent.organizationId) {
          throw new UnauthorizedException('Session binding mismatch');
        }
      }

      return {
        sub: parent.id,
        email: parent.email,
        role: 'PARENT',
        organizationId: parent.organizationId,
        sid: payload.sid ?? null,
      };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, organizationId: true, isActive: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or account deactivated');
    }

    if (payload.organizationId && payload.organizationId !== user.organizationId) {
      throw new UnauthorizedException('Token organization mismatch');
    }

    if (payload.sid) {
      const session = await this.prisma.session.findUnique({
        where: { id: payload.sid },
        select: { id: true, revokedAt: true, expiresAt: true, userId: true, organizationId: true },
      });
      if (!session || session.revokedAt || session.expiresAt < new Date()) {
        throw new UnauthorizedException('Session expired or revoked');
      }
      if (session.userId !== user.id || session.organizationId !== user.organizationId) {
        throw new UnauthorizedException('Session binding mismatch');
      }
    }

    return {
      sub: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      // Propagate the session id so controllers (e.g. logout) can revoke
      // the exact session that issued the token. Missing sid (legacy
      // tokens) is handled by callers.
      sid: payload.sid ?? null,
    };
  }
}
