import { Injectable } from '@nestjs/common';
import { TelegramCommandHandler, TelegramRequestContext } from './command.interface';
import { TelegramReply } from '../ui/telegram-ui.types';
import { TelegramExecutiveBriefingService } from '../telegram-executive-briefing.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BriefingCommand implements TelegramCommandHandler {
  readonly name = 'briefing';
  readonly descriptionKey = 'briefing.title';
  readonly roles = ['ORG_ADMIN', 'SUPER_ADMIN', 'PLATFORM_OWNER', 'MANAGER'] as const;

  constructor(
    private readonly briefingService: TelegramExecutiveBriefingService,
    private readonly prisma: PrismaService,
  ) {}

  async handle(request: TelegramRequestContext): Promise<TelegramReply> {
    const { ctx } = request;

    const org = await this.prisma.organization.findUnique({
      where: { id: ctx.organizationId },
      select: { name: true, timezone: true },
    });

    const orgName = org?.name || 'M-EDU';
    const tz = org?.timezone || ctx.timezone || 'Asia/Tashkent';

    const briefingHtml = await this.briefingService.generateBriefingText(
      ctx.organizationId,
      orgName,
      tz,
    );

    return {
      text: briefingHtml,
      keyboard: {
        inline_keyboard: [
          [
            {
              text: '🔄 Yangilash',
              callback_data: request.cb('brf', 'refresh'),
            },
          ],
          [
            {
              text: '📊 Asosiy Menyu',
              callback_data: request.cb('mm'),
            },
          ],
        ],
      },
    };
  }
}
