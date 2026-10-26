import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TurnstileRelayService } from './turnstile-relay.service';
import { TurnstileRelayController } from './turnstile-relay.controller';

@Module({
  imports: [ConfigModule],
  controllers: [TurnstileRelayController],
  providers: [TurnstileRelayService],
  exports: [TurnstileRelayService],
})
export class DevicesModule {}
