import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/jwt-auth.guard';
import { RolesGuard } from '../../../auth/roles.guard';
import { AllowSelfService, AllowAnyRole } from '../../../auth/roles.decorator';
import { CurrentUser } from '../../../auth/current-user.decorator';
import type { RequestUser } from '../../../auth/types';
import { PrismaService } from '../../../prisma/prisma.service';
import { ArenaBattleEngineService } from '../services/arena-battle-engine.service';

@ApiTags('Mind Arena Battles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('arena/battles')
export class ArenaBattlesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly battleEngine: ArenaBattleEngineService,
  ) {}

  @Get('recent')
  @AllowSelfService()
  @ApiOperation({ summary: 'Get recent completed duels for the current student' })
  async getRecentDuels(@CurrentUser() user: RequestUser) {
    const student = await this.prisma.student.findFirst({
      where: { userId: user.id },
      select: { id: true },
    });

    if (!student) {
      return [];
    }

    const duels = await this.prisma.duelParticipant.findMany({
      where: { studentId: student.id },
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        room: {
          include: {
            participants: {
              include: {
                student: {
                  include: {
                    user: { select: { firstName: true, lastName: true } },
                    duelProfile: {
                      include: {
                        activeAvatar: true,
                        activeTitle: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    return duels.map((dp) => {
      const room = dp.room;
      const opponent = room.participants.find((p) => p.studentId !== student.id);
      return {
        id: room.id,
        mode: room.mode,
        startedAt: room.startedAt,
        finishedAt: room.finishedAt,
        isWinner: dp.isWinner,
        myScore: dp.score,
        ratingChange: dp.ratingChange,
        xpEarned: dp.xpEarned,
        coinsEarned: dp.coinsEarned,
        opponent: opponent
          ? {
              name: `${opponent.student.user.firstName} ${opponent.student.user.lastName}`.trim(),
              avatarUrl: opponent.student.duelProfile?.activeAvatar?.thumbnailUrl,
              titleName: opponent.student.duelProfile?.activeTitle?.name,
              score: opponent.score,
            }
          : { name: 'AI Duelist', score: 0 },
      };
    });
  }

  @Get(':id')
  @AllowSelfService()
  @ApiOperation({ summary: 'Get details of a completed duel room and rounds' })
  async getDuelDetails(@Param('id') id: string) {
    const room = await this.prisma.duelRoom.findUnique({
      where: { id },
      include: {
        participants: {
          include: {
            student: {
              include: {
                user: { select: { firstName: true, lastName: true } },
                duelProfile: {
                  include: {
                    activeAvatar: true,
                    activeTitle: true,
                  },
                },
              },
            },
          },
        },
        rounds: {
          orderBy: { roundNumber: 'asc' },
          include: {
            answers: true,
          },
        },
      },
    });

    if (!room) {
      throw new NotFoundException(`Duel room with ID ${id} not found`);
    }

    return room;
  }
}
