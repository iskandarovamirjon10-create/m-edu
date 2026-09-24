import { Module } from '@nestjs/common';
import { GamificationController } from './gamification.controller';
import { GamificationService } from './gamification.service';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * Gamification module: XP, coins and levels for students.
 *
 * Exports the service so attendance, homework and exam modules can award XP
 * directly from their business flows.
 */
@Module({
  imports: [PrismaModule],
  controllers: [GamificationController],
  providers: [GamificationService],
  exports: [GamificationService],
})
export class GamificationModule {}
