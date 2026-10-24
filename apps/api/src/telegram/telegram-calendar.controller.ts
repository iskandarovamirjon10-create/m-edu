import {
  Controller,
  Get,
  Param,
  Req,
  Res,
  UseGuards,
  Header,
} from '@nestjs/common';
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AllowPublic } from '../auth/public.decorator';
import { AllowSelfService } from '../auth/roles.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequestUser } from '../auth/types';
import { TelegramCalendarService } from './telegram-calendar.service';

@ApiTags('Telegram')
@Controller('telegram/calendar')
export class TelegramCalendarController {
  constructor(private readonly calendarService: TelegramCalendarService) {}

  @Get('feed/:token.ics')
  @AllowPublic()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Header('Content-Type', 'text/calendar; charset=utf-8')
  @Header('Content-Disposition', 'inline; filename="medu-schedule.ics"')
  @Header('Cache-Control', 'no-cache, no-store, must-revalidate')
  @ApiOperation({
    summary: 'Public RFC 5545 iCalendar feed endpoint for Apple/Google Calendar sync',
  })
  async getFeed(@Param('token') token: string, @Res() res: Response) {
    const cleanToken = token.replace(/\.ics$/i, '');
    const icsContent = await this.calendarService.generateIcsFeed(cleanToken);
    res.send(icsContent);
  }

  @Get('link')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @AllowSelfService()
  @ApiOperation({ summary: 'Get my personal Calendar synchronization links' })
  async getMyCalendarLink(@CurrentUser() user: RequestUser, @Req() req: Request) {
    const token = await this.calendarService.getOrCreateCalendarToken(user.sub);
    const host = req.get('host') || 'localhost:3000';
    const proto = req.protocol === 'https' ? 'https' : 'http';

    const httpUrl = `${proto}://${host}/api/telegram/calendar/feed/${token}.ics`;
    const webcalUrl = `webcal://${host}/api/telegram/calendar/feed/${token}.ics`;

    return {
      token,
      httpUrl,
      webcalUrl,
      instructions: {
        apple: 'iPhone yoki Mac brauzerida WebCal havolasini oching, u avtomatik ravishda Apple Calendar ilovasida obunani yoqadi.',
        google: 'Google Calendar sozlamalaridan "Boshqa taqvimlar" -> "URL orqali qo\'shish" bo\'limiga httpUrl manzilini kiriting.',
      },
    };
  }
}
