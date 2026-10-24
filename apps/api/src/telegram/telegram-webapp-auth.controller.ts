import {
  Body,
  Controller,
  Post,
  Req,
  Res,
  HttpCode,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsNotEmpty, IsString } from 'class-validator';
import type { Request, Response } from 'express';
import { AllowPublic } from '../auth/public.decorator';
import { TelegramWebAppAuthService } from './telegram-webapp-auth.service';
import { authCookieMaxAgeMs } from '../auth/auth.ttl';

export class WebAppAuthDto {
  @IsString()
  @IsNotEmpty()
  initData: string;
}

@ApiTags('Telegram')
@Controller('telegram/webapp')
export class TelegramWebAppAuthController {
  constructor(private readonly webAppAuth: TelegramWebAppAuthService) {}

  @Post('auth')
  @AllowPublic()
  @HttpCode(200)
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Cryptographically verify Telegram WebApp initData and issue session',
    description: 'Validates Telegram HMAC-SHA-256 signature and logs in the linked student/parent/staff member.',
  })
  async authenticate(
    @Body() dto: WebAppAuthDto,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ) {
    const meta = {
      userAgent: req.headers['user-agent'] as string | undefined,
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress,
    };

    const result = await this.webAppAuth.authenticate(dto.initData, meta);

    if (result.authenticated && result.accessToken) {
      res.cookie('access_token', result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: authCookieMaxAgeMs(),
      });
    }

    return result;
  }
}
