import { Module } from '@nestjs/common';
import { TelegramCoreModule } from './telegram-core.module';
import { TelegramCommandsModule } from './telegram-commands.module';

/**
 * Umbrella Telegram module.
 *
 * Split into two so the dependency graph stays acyclic:
 *   - `TelegramCoreModule` — adapter/identity/linking; depends on nothing in
 *     the business domain, so the notification pipeline can import it.
 *   - `TelegramCommandsModule` — commands, callbacks, webhook; depends on the
 *     business application services.
 *
 * Consumers that only need the Bot API adapter (the notification worker,
 * automation rules) should import `TelegramCoreModule` directly.
 */
@Module({
  imports: [TelegramCoreModule, TelegramCommandsModule],
  exports: [TelegramCoreModule],
})
export class TelegramModule {}
