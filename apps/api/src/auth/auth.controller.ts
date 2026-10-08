import { Body, Controller, Delete, Get, HttpException, Param, Post, Req, Res, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response, Request } from 'express';
import { timingSafeEqual } from 'crypto';
import { AuthService } from './auth.service';
import { AllowPublic } from './public.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';
import { GoogleAuthGuard } from './google-auth.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';
import { Role } from '@prisma/client';
import {
  AcceptInvitationDto,
  AddToWhitelistDto,
  BootstrapDto,
  ExchangeAuthCodeDto,
  ForgotPasswordDto,
  LoginDto,
  ParentLoginDto,
  RegisterDto,
  ResetPasswordDto,
  UpdateAccessControlSettingsDto,
} from './dto';
import { GoogleProfile, RequestUser } from './types';
import { PLATFORM_ROLES } from './authorization.policy';
import { ParentPortalService } from '../parent-portal/parent-portal.service';
import { authCookieMaxAgeMs } from './auth.ttl';
import { resolveFrontendUrl } from './auth.utils';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly parentPortalService: ParentPortalService,
  ) {}

  private extractClientMeta(req?: Request) {
    if (!req || !req.headers) return undefined;
    const userAgent = req.headers['user-agent'] as string | undefined;
    const forwarded = req.headers['x-forwarded-for'];
    const ipAddress = (
      typeof forwarded === 'string'
        ? forwarded.split(',')[0].trim()
        : req.socket?.remoteAddress || req.ip || undefined
    );
    if (!userAgent && !ipAddress) return undefined;
    return { userAgent, ipAddress };
  }

  @Post('login')
  @AllowPublic()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Login with email and password' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
    @Req() req?: Request,
  ) {
    const meta = this.extractClientMeta(req);
    const result = meta
      ? await this.authService.login(dto.email, dto.password, meta)
      : await this.authService.login(dto.email, dto.password);
    res.cookie('access_token', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: authCookieMaxAgeMs(),
    });
    return { user: result.user };
  }


  @Post('bootstrap')
  @AllowPublic()
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({
    summary: 'Bootstrap the FIRST SUPER_ADMIN (one-time, platform-level)',
    description:
      'Creates the first SUPER_ADMIN account. Only succeeds while no ' +
      'SUPER_ADMIN exists anywhere in the platform; afterwards it returns ' +
      '409 forever. Intended for the initial deployment of a fresh platform.',
  })
  async bootstrap(@Body() dto: BootstrapDto) {
    return this.authService.bootstrap(dto);
  }

  @Post('register')
  @AllowPublic()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Register a new user and organization' })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
    @Req() req?: Request,
  ) {
    const meta = this.extractClientMeta(req);
    const result = meta
      ? await this.authService.register(dto, meta)
      : await this.authService.register(dto);
    if (result.pendingApproval) {
      return {
        user: result.user,
        pendingApproval: true,
        message: result.message || 'Account registered successfully. Pending administrator approval.',
      };
    }
    // Issue the same HttpOnly session cookie as /auth/login so the newly
    // registered user lands on the dashboard already authenticated
    res.cookie('access_token', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: authCookieMaxAgeMs(),
    });
    return { user: result.user };
  }

  @Post('invitations/accept')
  @AllowPublic()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Accept invitation and set password' })
  async acceptInvitation(@Body() dto: AcceptInvitationDto) {
    return this.authService.acceptInvitation(dto);
  }

  @Get('google')
  @AllowPublic()
  @UseGuards(GoogleAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Initiate Google OAuth login' })
  async googleAuth() {
    // Guard redirects to Google (CSRF state generated in the guard).
  }

  @Get('google/callback')
  @AllowPublic()
  @UseGuards(GoogleAuthGuard)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Google OAuth callback' })
  async googleAuthCallback(@Req() req: Request & { user: GoogleProfile }, @Res() res: Response) {
    try {
      const googleUser = req.user;
      const meta = this.extractClientMeta(req);
      const result = meta
        ? await this.authService.googleLogin(googleUser, meta)
        : await this.authService.googleLogin(googleUser);
      const exchangeState = this.authService.generateSecureToken();
      const authCode = await this.authService.generateAuthCode(result.accessToken, result.user.id, exchangeState);

      res.cookie('oauth_exchange_state', exchangeState, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 5 * 60 * 1000,
      });

      const frontendUrl = resolveFrontendUrl();
      const redirectUrl = `${frontendUrl}/auth/callback?code=${encodeURIComponent(authCode)}&state=${encodeURIComponent(exchangeState)}`;
      res.redirect(redirectUrl);
    } catch (error: unknown) {
      const frontendUrl = resolveFrontendUrl();
      // Only client-safe messages reach the frontend: HttpException messages
      // are already sanitized (global filter contract); anything else becomes
      // a generic message (no stack traces, no internals).
      let safeMessage = 'Google sign-in failed. Please try again.';
      if (error instanceof HttpException) {
        const body = error.getResponse();
        if (typeof body === 'string') {
          safeMessage = body;
        } else if (body && typeof body === 'object' && (body as { message?: unknown }).message) {
          const m = (body as { message: unknown }).message;
          safeMessage = typeof m === 'string' ? m : JSON.stringify(m);
        }
      }
      res.redirect(`${frontendUrl}/auth/callback?error=${encodeURIComponent(safeMessage)}`);
    }
  }

  @Post('oauth/exchange')
  @AllowPublic()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Exchange authorization code for session cookie' })
  async exchangeAuthCode(
    @Body() body: ExchangeAuthCodeDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!body.code) {
      throw new BadRequestException('Authorization code is required');
    }

    // Cookie state verification (binds exchange to the browser that completed OAuth callback)
    const cookieState = req.cookies?.['oauth_exchange_state'];
    if (cookieState && body.state) {
      const expected = Buffer.from(cookieState);
      const actual = Buffer.from(body.state);
      if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
        throw new BadRequestException('Invalid or expired OAuth exchange state');
      }
    }

    const accessToken = await this.authService.exchangeAuthCode(body.code, body.state);
    res.clearCookie('oauth_exchange_state');

    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: authCookieMaxAgeMs(),
    });
    // Deliberately NOT echoed in the body: the session must stay unreadable to
    // JavaScript (HttpOnly), and no client code consumes it — the SPA reads the
    // identity back from `GET /auth/me`.
    return { authenticated: true };
  }

  @Get('apple')
  @AllowPublic()
  @ApiOperation({ summary: 'Initiate Apple OAuth login' })
  async appleAuth() {
    throw new BadRequestException(
      'Apple Sign-In is not yet configured. ' +
        'Please set APPLE_CLIENT_ID and APPLE_CLIENT_SECRET environment variables.',
    );
  }

  @Get('apple/callback')
  @AllowPublic()
  @ApiOperation({ summary: 'Apple OAuth callback' })
  async appleAuthCallback() {
    throw new BadRequestException(
      'Apple Sign-In is not yet configured. ' +
        'Please set APPLE_CLIENT_ID and APPLE_CLIENT_SECRET environment variables.',
    );
  }

  @Post('refresh')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Refresh access token' })
  async refresh(@Req() req: Request & { user: RequestUser }, @Res({ passthrough: true }) res: Response) {
    // `role` selects the session table: 'PARENT' -> ParentSession,
    // anything else -> Session. Never resolve a sid against both.
    const meta = this.extractClientMeta(req);
    const result = meta
      ? await this.authService.refreshToken(
          req.user.sub,
          req.user.sid ?? undefined,
          req.user.role,
          meta,
        )
      : await this.authService.refreshToken(
          req.user.sub,
          req.user.sid ?? undefined,
          req.user.role,
        );
    res.cookie('access_token', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: authCookieMaxAgeMs(),
    });
    return { user: result.user };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Logout (revoke current session)' })
  async logout(@Req() req: Request & { user: RequestUser }, @Res({ passthrough: true }) res: Response) {
    const sessionId = req.user.sid;
    if (sessionId) {
      await this.authService.logout(sessionId, req.user.sub, req.user.role);
    } else {
      await this.authService.logoutAll(req.user.sub, 'logout_no_sid', req.user.role);
    }
    res.clearCookie('access_token', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
    return { message: 'Logged out successfully' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  async getMe(@Req() req: Request & { user: RequestUser }) {
    return this.authService.getMe(req.user.sub, req.user.role);
  }

  @Post('forgot-password')
  @AllowPublic()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Request a password reset link' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @AllowPublic()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Reset password with token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.password);
  }

  @Post('parent-login')
  @AllowPublic()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Login for parents using email' })
  async parentLogin(
    @Body() dto: ParentLoginDto,
    @Res({ passthrough: true }) res: Response,
    @Req() req?: Request,
  ) {
    const parent = await this.parentPortalService.authenticate(dto.email, dto.password, dto.organizationId);
    const meta = this.extractClientMeta(req);
    
    // Issue token specifically for parents using authService
    const accessToken = await this.authService.issueParentToken({
      parentId: parent.id,
      organizationId: parent.organizationId,
      email: parent.email,
      firstName: parent.firstName,
      lastName: parent.lastName,
    }, meta);

    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: authCookieMaxAgeMs(),
    });

    return {
      user: {
        id: parent.id,
        email: parent.email,
        firstName: parent.firstName,
        lastName: parent.lastName,
        role: 'PARENT',
      }
    };
  }

  // ==================== Active Sessions & Device Management ====================

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all active sessions/devices for current user' })
  async getActiveSessions(@Req() req: Request & { user: RequestUser }) {
    return this.authService.getActiveSessions(req.user.sub, req.user.sid ?? undefined, req.user.role);
  }

  @Delete('sessions/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke a specific session/device by id' })
  async revokeSession(
    @Param('id') id: string,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.authService.revokeSession(req.user.sub, id, req.user.role);
  }

  @Post('sessions/revoke-others')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke all other active sessions except current' })
  async revokeOtherSessions(@Req() req: Request & { user: RequestUser }) {
    return this.authService.revokeOtherSessions(req.user.sub, req.user.sid ?? undefined, req.user.role);
  }

  // ==================== Access Whitelist & Approval ====================

  @Get('whitelist')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get access whitelist, pending users, and access control settings' })
  async getWhitelist(@Req() req: Request & { user: RequestUser }) {
    const isSuperAdmin = req.user.role === 'SUPER_ADMIN';
    return this.authService.getWhitelist(req.user.organizationId, isSuperAdmin);
  }

  @Post('whitelist')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add email to access whitelist' })
  async addToWhitelist(
    @Body() dto: AddToWhitelistDto,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.authService.addToWhitelist({
      email: dto.email,
      note: dto.note,
      role: dto.role,
      addedBy: req.user.sub,
      organizationId: req.user.organizationId,
    });
  }

  @Delete('whitelist/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove entry from access whitelist' })
  async removeFromWhitelist(
    @Param('id') id: string,
    @Req() req: Request & { user: RequestUser },
  ) {
    // The service scopes the delete by (role, organizationId). Omitting those
    // arguments here used to disable the ownership check completely — any
    // ORG_ADMIN could delete any other tenant's whitelist entry.
    return this.authService.removeFromWhitelist(
      id,
      req.user.sub,
      req.user.role,
      req.user.organizationId,
    );
  }

  @Post('whitelist/approve-user/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Approve a pending user' })
  async approveUser(
    @Param('id') id: string,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.authService.approveUser(id, req.user.sub, req.user.role, req.user.organizationId);
  }

  @Delete('whitelist/reject-user/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reject a pending user' })
  async rejectUser(
    @Param('id') id: string,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.authService.rejectUser(id, req.user.sub, req.user.role, req.user.organizationId);
  }

  @Post('whitelist/settings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  // This endpoint rewrites the SINGLE `id: 'global'` policy row. A tenant
  // admin flipping it changes registration policy for every other tenant.
  @Roles(...PLATFORM_ROLES)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update access control settings' })
  async updateAccessControlSettings(
    @Body() body: UpdateAccessControlSettingsDto,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.authService.updateAccessControlConfig(
      body,
      req.user.sub,
      req.user.role,
      req.user.organizationId,
    );
  }
}
