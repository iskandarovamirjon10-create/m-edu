import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, HttpException, HttpStatus, UnauthorizedException } from '@nestjs/common';
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
      generateAuthCode: vi.fn(),
      exchangeAuthCode: vi.fn(),
      refreshToken: vi.fn(),
      logout: vi.fn(),
      logoutAll: vi.fn(),
      getMe: vi.fn(),
      forgotPassword: vi.fn(),
      resetPassword: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
        },
        {
          provide: ParentPortalService,
          useValue: { authenticate: vi.fn() },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
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
      expect(result).toEqual({ user: mockLoginResult.user });
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

      expect(authService.bootstrap).toHaveBeenCalledWith(bootstrapDto);
      expect(result).toEqual(mockResult);
    });

    it('propagates error when bootstrap fails (e.g. super admin already exists)', async () => {
      authService.bootstrap.mockRejectedValue(
        new ConflictException('A SUPER_ADMIN already exists. Bootstrap is disabled.'),
      );

      await expect(controller.bootstrap(bootstrapDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('register', () => {
    const registerDto: RegisterDto = {
      email: 'newowner@school.com',
      password: 'SecurePassword123!',
      firstName: 'Alice',
      lastName: 'Smith',
      organizationName: 'Global Academy',
    };

    const mockRegisterResult = {
      accessToken: 'register-token-123',
      user: {
        id: 'u-reg-1',
        email: 'newowner@school.com',
        firstName: 'Alice',
        lastName: 'Smith',
        role: 'ORG_ADMIN',
        organizationId: 'org-reg-1',
      },
    };

    it('delegates to authService.register, sets cookie, and returns user', async () => {
      authService.register.mockResolvedValue(mockRegisterResult);
      const res = createMockResponse();

      const result = await controller.register(registerDto, res);

      expect(authService.register).toHaveBeenCalledWith(registerDto);
      expect(res.cookie).toHaveBeenCalledWith('access_token', 'register-token-123', {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000,
      });
      expect(result).toEqual({ user: mockRegisterResult.user });
    });

    it('sets secure cookie flag in production environment on registration', async () => {
      process.env.NODE_ENV = 'production';
      authService.register.mockResolvedValue(mockRegisterResult);
      const res = createMockResponse();

      await controller.register(registerDto, res);

      expect(res.cookie).toHaveBeenCalledWith('access_token', 'register-token-123', {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000,
      });
    });

    it('propagates service error when user/organization exists', async () => {
      authService.register.mockRejectedValue(new ConflictException('Email already in use'));
      const res = createMockResponse();

      await expect(controller.register(registerDto, res)).rejects.toThrow(ConflictException);
      expect(res.cookie).not.toHaveBeenCalled();
    });
  });

  describe('googleAuth', () => {
    it('executes without error (guard initiates OAuth flow)', async () => {
      await expect(controller.googleAuth()).resolves.toBeUndefined();
    });
  });

  describe('googleAuthCallback', () => {
    const mockGoogleProfile: GoogleProfile = {
      googleSubject: 'google-sub-456',
      email: 'oauth@gmail.com',
      emailVerified: true,
      firstName: 'Google',
      lastName: 'User',
      avatar: 'https://avatar.com/pic.jpg',
      accessToken: 'google-at',
    };

    const mockReq = {
      user: mockGoogleProfile,
    } as any;

    it('logs in with Google profile, generates auth code, and redirects to frontend callback with code', async () => {
      process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
      const res = createMockResponse();
      const loginResult = {
        accessToken: 'oauth-access-token',
        user: { id: 'u-oauth-1', email: 'oauth@gmail.com' },
      };
      authService.googleLogin.mockResolvedValue(loginResult);
      authService.generateAuthCode.mockResolvedValue('test-auth-code-123');

      await controller.googleAuthCallback(mockReq, res);

      expect(authService.googleLogin).toHaveBeenCalledWith(mockGoogleProfile);
      expect(authService.generateAuthCode).toHaveBeenCalledWith('oauth-access-token', 'u-oauth-1');
      expect(res.redirect).toHaveBeenCalledWith(
        'http://localhost:3000/auth/callback?code=test-auth-code-123',
      );
    });

    it('falls back to http://localhost:3000 when NEXT_PUBLIC_APP_URL is not set', async () => {
      delete process.env.NEXT_PUBLIC_APP_URL;
      const res = createMockResponse();
      authService.googleLogin.mockResolvedValue({
        accessToken: 'oauth-access-token',
        user: { id: 'u-oauth-2' },
      });
      authService.generateAuthCode.mockResolvedValue('code-fallback');

      await controller.googleAuthCallback(mockReq, res);

      expect(res.redirect).toHaveBeenCalledWith(
        'http://localhost:3000/auth/callback?code=code-fallback',
      );
    });

    it('redirects with string error from HttpException response', async () => {
      process.env.NEXT_PUBLIC_APP_URL = 'https://app.medu.uz';
      const res = createMockResponse();
      authService.googleLogin.mockRejectedValue(new HttpException('Account deactivated', HttpStatus.FORBIDDEN));

      await controller.googleAuthCallback(mockReq, res);

      expect(res.redirect).toHaveBeenCalledWith(
        'https://app.medu.uz/auth/callback?error=Account%20deactivated',
      );
    });

    it('redirects with object error message from HttpException response', async () => {
      process.env.NEXT_PUBLIC_APP_URL = 'https://app.medu.uz';
      const res = createMockResponse();
      authService.googleLogin.mockRejectedValue(
        new HttpException({ message: 'Email not verified by Google' }, HttpStatus.UNAUTHORIZED),
      );

      await controller.googleAuthCallback(mockReq, res);

      expect(res.redirect).toHaveBeenCalledWith(
        'https://app.medu.uz/auth/callback?error=Email%20not%20verified%20by%20Google',
      );
    });

    it('redirects with JSON stringified message if HttpException message is an object or array', async () => {
      process.env.NEXT_PUBLIC_APP_URL = 'https://app.medu.uz';
      const res = createMockResponse();
      const detailedMessages = ['validation error 1', 'validation error 2'];
      authService.googleLogin.mockRejectedValue(
        new HttpException({ message: detailedMessages }, HttpStatus.BAD_REQUEST),
      );

      await controller.googleAuthCallback(mockReq, res);

      expect(res.redirect).toHaveBeenCalledWith(
        `https://app.medu.uz/auth/callback?error=${encodeURIComponent(JSON.stringify(detailedMessages))}`,
      );
    });

    it('redirects with safe generic message on unexpected non-HttpException error', async () => {
      process.env.NEXT_PUBLIC_APP_URL = 'https://app.medu.uz';
      const res = createMockResponse();
      authService.googleLogin.mockRejectedValue(new Error('Internal database timeout'));

      await controller.googleAuthCallback(mockReq, res);

      expect(res.redirect).toHaveBeenCalledWith(
        `https://app.medu.uz/auth/callback?error=${encodeURIComponent('Google sign-in failed. Please try again.')}`,
      );
    });
  });

  describe('exchangeAuthCode', () => {
    it('throws BadRequestException when authorization code is empty', async () => {
      const res = createMockResponse();
      const body: ExchangeAuthCodeDto = { code: '' };

      await expect(controller.exchangeAuthCode(body, res)).rejects.toThrow(BadRequestException);
      expect(authService.exchangeAuthCode).not.toHaveBeenCalled();
    });

    it('delegates to authService.exchangeAuthCode, sets cookie, and returns accessToken', async () => {
      const res = createMockResponse();
      const body: ExchangeAuthCodeDto = { code: 'valid-code-789' };
      authService.exchangeAuthCode.mockResolvedValue('jwt-exchanged-token');

      const result = await controller.exchangeAuthCode(body, res);

      expect(authService.exchangeAuthCode).toHaveBeenCalledWith('valid-code-789');
      expect(res.cookie).toHaveBeenCalledWith('access_token', 'jwt-exchanged-token', {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000,
      });
      expect(result).toEqual({ accessToken: 'jwt-exchanged-token' });
    });

    it('sets secure cookie flag in production environment', async () => {
      process.env.NODE_ENV = 'production';
      const res = createMockResponse();
      const body: ExchangeAuthCodeDto = { code: 'valid-code-789' };
      authService.exchangeAuthCode.mockResolvedValue('jwt-exchanged-token');

      await controller.exchangeAuthCode(body, res);

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

      await expect(controller.exchangeAuthCode(body, res)).rejects.toThrow(UnauthorizedException);
      expect(res.cookie).not.toHaveBeenCalled();
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

      expect(authService.refreshToken).toHaveBeenCalledWith('u-user-1', 'sess-abc');
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

      expect(authService.refreshToken).toHaveBeenCalledWith('u-user-1', undefined);
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

      expect(authService.getMe).toHaveBeenCalledWith('u-1');
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
    it('applies GoogleAuthGuard to googleAuth', () => {
      const guards = Reflect.getMetadata('__guards__', AuthController.prototype.googleAuth);
      expect(guards).toBeDefined();
      expect(guards).toContain(GoogleAuthGuard);
    });

    it('applies GoogleAuthGuard to googleAuthCallback', () => {
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
