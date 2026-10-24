import { Injectable } from '@nestjs/common';
import { TelegramCommandHandler, TelegramRequestContext } from './command.interface';
import { InlineKeyboardButton, TelegramReply } from '../ui/telegram-ui.types';
import { PrismaService } from '../../prisma/prisma.service';
import { getWeekdayInTimezone } from './command-helpers';

@Injectable()
export class TeacherCockpitCommand implements TelegramCommandHandler {
  readonly name = 'cockpit';
  readonly descriptionKey = 'cockpit.title';
  readonly roles = ['TEACHER', 'ORG_ADMIN', 'SUPER_ADMIN'] as const;

  constructor(private readonly prisma: PrismaService) {}

  async handle(request: TelegramRequestContext): Promise<TelegramReply> {
    const { ctx } = request;

    if (!ctx.principalId || ctx.kind !== 'USER') {
      return {
        text: '⚠️ O\'qituvchi boshqaruv markazidan foydalanish uchun tizimga o\'qituvchi sifatida kirilgan bo\'lishi shart.',
      };
    }

    const teacher = await this.prisma.teacher.findFirst({
      where: { userId: ctx.principalId },
      select: { id: true },
    });

    if (!teacher) {
      return {
        text: '⚠️ Sizning profilingiz o\'qituvchi sifatida ro\'yxatdan o\'tmagan.',
      };
    }

    const teacherId = teacher.id;
    const tz = ctx.timezone || 'Asia/Tashkent';
    const dayOfWeek = getWeekdayInTimezone(new Date(), tz);

    const schedulesToday = await this.prisma.schedule.findMany({
      where: {
        dayOfWeek,
        isActive: true,
        group: {
          teacherId,
          isActive: true,
        },
      },
      include: {
        group: {
          include: {
            course: true,
            _count: { select: { enrollments: true } },
          },
        },
      },
      orderBy: { startTime: 'asc' },
    });

    if (schedulesToday.length === 0) {
      return {
        text:
          `👨‍🏫 <b>O'qituvchi Boshqaruv Markazi (Teacher Cockpit)</b>\n\n` +
          `Bugungi kunda sizga rejalashtirilgan darslar yo'q.\n` +
          `Haftaning boshqa kunlari dars jadvalini ko'rish uchun /calendar yoki /menu buyrug'idan foydalaning.`,
        keyboard: {
          inline_keyboard: [
            [
              { text: '🗓 Dars jadvali', callback_data: request.cb('cmd', 'schedule') },
              { text: '👥 Guruhlarim', callback_data: request.cb('cmd', 'groups') },
            ],
            [
              { text: '◀️ Bosh menyu', callback_data: request.cb('mm') },
            ],
          ],
        },
      };
    }

    let text =
      `👨‍🏫 <b>O'qituvchi Boshqaruv Markazi (Teacher Cockpit)</b>\n` +
      `Bugungi darslaringiz ro'yxati (${schedulesToday.length} ta):\n\n`;

    const buttons: InlineKeyboardButton[][] = [];

    for (const [index, s] of schedulesToday.entries()) {
      const g = s.group;
      const count = g._count?.enrollments || 0;
      text +=
        `<b>${index + 1}. ${g.course?.name || g.name}</b> (${g.name})\n` +
        `⏰ Vaqt: <b>${s.startTime} — ${s.endTime}</b>\n` +
        `📍 Xona: <b>${s.room || 'Asosiy xona'}</b> | O'quvchilar: <b>${count} nafar</b>\n\n`;

      buttons.push([
        {
          text: `📋 Davomat (${g.name})`,
          callback_data: request.cb('cmd', 'attendance'),
        },
        {
          text: `👥 Guruh ro'yxati`,
          callback_data: request.cb('cmd', 'groups'),
        },
      ]);
    }

    text +=
      `💡 <i>Smart Doska: Doskani rasmga olib, guruh nomini yozib botga yuborsangiz, ` +
      `u barcha o'quvchi va ota-onalarga avtomatik yetkaziladi!</i>`;

    buttons.push([
      { text: '🔄 Yangilash', callback_data: request.cb('cmd', 'cockpit') },
      { text: '🗓 Dars jadvali', callback_data: request.cb('cmd', 'schedule') },
    ]);
    buttons.push([{ text: '◀️ Bosh menyu', callback_data: request.cb('mm') }]);

    return {
      text,
      keyboard: {
        inline_keyboard: buttons,
      },
    };
  }
}
