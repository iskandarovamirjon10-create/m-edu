import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { SyncGateway } from '../sync.gateway';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Regression tests for the /sync WebSocket gateway.
 *
 * The gateway authenticates in `handleConnection` (it is intentionally not
 * protected by `WsJwtGuard`). These tests pin the invariant that a connection
 * is accepted ONLY when the JWT maps to an active account AND — when the token
 * carries a `sid` — a live session bound to that same account and organization.
 * Before this was enforced, a revoked/expired session kept a working socket and
 * its owner kept receiving per-user sync events after logout.
 */
describe('SyncGateway connection authentication', () => {
  let gateway: SyncGateway;
  let jwt: { verify: ReturnType<typeof vi.fn> };
  let config: { get: ReturnType<typeof vi.fn> };
  let prisma: {
    user: { findUnique: ReturnType<typeof vi.fn> };
    session: { findUnique: ReturnType<typeof vi.fn> };
    parentAccount: { findUnique: ReturnType<typeof vi.fn> };
    parentSession: { findUnique: ReturnType<typeof vi.fn> };
  };

  const future = new Date(Date.now() + 60 * 60 * 1000);

  function makeClient(headers: Record<string, string> = { authorization: 'Bearer t' }) {
    return {
      id: 'socket-1',
      handshake: { headers, auth: {} },
      join: vi.fn(),
      disconnect: vi.fn(),
      user: undefined as unknown,
    };
  }

  beforeEach(() => {
    jwt = { verify: vi.fn() };
    config = { get: vi.fn().mockReturnValue('super-secret-jwt-key-at-least-32ch') };
    prisma = {
      user: { findUnique: vi.fn() },
      session: { findUnique: vi.fn() },
      parentAccount: { findUnique: vi.fn() },
      parentSession: { findUnique: vi.fn() },
    };

    gateway = new SyncGateway(
      jwt as unknown as JwtService,
      config as unknown as ConfigService,
      prisma as unknown as PrismaService,
    );
  });

  it('rejects a connection with no token', async () => {
    const client = makeClient({});
    await gateway.handleConnection(client as never);
    expect(client.disconnect).toHaveBeenCalledTimes(1);
    expect(client.join).not.toHaveBeenCalled();
  });

  it('accepts a live session bound to the same user and organization', async () => {
    jwt.verify.mockReturnValue({ sub: 'user-1', sid: 'sess-1', organizationId: 'org-1' });
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1', email: 'u@x.io', organizationId: 'org-1', role: 'TEACHER', isActive: true,
    });
    prisma.session.findUnique.mockResolvedValue({
      id: 'sess-1', revokedAt: null, expiresAt: future, userId: 'user-1', organizationId: 'org-1',
    });

    const client = makeClient();
    await gateway.handleConnection(client as never);

    expect(client.disconnect).not.toHaveBeenCalled();
    expect(client.join).toHaveBeenCalledWith('user_user-1');
    expect(client.join).toHaveBeenCalledWith('session_sess-1');
  });

  it('rejects a REVOKED session (logout must terminate the sync socket)', async () => {
    jwt.verify.mockReturnValue({ sub: 'user-1', sid: 'sess-1', organizationId: 'org-1' });
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1', email: 'u@x.io', organizationId: 'org-1', role: 'TEACHER', isActive: true,
    });
    prisma.session.findUnique.mockResolvedValue({
      id: 'sess-1', revokedAt: new Date(), expiresAt: future, userId: 'user-1', organizationId: 'org-1',
    });

    const client = makeClient();
    await gateway.handleConnection(client as never);

    expect(client.disconnect).toHaveBeenCalledTimes(1);
    expect(client.join).not.toHaveBeenCalled();
  });

  it('rejects an EXPIRED session', async () => {
    jwt.verify.mockReturnValue({ sub: 'user-1', sid: 'sess-1', organizationId: 'org-1' });
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1', email: 'u@x.io', organizationId: 'org-1', role: 'TEACHER', isActive: true,
    });
    prisma.session.findUnique.mockResolvedValue({
      id: 'sess-1', revokedAt: null, expiresAt: new Date(Date.now() - 1000), userId: 'user-1', organizationId: 'org-1',
    });

    const client = makeClient();
    await gateway.handleConnection(client as never);

    expect(client.disconnect).toHaveBeenCalledTimes(1);
    expect(client.join).not.toHaveBeenCalled();
  });

  it('rejects a session bound to a different user', async () => {
    jwt.verify.mockReturnValue({ sub: 'user-1', sid: 'sess-1', organizationId: 'org-1' });
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1', email: 'u@x.io', organizationId: 'org-1', role: 'TEACHER', isActive: true,
    });
    prisma.session.findUnique.mockResolvedValue({
      id: 'sess-1', revokedAt: null, expiresAt: future, userId: 'someone-else', organizationId: 'org-1',
    });

    const client = makeClient();
    await gateway.handleConnection(client as never);

    expect(client.disconnect).toHaveBeenCalledTimes(1);
    expect(client.join).not.toHaveBeenCalled();
  });

  it('rejects a token whose organization disagrees with the account', async () => {
    jwt.verify.mockReturnValue({ sub: 'user-1', sid: 'sess-1', organizationId: 'org-OTHER' });
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1', email: 'u@x.io', organizationId: 'org-1', role: 'TEACHER', isActive: true,
    });

    const client = makeClient();
    await gateway.handleConnection(client as never);

    expect(client.disconnect).toHaveBeenCalledTimes(1);
    expect(client.join).not.toHaveBeenCalled();
  });

  it('accepts a live parent session and rejects a revoked parent session', async () => {
    jwt.verify.mockReturnValue({ sub: 'parent-1', sid: 'ps-1', organizationId: 'org-1', accountType: 'parent' });
    prisma.parentAccount.findUnique.mockResolvedValue({
      id: 'parent-1', email: 'p@x.io', organizationId: 'org-1', isActive: true,
    });
    prisma.parentSession.findUnique.mockResolvedValue({
      id: 'ps-1', revokedAt: null, expiresAt: future, parentId: 'parent-1', organizationId: 'org-1',
    });

    const ok = makeClient();
    await gateway.handleConnection(ok as never);
    expect(ok.disconnect).not.toHaveBeenCalled();
    expect(ok.join).toHaveBeenCalledWith('user_parent-1');

    prisma.parentSession.findUnique.mockResolvedValue({
      id: 'ps-1', revokedAt: new Date(), expiresAt: future, parentId: 'parent-1', organizationId: 'org-1',
    });
    const revoked = makeClient();
    await gateway.handleConnection(revoked as never);
    expect(revoked.disconnect).toHaveBeenCalledTimes(1);
  });
});
