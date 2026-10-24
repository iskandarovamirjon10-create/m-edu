import { Injectable, UnauthorizedException, Optional } from '@nestjs/common';
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

interface ValidationCacheEntry {
  principal: {
    sub: string;
    id: string;
    email: string;
    role: string;
    organizationId: string;
    sid: string;
  };
  expiresAt: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly validationCache = new Map<string, ValidationCacheEntry>();
  private readonly cacheTtlMs: number;
  private readonly maxCacheEntries = 5000;

  constructor(
    @Optional() configService?: ConfigService,
    @Optional() private readonly prisma?: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        cookieExtractor,
      ]),
      ignoreExpiration: false,
      secretOrKey: (() => {
        const secret = configService?.get('JWT_SECRET') || process.env.JWT_SECRET;
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

    const rawTtl = configService?.get('AUTH_VALIDATION_CACHE_TTL_MS');
    if (rawTtl !== undefined && rawTtl !== null && rawTtl !== '') {
      const parsed = Number(rawTtl);
      this.cacheTtlMs = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    } else {
      // In test suites, default to 0 so individual tests do not leak cached sessions.
      // In production/development, cache validated sessions for 15s to prevent pool exhaustion (DB-01).
      this.cacheTtlMs = process.env.NODE_ENV === 'test' ? 0 : 15_000;
    }
  }

  clearCache(): void {
    this.validationCache.clear();
  }

  invalidateSession(accountType: string, sub: string, sid: string): void {
    this.validationCache.delete(`${accountType}:${sub}:${sid}`);
  }

  async validate(payload: JwtPayload & { accountType?: string }) {
    const cacheKey = `${payload.accountType || 'user'}:${payload.sub}:${payload.sid || ''}`;
    if (this.cacheTtlMs > 0 && payload.sid) {
      const cached = this.validationCache.get(cacheKey);
      if (cached && Date.now() < cached.expiresAt) {
        return cached.principal;
      }
    }

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

      if (!payload.sid) {
        throw new UnauthorizedException('Token missing sid');
      }

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

      const principal = {
        sub: parent.id,
        id: parent.id,
        email: parent.email,
        role: 'PARENT',
        organizationId: parent.organizationId,
        sid: payload.sid,
      };

      if (this.cacheTtlMs > 0 && payload.sid) {
        this.cachePrincipal(cacheKey, principal, session.expiresAt.getTime());
      }

      return principal;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, organizationId: true, isActive: true, status: true },
    });

    if (!user || !user.isActive || (user.status && user.status !== 'ACTIVE')) {
      throw new UnauthorizedException('User not found or account deactivated');
    }

    if (payload.organizationId && payload.organizationId !== user.organizationId) {
      throw new UnauthorizedException('Token organization mismatch');
    }

    if (!payload.sid) {
      throw new UnauthorizedException('Token missing sid');
    }

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

    const principal = {
      sub: user.id,
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      sid: payload.sid,
    };

    if (this.cacheTtlMs > 0 && payload.sid) {
      this.cachePrincipal(cacheKey, principal, session.expiresAt.getTime());
    }

    return principal;
  }

  private cachePrincipal(
    cacheKey: string,
    principal: ValidationCacheEntry['principal'],
    sessionExpiresAtMs: number,
  ) {
    if (this.validationCache.size >= this.maxCacheEntries) {
      const now = Date.now();
      for (const [k, v] of this.validationCache) {
        if (v.expiresAt <= now) this.validationCache.delete(k);
      }
      if (this.validationCache.size >= this.maxCacheEntries) {
        const oldestKey = this.validationCache.keys().next().value;
        if (oldestKey) this.validationCache.delete(oldestKey);
      }
    }
    this.validationCache.set(cacheKey, {
      principal,
      expiresAt: Math.min(Date.now() + this.cacheTtlMs, sessionExpiresAtMs),
    });
  }
}
