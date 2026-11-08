import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, ForbiddenException, HttpException, HttpStatus, UnauthorizedException } from '@nestjs/common';
import type { Response } from 'express';
import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';
import { JwtAuthGuard } from '../jwt-auth.guard';
import { GoogleAuthGuard } from '../google-auth.guard';
import { BootstrapDto, ExchangeAuthCodeDto, ForgotPasswordDto, LoginDto, RegisterDto, ResetPasswordDto } from '../dto';
import { GoogleProfile, RequestUser } from '../types';
import { ParentPortalService } from '../../parent-portal/parent-portal.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: {
    login: ReturnType<typeof vi.fn>;
    bootstrap: ReturnType<typeof vi.fn>;
    register: ReturnType<typeof vi.fn>;
    googleLogin: ReturnType<typeof vi.fn>;
    generateAuthCode: ReturnType<typeof vi.fn>;
    exchangeAuthCode: ReturnType<typeof vi.fn>;
    refreshToken: ReturnType<typeof vi.fn>;
    logout: ReturnType<typeof vi.fn>;
    logoutAll: ReturnType<typeof vi.fn>;
    getMe: ReturnType<typeof vi.fn>;
    forgotPassword: ReturnType<typeof vi.fn>;
    resetPassword: ReturnType<typeof vi.fn>;
  };

  const createMockResponse = () => {
    const res = {
      cookie: vi.fn().mockReturnThis(),
      clearCookie: vi.fn().mockReturnThis(),
      redirect: vi.fn().mockReturnThis(),
    };
    return res as unknown as Response & {
      cookie: ReturnType<typeof vi.fn>;
      clearCookie: ReturnType<typeof vi.fn>;
      redirect: ReturnType<typeof vi.fn>;
    };
  };

  const originalEnv = { ...process.env };

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };

    authService = {
      login: vi.fn(),
      bootstrap: vi.fn(),
      register: vi.fn(),
      googleLogin: vi.fn(),
      generateSecureToken: vi.fn().mockReturnValue('mock-state-nonce-123'),
      generateAuthCode: vi.fn(),
      exchangeAuthCode: vi.fn(),
      refreshToken: vi.fn(),
      logout: vi.fn(),
      logoutAll: vi.fn(),
      getMe: vi.fn(),
      forgotPassword: vi.fn(),
      resetPassword: vi.fn(),
    };

    controller = new AuthController(
      authService as unknown as AuthService,
      { authenticate: vi.fn() } as unknown as ParentPortalService,
    );
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      email: 'user@example.com',
      password: 'Password123!',
    };

    const mockLoginResult = {
      accessToken: 'mock-access-token',
      user: {
        id: 'u-1',
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'ORG_ADMIN',
        organizationId: 'org-1',
      },
    };

    it('delegates to authService.login, sets auth cookie, and returns user', async () => {
      authService.login.mockResolvedValue(mockLoginResult);
      const res = createMockResponse();

      const result = await controller.login(loginDto, res);

      expect(authService.login).toHaveBeenCalledWith(loginDto.email, loginDto.password);
      expect(res.cookie).toHaveBeenCalledWith('access_token', 'mock-access-token', {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000,
      });
      expect(result).toEqual(expect.objectContaining({ user: mockLoginResult.user }));
    });

    it('sets secure cookie flag in production environment', async () => {
      process.env.NODE_ENV = 'production';
      authService.login.mockResolvedValue(mockLoginResult);
      const res = createMockResponse();

      await controller.login(loginDto, res);

      expect(res.cookie).toHaveBeenCalledWith('access_token', 'mock-access-token', {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000,
      });
    });

    it('propagates errors when authService.login fails', async () => {
      authService.login.mockRejectedValue(new UnauthorizedException('Invalid credentials'));
      const res = createMockResponse();

      await expect(controller.login(loginDto, res)).rejects.toThrow(UnauthorizedException);
      expect(res.cookie).not.toHaveBeenCalled();
    });
  });

  describe('bootstrap', () => {
    const bootstrapDto: BootstrapDto = {
      email: 'superadmin@medu.uz',
      password: 'SuperAdminPassword123!',
      firstName: 'Platform',
      lastName: 'SuperAdmin',
      phone: '+998901234567',
    };

    it('delegates to authService.bootstrap and returns the result', async () => {
      const mockResult = {
        message: 'Platform super admin created successfully',
        userId: 'super-admin-id',
      };
      authService.bootstrap.mockResolvedValue(mockResult);

      const result = await controller.bootstrap(bootstrapDto);

      expect(authService.bootstrap).toHaveBeenCalledWith(bootstrapDto, undefined);
      expect(result).toEqual(mockResult);
    });

    it('propagates error when bootstrap fails (e.g. super admin already exists)', async () => {
      authService.bootstrap.mockRejectedValue(
        new ConflictException('A SUPER_ADMIN already exists. Bootstrap is disabled.'),
      );

      await expect(controller.bootstrap(bootstrapDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('register (Disabled under Centralized IAM)', () => {
    it('rejects public registration with 403 Forbidden', async () => {
      await expect(controller.register()).rejects.toThrow(ForbiddenException);
    });
  });

  describe('googleAuth (Disabled under Centralized IAM)', () => {
    it('rejects Google OAuth initiation with 403 Forbidden', async () => {
      await expect(controller.googleAuth()).rejects.toThrow(ForbiddenException);
    });
  });

  describe('googleAuthCallback (Disabled under Centralized IAM)', () => {
    it('rejects Google OAuth callback with 403 Forbidden', async () => {
      await expect(controller.googleAuthCallback()).rejects.toThrow(ForbiddenException);
    });
  });

  describe('exchangeAuthCode', () => {
    const mockReq = { cookies: {} } as any;

    it('throws BadRequestException when authorization code is empty', async () => {
      const res = createMockResponse();
      const body: ExchangeAuthCodeDto = { code: '' };

      await expect(controller.exchangeAuthCode(body, mockReq, res)).rejects.toThrow(BadRequestException);
      expect(authService.exchangeAuthCode).not.toHaveBeenCalled();
    });

    it('delegates to authService.exchangeAuthCode, sets cookie, and never returns the JWT in the body', async () => {
      const res = createMockResponse();
      const body: ExchangeAuthCodeDto = { code: 'valid-code-789' };
      authService.exchangeAuthCode.mockResolvedValue('jwt-exchanged-token');

      const result = await controller.exchangeAuthCode(body, mockReq, res);

      expect(authService.exchangeAuthCode).toHaveBeenCalledWith('valid-code-789', undefined);
      expect(res.cookie).toHaveBeenCalledWith('access_token', 'jwt-exchanged-token', {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000,
      });
      // The cookie is the only carrier: a token in the response body would be
      // readable by any script on the page and would end up in logs/proxies.
      expect(result).toEqual({ authenticated: true });
      expect(JSON.stringify(result)).not.toContain('jwt-exchanged-token');
    });

    it('sets secure cookie flag in production environment', async () => {
      process.env.NODE_ENV = 'production';
      const res = createMockResponse();
      const body: ExchangeAuthCodeDto = { code: 'valid-code-789' };
      authService.exchangeAuthCode.mockResolvedValue('jwt-exchanged-token');

      await controller.exchangeAuthCode(body, mockReq, res);

      expect(res.cookie).toHaveBeenCalledWith('access_token', 'jwt-exchanged-token', {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000,
      });
    });

    it('propagates errors when code is invalid or expired', async () => {
      const res = createMockResponse();
      const body: ExchangeAuthCodeDto = { code: 'expired-code' };
      authService.exchangeAuthCode.mockRejectedValue(new UnauthorizedException('Invalid or expired code'));

      await expect(controller.exchangeAuthCode(body, mockReq, res)).rejects.toThrow(UnauthorizedException);
      expect(res.cookie).not.toHaveBeenCalled();
    });

    it('validates state cookie matching body state', async () => {
      const reqWithCookie = {
        ...mockReq,
        cookies: { oauth_exchange_state: 'correct-state-token' },
      } as unknown as Request;
      const res = createMockResponse();
      const body: ExchangeAuthCodeDto = { code: 'valid-code', state: 'correct-state-token' };
      authService.exchangeAuthCode.mockResolvedValue('jwt-token');

      const result = await controller.exchangeAuthCode(body, reqWithCookie, res);
      expect(result).toEqual({ authenticated: true });
      expect(res.clearCookie).toHaveBeenCalledWith('oauth_exchange_state');
    });

    it('rejects exchange when body state mismatches oauth_exchange_state cookie', async () => {
      const reqWithCookie = {
        ...mockReq,
        cookies: { oauth_exchange_state: 'correct-state-token' },
      } as unknown as Request;
      const res = createMockResponse();
      const body: ExchangeAuthCodeDto = { code: 'valid-code', state: 'wrong-state-token' };

      await expect(controller.exchangeAuthCode(body, reqWithCookie, res)).rejects.toThrow(
        BadRequestException,
      );
      expect(authService.exchangeAuthCode).not.toHaveBeenCalled();
    });

    it('rejects exchange when body state is provided but oauth_exchange_state cookie is missing (M-EDU-SEC-003)', async () => {
      const reqWithoutCookie = {
        ...mockReq,
        cookies: {},
      } as unknown as Request;
      const res = createMockResponse();
      const body: ExchangeAuthCodeDto = { code: 'valid-code', state: 'some-state' };

      await expect(controller.exchangeAuthCode(body, reqWithoutCookie, res)).rejects.toThrow(
        BadRequestException,
      );
      expect(authService.exchangeAuthCode).not.toHaveBeenCalled();
    });

    it('rejects exchange when oauth_exchange_state cookie is present but body state is missing (M-EDU-SEC-003)', async () => {
      const reqWithCookie = {
        ...mockReq,
        cookies: { oauth_exchange_state: 'some-state' },
      } as unknown as Request;
      const res = createMockResponse();
      const body: ExchangeAuthCodeDto = { code: 'valid-code' };

      await expect(controller.exchangeAuthCode(body, reqWithCookie, res)).rejects.toThrow(
        BadRequestException,
      );
      expect(authService.exchangeAuthCode).not.toHaveBeenCalled();
    });
  });

  describe('appleAuth', () => {
    it('throws BadRequestException indicating Apple Sign-In is not configured', async () => {
      await expect(controller.appleAuth()).rejects.toThrow(BadRequestException);
      await expect(controller.appleAuth()).rejects.toThrow(
        'Apple Sign-In is not yet configured. Please set APPLE_CLIENT_ID and APPLE_CLIENT_SECRET environment variables.',
      );
    });
  });

  describe('appleAuthCallback', () => {
    it('throws BadRequestException indicating Apple Sign-In is not configured', async () => {
      await expect(controller.appleAuthCallback()).rejects.toThrow(BadRequestException);
      await expect(controller.appleAuthCallback()).rejects.toThrow(
        'Apple Sign-In is not yet configured. Please set APPLE_CLIENT_ID and APPLE_CLIENT_SECRET environment variables.',
      );
    });
  });

  describe('refresh', () => {
    const mockUser: RequestUser = {
      sub: 'u-user-1',
      sid: 'sess-abc',
      email: 'user@example.com',
      role: 'STUDENT',
    };

    const mockRefreshResult = {
      accessToken: 'new-refreshed-jwt',
      user: {
        id: 'u-user-1',
        email: 'user@example.com',
        role: 'STUDENT',
      },
    };

    it('delegates to authService.refreshToken with sub and sid, sets cookie, and returns user', async () => {
      authService.refreshToken.mockResolvedValue(mockRefreshResult);
      const res = createMockResponse();
      const req = { user: mockUser } as any;

      const result = await controller.refresh(req, res);

      expect(authService.refreshToken).toHaveBeenCalledWith('u-user-1', 'sess-abc', 'STUDENT');
      expect(res.cookie).toHaveBeenCalledWith('access_token', 'new-refreshed-jwt', {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000,
      });
      expect(result).toEqual({ user: mockRefreshResult.user });
    });

    it('passes undefined for sid when sid is missing in request user', async () => {
      authService.refreshToken.mockResolvedValue(mockRefreshResult);
      const res = createMockResponse();
      const req = { user: { sub: 'u-user-1', email: 'user@example.com', role: 'STUDENT' } } as any;

      await controller.refresh(req, res);

      expect(authService.refreshToken).toHaveBeenCalledWith('u-user-1', undefined, 'STUDENT');
    });

    it('forwards the PARENT role so refreshToken selects the ParentSession table', async () => {
      authService.refreshToken.mockResolvedValue(mockRefreshResult);
      const res = createMockResponse();
      const req = {
        user: {
          sub: 'parent-1',
          sid: 'psess-1',
          email: 'parent@example.com',
          role: 'PARENT',
          organizationId: 'org-1',
        },
      } as any;

      await controller.refresh(req, res);

      // Never: (sub, sid) alone — the role decides which table owns the sid.
      expect(authService.refreshToken).toHaveBeenCalledWith('parent-1', 'psess-1', 'PARENT');
    });

    it('sets secure cookie flag in production environment on refresh', async () => {
      process.env.NODE_ENV = 'production';
      authService.refreshToken.mockResolvedValue(mockRefreshResult);
      const res = createMockResponse();
      const req = { user: mockUser } as any;

      await controller.refresh(req, res);

      expect(res.cookie).toHaveBeenCalledWith('access_token', 'new-refreshed-jwt', {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000,
      });
    });

    it('supports silent refresh of expired JWT via cookie using live DB session (LOGIC-04)', async () => {
      const mockJwt = {
        verify: vi.fn().mockReturnValue({
          sub: 'u-user-expired',
          sid: 'sess-live-in-db',
          role: 'TEACHER',
        }),
      };
      const controllerWithJwt = new AuthController(
        authService as unknown as AuthService,
        { authenticate: vi.fn() } as unknown as ParentPortalService,
        mockJwt as any,
      );
      authService.refreshToken.mockResolvedValue(mockRefreshResult);
      const res = createMockResponse();
      const req = {
        cookies: { access_token: 'expired_but_valid_jwt' },
      } as any;

      const result = await controllerWithJwt.refresh(req, res);

      expect(mockJwt.verify).toHaveBeenCalledWith('expired_but_valid_jwt', { ignoreExpiration: true });
      expect(authService.refreshToken).toHaveBeenCalledWith('u-user-expired', 'sess-live-in-db', 'TEACHER');
      expect(result).toEqual({ user: mockRefreshResult.user });
    });

    it('propagates errors when token refresh fails', async () => {
      authService.refreshToken.mockRejectedValue(new UnauthorizedException('Session expired'));
      const res = createMockResponse();
      const req = { user: mockUser } as any;

      await expect(controller.refresh(req, res)).rejects.toThrow(UnauthorizedException);
      expect(res.cookie).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('revokes specific session when sid is present, clears cookie, and returns success message', async () => {
      const res = createMockResponse();
      const req = {
        user: { sub: 'u-1', sid: 'sess-active', email: 'u1@example.com', role: 'TEACHER' },
      } as any;
      authService.logout.mockResolvedValue(undefined);

      const result = await controller.logout(req, res);

      expect(authService.logout).toHaveBeenCalledWith('sess-active', 'u-1', 'TEACHER');
      expect(authService.logoutAll).not.toHaveBeenCalled();
      expect(res.clearCookie).toHaveBeenCalledWith('access_token', {
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
      });
      expect(result).toEqual({ message: 'Logged out successfully' });
    });

    it('calls logoutAll with logout_no_sid reason when sid is absent', async () => {
      const res = createMockResponse();
      const req = {
        user: { sub: 'u-1', email: 'u1@example.com', role: 'TEACHER' },
      } as any;
      authService.logoutAll.mockResolvedValue(undefined);

      const result = await controller.logout(req, res);

      expect(authService.logoutAll).toHaveBeenCalledWith('u-1', 'logout_no_sid', 'TEACHER');
      expect(authService.logout).not.toHaveBeenCalled();
      expect(res.clearCookie).toHaveBeenCalledWith('access_token', {
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
      });
      expect(result).toEqual({ message: 'Logged out successfully' });
    });

    it('sets secure cookie flag in production environment when clearing cookie', async () => {
      process.env.NODE_ENV = 'production';
      const res = createMockResponse();
      const req = {
        user: { sub: 'u-1', sid: 'sess-active', email: 'u1@example.com', role: 'TEACHER' },
      } as any;
      authService.logout.mockResolvedValue(undefined);

      await controller.logout(req, res);

      expect(res.clearCookie).toHaveBeenCalledWith('access_token', {
        httpOnly: true,
        sameSite: 'lax',
        secure: true,
      });
    });

    it('propagates error if logout fails', async () => {
      const res = createMockResponse();
      const req = {
        user: { sub: 'u-1', sid: 'sess-active', email: 'u1@example.com', role: 'TEACHER' },
      } as any;
      authService.logout.mockRejectedValue(new Error('Logout database error'));

      await expect(controller.logout(req, res)).rejects.toThrow('Logout database error');
    });
  });

  describe('getMe', () => {
    it('delegates to authService.getMe with req.user.sub and returns profile', async () => {
      const mockProfile = {
        id: 'u-1',
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'SUPER_ADMIN',
        organization: null,
      };
      authService.getMe.mockResolvedValue(mockProfile);
      const req = {
        user: { sub: 'u-1', email: 'user@example.com', role: 'SUPER_ADMIN' },
      } as any;

      const result = await controller.getMe(req);

      expect(authService.getMe).toHaveBeenCalledWith('u-1', 'SUPER_ADMIN');
      expect(result).toEqual(mockProfile);
    });

    it('propagates error when user profile is not found', async () => {
      authService.getMe.mockRejectedValue(new UnauthorizedException('User not found'));
      const req = {
        user: { sub: 'u-nonexistent', email: 'user@example.com', role: 'STUDENT' },
      } as any;

      await expect(controller.getMe(req)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('forgotPassword', () => {
    const forgotPasswordDto: ForgotPasswordDto = {
      email: 'lostpwd@example.com',
    };

    it('delegates to authService.forgotPassword and returns result', async () => {
      const mockResponse = { message: 'Password reset link sent if account exists' };
      authService.forgotPassword.mockResolvedValue(mockResponse);

      const result = await controller.forgotPassword(forgotPasswordDto);

      expect(authService.forgotPassword).toHaveBeenCalledWith(forgotPasswordDto.email);
      expect(result).toEqual(mockResponse);
    });

    it('propagates service error', async () => {
      authService.forgotPassword.mockRejectedValue(new Error('Email service down'));

      await expect(controller.forgotPassword(forgotPasswordDto)).rejects.toThrow('Email service down');
    });
  });

  describe('resetPassword', () => {
    const resetPasswordDto: ResetPasswordDto = {
      token: 'valid-reset-token-abc',
      password: 'NewSuperPassword123!',
    };

    it('delegates to authService.resetPassword and returns result', async () => {
      const mockResponse = { message: 'Password has been reset successfully' };
      authService.resetPassword.mockResolvedValue(mockResponse);

      const result = await controller.resetPassword(resetPasswordDto);

      expect(authService.resetPassword).toHaveBeenCalledWith(
        resetPasswordDto.token,
        resetPasswordDto.password,
      );
      expect(result).toEqual(mockResponse);
    });

    it('propagates error when token is invalid or expired', async () => {
      authService.resetPassword.mockRejectedValue(new BadRequestException('Invalid or expired token'));

      await expect(controller.resetPassword(resetPasswordDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('Guard verification (structural)', () => {
    it.skip('applies GoogleAuthGuard to googleAuth', () => {
      const guards = Reflect.getMetadata('__guards__', AuthController.prototype.googleAuth);
      expect(guards).toBeDefined();
      expect(guards).toContain(GoogleAuthGuard);
    });

    it.skip('applies GoogleAuthGuard to googleAuthCallback', () => {
      const guards = Reflect.getMetadata('__guards__', AuthController.prototype.googleAuthCallback);
      expect(guards).toBeDefined();
      expect(guards).toContain(GoogleAuthGuard);
    });

    it('applies JwtAuthGuard to refresh', () => {
      const guards = Reflect.getMetadata('__guards__', AuthController.prototype.refresh);
      expect(guards).toBeDefined();
      expect(guards).toContain(JwtAuthGuard);
    });

    it('applies JwtAuthGuard to logout', () => {
      const guards = Reflect.getMetadata('__guards__', AuthController.prototype.logout);
      expect(guards).toBeDefined();
      expect(guards).toContain(JwtAuthGuard);
    });

    it('applies JwtAuthGuard to getMe', () => {
      const guards = Reflect.getMetadata('__guards__', AuthController.prototype.getMe);
      expect(guards).toBeDefined();
      expect(guards).toContain(JwtAuthGuard);
    });
  });
});
