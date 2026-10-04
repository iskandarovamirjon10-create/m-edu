import { Module } from '@nestjs/common';
import { StudentsModule } from '../students/students.module';
import { TeachersModule } from '../teachers/teachers.module';
import { GroupsModule } from '../groups/groups.module';
import { ScheduleModule } from '../schedule/schedule.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { PaymentsModule } from '../payments/payments.module';
import { UsersModule } from '../users/users.module';
import { ParentPortalModule } from '../parent-portal/parent-portal.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AiModule } from '../ai/ai.module';
import { TelegramCoreModule } from './telegram-core.module';
import { TelegramWebhookController } from './telegram-webhook.controller';
import { TelegramBootstrapService } from './telegram-bootstrap.service';
import {
  TELEGRAM_COMMANDS,
  TelegramCommandHandler,
} from './commands/command.interface';
import { TelegramCommandRouter } from './telegram-command.router';
import { TelegramCallbackRouter } from './telegram-callback.router';
import {
  HelpCommand,
  LanguageCommand,
  MenuCommand,
  SettingsCommand,
  StartCommand,
  UnlinkCommand,
} from './commands/menu.commands';
import {
  AttendanceCommand,
  NotificationsCommand,
  PaymentsCommand,
  ProfileCommand,
  ScheduleCommand,
} from './commands/data.commands';
import {
  AdminCommand,
  GroupsCommand,
  StudentsCommand,
  TeacherCommand,
  TeachersCommand,
  TodayCommand,
} from './commands/staff.commands';
import { CopilotCommand } from './commands/copilot.command';

/** Every command handler, in one list. */
const COMMAND_HANDLERS = [
  StartCommand,
  MenuCommand,
  HelpCommand,
  SettingsCommand,
  LanguageCommand,
  UnlinkCommand,
  ProfileCommand,
  ScheduleCommand,
  AttendanceCommand,
  PaymentsCommand,
  NotificationsCommand,
  AdminCommand,
  TeacherCommand,
  StudentsCommand,
  TeachersCommand,
  GroupsCommand,
  TodayCommand,
  CopilotCommand,
];

/**
 * Telegram commands, callbacks and the webhook endpoint.
 *
 * This module is the ONLY place that couples Telegram to business modules —
 * and it depends on their *application services*, never their repositories,
 * so no business logic is duplicated. Adding a command means adding a provider
 * and listing it in `COMMAND_HANDLERS`.
 */
@Module({
  imports: [
    TelegramCoreModule,
    StudentsModule,
    TeachersModule,
    GroupsModule,
    ScheduleModule,
    AttendanceModule,
    PaymentsModule,
    UsersModule,
    ParentPortalModule,
    NotificationsModule,
    AiModule,
  ],
  controllers: [TelegramWebhookController],
  providers: [
    ...COMMAND_HANDLERS,
    {
      provide: TELEGRAM_COMMANDS,
      useFactory: (...commands: TelegramCommandHandler[]) => commands,
      inject: COMMAND_HANDLERS,
    },
    TelegramCommandRouter,
    TelegramCallbackRouter,
    TelegramBootstrapService,
  ],
})
export class TelegramCommandsModule {}
