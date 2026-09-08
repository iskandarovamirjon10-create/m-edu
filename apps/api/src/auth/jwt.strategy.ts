import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

function cookieExtractor(req: any) {
  const cookie = req?.cookies?.access_token || req?.cookies?.['access_token'];
  if (cookie) return cookie;
  // Breaking: do NOT fall back to Authorization header.
  return null;
}
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from './types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: any) => {
          const cookie = req?.cookies?.access_token || req?.cookies?.['access_token'];
          return cookie || null;
        },
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

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, organizationId: true, isActive: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or account deactivated');
    }

    if (payload.sid) {
      const session = await this.prisma.session.findUnique({
        where: { id: payload.sid },
        select: { id: true, revokedAt: true, expiresAt: true },
      });
      if (!session || session.revokedAt || session.expiresAt < new Date()) {
        throw new UnauthorizedException('Session expired or revoked');
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
