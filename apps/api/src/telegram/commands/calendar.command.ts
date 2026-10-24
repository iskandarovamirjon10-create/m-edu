import { Injectable } from '@nestjs/common';
import { TelegramCommandHandler, TelegramRequestContext } from './command.interface';
import { TelegramReply } from '../ui/telegram-ui.types';
import { TelegramCalendarService } from '../telegram-calendar.service';

@Injectable()
export class CalendarCommand implements TelegramCommandHandler {
  readonly name = 'calendar';
  readonly descriptionKey = 'calendar.title';
  readonly roles = 'ALL' as const;

  constructor(private readonly calendarService: TelegramCalendarService) {}

  async handle(request: TelegramRequestContext): Promise<TelegramReply> {
    const { ctx } = request;

    if (!ctx.principalId || ctx.kind !== 'USER') {
      return {
        text: '⚠️ Shaxsiy taqvimga ulanish faqat o\'quvchi va o\'qituvchilar profillari uchun mavjud.',
      };
    }

    const token = await this.calendarService.getOrCreateCalendarToken(ctx.principalId);
    const domain = process.env.APP_URL || 'https://medu.uz';
    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/+$/, '');

    const httpUrl = `https://${cleanDomain}/api/telegram/calendar/feed/${token}.ics`;
    const webcalUrl = `webcal://${cleanDomain}/api/telegram/calendar/feed/${token}.ics`;

    const text =
      `📅 <b>Apple & Google Calendar bilan Jonli Sinxronizatsiya</b>\n\n` +
      `Siz o'z dars jadvalingizni to'g'ridan-to'g'ri telefoningizdagi Taqvim (Calendar) ilovasiga ulab olishingiz mumkin.\n` +
      `Dars vaqtlari yoki xonalar o'zgarganda, telefoningizdagi kalendar <b>avtomatik yangilanadi</b>!\n\n` +
      `🍏 <b>iPhone / iPad / Mac uchun:</b>\n` +
      `Quyidagi tugmani bosing yoki Safari orqali WebCal havolasini oching:\n` +
      `<code>${webcalUrl}</code>\n\n` +
      `🤖 <b>Google Calendar (Android / Web) uchun:</b>\n` +
      `Google Calendar sozlamalaridan <i>"URL orqali qo'shish"</i> bo'limiga quyidagi manzilni kiriting:\n` +
      `<code>${httpUrl}</code>\n\n` +
      `🔔 <i>Har bir darsdan 15 daqiqa oldin telefoningiz avtomatik eslatma beradi!</i>`;

    return {
      text,
      keyboard: {
        inline_keyboard: [
          [
            {
              text: '🍏 Apple Calendar-ga qo\'shish',
              url: webcalUrl,
            },
          ],
          [
            {
              text: '◀️ Bosh menyu',
              callback_data: request.cb('mm'),
            },
          ],
        ],
      },
    };
  }
}
