import { Body, Controller, Get, HttpException, Post, Req, Res, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { GoogleAuthGuard } from './google-auth.guard';
import { BootstrapDto, ExchangeAuthCodeDto, ForgotPasswordDto, LoginDto, ParentLoginDto, RegisterDto, ResetPasswordDto } from './dto';
import { GoogleProfile, RequestUser } from './types';
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

  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Login with email and password' })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto.email, dto.password);
    res.cookie('access_token', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: authCookieMaxAgeMs(),
    });
    return { user: result.user };
  }


  @Post('bootstrap')
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
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Register a new user and organization' })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.register(dto);
    // Issue the same HttpOnly session cookie as /auth/login so the newly
    // registered user lands on the dashboard already authenticated
    // (previously the register endpoint returned the token only in the JSON
    // body — the browser never received a session cookie and the
    // ProtectedRoute guard bounced it straight back to /login).
    res.cookie('access_token', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: authCookieMaxAgeMs(),
    });
    return { user: result.user };
  }

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Initiate Google OAuth login' })
  async googleAuth() {
    // Guard redirects to Google (CSRF state generated in the guard).
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Google OAuth callback' })
  async googleAuthCallback(@Req() req: Request & { user: GoogleProfile }, @Res() res: Response) {
    try {
      const googleUser = req.user;
      const result = await this.authService.googleLogin(googleUser);
      const authCode = await this.authService.generateAuthCode(result.accessToken, result.user.id);

      const frontendUrl = resolveFrontendUrl();
      const redirectUrl = `${frontendUrl}/auth/callback?code=${encodeURIComponent(authCode)}`;
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
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Exchange authorization code for session cookie' })
  async exchangeAuthCode(@Body() body: ExchangeAuthCodeDto, @Res({ passthrough: true }) res: Response) {
    if (!body.code) {
      throw new BadRequestException('Authorization code is required');
    }
    const accessToken = await this.authService.exchangeAuthCode(body.code);
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
  @ApiOperation({ summary: 'Initiate Apple OAuth login' })
  async appleAuth() {
    throw new BadRequestException(
      'Apple Sign-In is not yet configured. ' +
        'Please set APPLE_CLIENT_ID and APPLE_CLIENT_SECRET environment variables.',
    );
  }

  @Get('apple/callback')
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
    const result = await this.authService.refreshToken(
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
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Request a password reset link' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Reset password with token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.password);
  }

  @Post('parent-login')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Login for parents using email' })
  async parentLogin(@Body() dto: ParentLoginDto, @Res({ passthrough: true }) res: Response) {
    const parent = await this.parentPortalService.authenticate(dto.email, dto.password, dto.organizationId);
    
    // Issue token specifically for parents using authService
    const accessToken = await this.authService.issueParentToken({
      parentId: parent.id,
      organizationId: parent.organizationId,
      email: parent.email,
      firstName: parent.firstName,
      lastName: parent.lastName,
    });

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
}
