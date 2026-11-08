import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../../prisma/prisma.module';
import { ArenaAvatarsController } from './controllers/arena-avatars.controller';
import { ArenaTitlesController } from './controllers/arena-titles.controller';
import { ArenaProfilesController } from './controllers/arena-profiles.controller';
import { ArenaQuestionsController } from './controllers/arena-questions.controller';
import { ArenaBattlesController } from './controllers/arena-battles.controller';
import { ArenaAvatarsService } from './services/arena-avatars.service';
import { ArenaTitlesService } from './services/arena-titles.service';
import { ArenaProfilesService } from './services/arena-profiles.service';
import { ArenaQuestionVerifierService } from './services/arena-question-verifier.service';
import { ArenaAiQuestionService } from './services/arena-ai-question.service';
import { ArenaQuestionsService } from './services/arena-questions.service';
import { ArenaBattleEngineService } from './services/arena-battle-engine.service';
import { ArenaMatchmakingService } from './services/arena-matchmaking.service';
import { ArenaGateway } from './gateways/arena.gateway';

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        return { secret };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [
    ArenaProfilesController,
    ArenaAvatarsController,
    ArenaTitlesController,
    ArenaQuestionsController,
    ArenaBattlesController,
  ],
  providers: [
    ArenaAvatarsService,
    ArenaTitlesService,
    ArenaProfilesService,
    ArenaQuestionVerifierService,
    ArenaAiQuestionService,
    ArenaQuestionsService,
    ArenaBattleEngineService,
    ArenaMatchmakingService,
    ArenaGateway,
  ],
  exports: [
    ArenaAvatarsService,
    ArenaTitlesService,
    ArenaProfilesService,
    ArenaQuestionVerifierService,
    ArenaAiQuestionService,
    ArenaQuestionsService,
    ArenaBattleEngineService,
    ArenaMatchmakingService,
    ArenaGateway,
  ],
})
export class MindArenaModule {}
