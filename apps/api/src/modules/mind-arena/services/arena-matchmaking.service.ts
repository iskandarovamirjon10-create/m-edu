import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  ArenaSubjectCategory,
  DuelMode,
  QuestionDifficulty,
} from '@prisma/client';
import { ArenaBattleEngineService, ActivePlayer } from './arena-battle-engine.service';
import { ArenaAvatarsService } from './arena-avatars.service';
import { randomUUID } from 'node:crypto';

export interface QueuedPlayer extends ActivePlayer {
  organizationId: string;
  subjectCategory: ArenaSubjectCategory;
  difficulty: QuestionDifficulty;
  mode: DuelMode;
  joinedAt: number;
}

const BOT_NAMES = [
  'CyberBot Neo',
  'Nexus AI',
  'Tensor Blade',
  'Quantum Valkyrie',
  'Algo Master',
  'Matrix Duelist',
  'Neural Nomad',
  'Binary Phantom',
];

@Injectable()
export class ArenaMatchmakingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ArenaMatchmakingService.name);
  private readonly queue = new Map<string, QueuedPlayer>(); // studentId -> QueuedPlayer
  private readonly customRooms = new Map<
    string,
    {
      roomCode: string;
      host: QueuedPlayer;
      createdAt: number;
    }
  >();
  private loopInterval: any = null;

  constructor(
    private readonly battleEngine: ArenaBattleEngineService,
    private readonly avatarsService: ArenaAvatarsService,
  ) {}

  onModuleInit() {
    // Run matchmaking sweep every 1.5 seconds
    this.loopInterval = setInterval(() => {
      this.sweepQueue();
    }, 1500);
  }

  onModuleDestroy() {
    if (this.loopInterval) {
      clearInterval(this.loopInterval);
    }
  }

  /**
   * Adds a player to the matchmaking pool and triggers instant match check.
   */
  async enqueuePlayer(player: QueuedPlayer) {
    this.logger.log(
      `Player joined queue: ${player.name} (Rating: ${player.rating}, Subj: ${player.subjectCategory}, Diff: ${player.difficulty})`,
    );

    this.queue.set(player.studentId, player);
    await this.sweepQueue();
  }

  /**
   * Removes a player from the queue (e.g. cancelled search).
   */
  dequeuePlayer(studentId: string) {
    this.queue.delete(studentId);
  }

  /**
   * Removes a player when their socket disconnects.
   */
  dequeueSocket(socketId: string) {
    for (const [sId, p] of this.queue.entries()) {
      if (p.socketId === socketId) {
        this.queue.delete(sId);
        break;
      }
    }
  }

  /**
   * Main matchmaking loop that pairs players or triggers AI bot fallback.
   */
  async sweepQueue() {
    if (this.queue.size === 0) return;

    const now = Date.now();
    const waitingPlayers = Array.from(this.queue.values());
    const matchedIds = new Set<string>();

    for (let i = 0; i < waitingPlayers.length; i++) {
      const p1 = waitingPlayers[i];
      if (matchedIds.has(p1.studentId)) continue;

      const waitTimeSec = (now - p1.joinedAt) / 1000;
      // Rating tolerance expands with wait time (150 base + 50 per 3 seconds)
      const tolerance = 150 + Math.floor(waitTimeSec / 3) * 50;

      let matchedWith: QueuedPlayer | null = null;

      // Look for a compatible human opponent
      for (let j = i + 1; j < waitingPlayers.length; j++) {
        const p2 = waitingPlayers[j];
        if (matchedIds.has(p2.studentId)) continue;

        if (p1.mode === p2.mode && p1.difficulty === p2.difficulty) {
          const subjectMatch =
            p1.subjectCategory === p2.subjectCategory ||
            p1.subjectCategory === ArenaSubjectCategory.GENERAL_SCIENCE ||
            p2.subjectCategory === ArenaSubjectCategory.GENERAL_SCIENCE;

          if (subjectMatch) {
            const ratingDiff = Math.abs(p1.rating - p2.rating);
            if (ratingDiff <= tolerance) {
              matchedWith = p2;
              break;
            }
          }
        }
      }

      if (matchedWith) {
        // Human vs Human match found!
        matchedIds.add(p1.studentId);
        matchedIds.add(matchedWith.studentId);
        this.queue.delete(p1.studentId);
        this.queue.delete(matchedWith.studentId);

        try {
          await this.battleEngine.createDuelRoom(
            p1.organizationId,
            [p1, matchedWith],
            p1.subjectCategory,
            p1.difficulty,
            p1.mode,
          );
        } catch (err: any) {
          this.logger.error(`Failed to create duel room: ${err.message}`);
        }
      } else if (waitTimeSec >= 8) {
        // Zero Wait Time Fallback: Match with an intelligent AI Duelist Bot
        matchedIds.add(p1.studentId);
        this.queue.delete(p1.studentId);

        const bot = await this.spawnAiDuelistBot(p1);
        try {
          await this.battleEngine.createDuelRoom(
            p1.organizationId,
            [p1, bot],
            p1.subjectCategory,
            p1.difficulty,
            p1.mode,
          );
        } catch (err: any) {
          this.logger.error(`Failed to create duel room with AI Bot: ${err.message}`);
        }
      }
    }
  }

  /**
   * Spawns an AI Bot player matching the student's rating and aesthetic caliber.
   */
  private async spawnAiDuelistBot(humanPlayer: QueuedPlayer): Promise<ActivePlayer> {
    const randomName = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
    const catalog = await this.avatarsService.getCatalog();
    const randomAvatar = catalog[Math.floor(Math.random() * catalog.length)];

    // Mirror human rating with a subtle realistic jitter (-25 to +25)
    const ratingJitter = Math.floor(Math.random() * 50) - 25;
    const botRating = Math.max(100, humanPlayer.rating + ratingJitter);

    return {
      studentId: `bot-${randomUUID()}`,
      userId: `bot-user-${randomUUID()}`,
      name: randomName,
      avatarUrl: randomAvatar?.battleRenderUrl || '/avatars/arena/cyber-scholar/battle.png',
      titleName: 'Aql Jangchisi',
      titleIcon: '⚔️',
      rating: botRating,
      socketId: 'bot-socket',
      isBot: true,
    };
  }

  getQueueSize(): number {
    return this.queue.size;
  }

  createCustomRoom(host: QueuedPlayer): string {
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    const roomCode = `ARENA-${randomDigits}`;
    this.customRooms.set(roomCode, {
      roomCode,
      host,
      createdAt: Date.now(),
    });
    this.logger.log(`Custom 1v1 Room created: ${roomCode} by ${host.name}`);
    return roomCode;
  }

  getCustomRoom(roomCode: string) {
    return this.customRooms.get(roomCode.toUpperCase().trim());
  }

  deleteCustomRoom(roomCode: string) {
    this.customRooms.delete(roomCode.toUpperCase().trim());
  }

  async joinCustomRoom(guest: QueuedPlayer, roomCode: string) {
    const code = roomCode.toUpperCase().trim();
    const entry = this.customRooms.get(code);
    if (!entry) {
      throw new Error('Maxsus xona topilmadi yoki kodi muddati o‘tgan');
    }

    this.customRooms.delete(code);
    this.logger.log(`Custom 1v1 Room matched: ${code} between ${entry.host.name} and ${guest.name}`);

    return this.battleEngine.createDuelRoom(
      entry.host.organizationId,
      [entry.host, guest],
      entry.host.subjectCategory,
      entry.host.difficulty,
      DuelMode.SOLO_1V1,
    );
  }
}
