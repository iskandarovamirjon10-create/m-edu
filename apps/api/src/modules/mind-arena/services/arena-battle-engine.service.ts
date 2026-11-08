import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  ArenaSubjectCategory,
  DuelMode,
  DuelRoomStatus,
  QuestionDifficulty,
} from '@prisma/client';
import { ArenaQuestionsService } from './arena-questions.service';
import { ArenaTitlesService } from './arena-titles.service';

export interface ActivePlayer {
  studentId: string;
  userId: string;
  name: string;
  avatarUrl: string;
  titleName?: string;
  titleIcon?: string;
  rating: number;
  socketId: string;
  isBot?: boolean;
}

export interface RoundAnswerRecord {
  selectedKey: string;
  timeSpentMs: number;
  isCorrect: boolean;
  score: number;
  speedBonus: number;
}

export interface ActiveDuelRoomState {
  id: string;
  organizationId: string;
  mode: DuelMode;
  subjectCategory: ArenaSubjectCategory;
  difficulty: QuestionDifficulty;
  totalRounds: number;
  timePerRoundSec: number;
  currentRoundNumber: number;
  roundStatus: 'COUNTDOWN' | 'ACTIVE' | 'ROUND_OVER' | 'FINISHED';
  players: ActivePlayer[];
  roundQuestion?: {
    id: string;
    roundId: string;
    questionText: string;
    codeSnippet?: string | null;
    codeLanguage?: string | null;
    imageUrl?: string | null;
    options: Array<{ optionKey: string; optionText: string }>;
    correctOptionKey: string;
    explanation: string;
    timeLimitSec: number;
  };
  playerAnswers: Map<string, RoundAnswerRecord>;
  playerTotalScores: Map<string, number>;
  playerCorrectCounts: Map<string, number>;
  powerUpsUsed: Map<string, Set<'FIFTY_FIFTY' | 'ADD_TIME' | 'HINT'>>;
  roomRoundsHistory: any[];
  roundTimer?: any;
  countdownTimer?: any;
  botAnswerTimer?: any;
  startedAt: Date;
}

@Injectable()
export class ArenaBattleEngineService {
  private readonly logger = new Logger(ArenaBattleEngineService.name);
  private readonly activeRooms = new Map<string, ActiveDuelRoomState>();

  // Callback to emit socket events back to clients
  private emitEventCallback: ((event: string, roomId: string, data: any) => void) | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly questionsService: ArenaQuestionsService,
    private readonly titlesService: ArenaTitlesService,
  ) {}

  /**
   * Registers the callback from ArenaGateway to broadcast events.
   */
  setEmitter(emitter: (event: string, roomId: string, data: any) => void) {
    this.emitEventCallback = emitter;
  }

  private broadcast(event: string, roomId: string, data: any) {
    if (this.emitEventCallback) {
      this.emitEventCallback(event, roomId, data);
    }
  }

  /**
   * Creates a new live battle room between matched players.
   */
  async createDuelRoom(
    organizationId: string,
    players: ActivePlayer[],
    subjectCategory: ArenaSubjectCategory,
    difficulty: QuestionDifficulty,
    mode: DuelMode = DuelMode.SOLO_1V1,
  ): Promise<ActiveDuelRoomState> {
    const totalRounds = 5;
    const timePerRoundSec = 15;

    // 1. Fetch 5 verified approved questions
    const questions = await this.questionsService.getBattleQuestions(
      organizationId,
      subjectCategory,
      difficulty,
      totalRounds,
    );

    if (questions.length === 0) {
      throw new Error(`Savollar topilmadi (Fan: ${subjectCategory}, Qiyinlik: ${difficulty})`);
    }

    // 2. Persist DuelRoom in database
    const roomRecord = await this.prisma.duelRoom.create({
      data: {
        organizationId,
        mode,
        status: DuelRoomStatus.MATCHED,
        totalRounds,
        timePerRoundSec,
        startedAt: new Date(),
        participants: {
          create: players
            .filter((p) => !p.isBot)
            .map((p, idx) => ({
              studentId: p.studentId,
              teamNumber: idx + 1,
              score: 0,
            })),
        },
      },
    });

    // 3. Persist immutable DuelRound snapshots in DB
    const persistedRounds = [];
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const correctOption = q.options.find((o) => o.isCorrect);
      const correctKey = correctOption ? correctOption.optionKey : 'A';

      const round = await this.prisma.duelRound.create({
        data: {
          duelRoomId: roomRecord.id,
          roundNumber: i + 1,
          questionId: q.id,
          questionVersion: q.version,
          questionText: q.questionText,
          codeSnippet: q.codeSnippet,
          imageUrl: q.imageUrl,
          correctOptionKey: correctKey,
          timeLimitSec: q.timeLimitSec || timePerRoundSec,
          optionsSnapshot: q.options.map((opt) => ({
            optionKey: opt.optionKey,
            optionText: opt.optionText,
            explanation: opt.explanation,
          })),
        },
      });
      persistedRounds.push({ ...round, fullQuestion: q });
    }

    // 4. Create in-memory active room state
    const roomState: ActiveDuelRoomState = {
      id: roomRecord.id,
      organizationId,
      mode,
      subjectCategory,
      difficulty,
      totalRounds,
      timePerRoundSec,
      currentRoundNumber: 0,
      roundStatus: 'COUNTDOWN',
      players,
      playerAnswers: new Map(),
      playerTotalScores: new Map(players.map((p) => [p.studentId, 0])),
      playerCorrectCounts: new Map(players.map((p) => [p.studentId, 0])),
      powerUpsUsed: new Map(players.map((p) => [p.studentId, new Set()])),
      roomRoundsHistory: [],
      startedAt: new Date(),
    };

    this.activeRooms.set(roomRecord.id, roomState);

    // 5. Notify all players that match has been found!
    this.broadcast('duel_matched', roomRecord.id, {
      roomId: roomRecord.id,
      mode,
      subjectCategory,
      difficulty,
      totalRounds,
      players: players.map((p) => ({
        studentId: p.studentId,
        name: p.name,
        avatarUrl: p.avatarUrl,
        titleName: p.titleName,
        titleIcon: p.titleIcon,
        rating: p.rating,
        isBot: p.isBot ?? false,
      })),
    });

    // Start round sequence after 2.5 seconds
    setTimeout(() => {
      this.startNextRound(roomRecord.id);
    }, 2500);

    return roomState;
  }

  /**
   * Starts the next round in the duel.
   */
  async startNextRound(roomId: string) {
    const room = this.activeRooms.get(roomId);
    if (!room) return;

    room.currentRoundNumber += 1;

    // Check if duel has reached the end
    if (room.currentRoundNumber > room.totalRounds) {
      await this.finishDuel(roomId);
      return;
    }

    // Fetch the persisted DuelRound snapshot from DB
    const roundRecord = await this.prisma.duelRound.findUnique({
      where: {
        duelRoomId_roundNumber: {
          duelRoomId: roomId,
          roundNumber: room.currentRoundNumber,
        },
      },
      include: {
        arenaQuestion: true,
      },
    });

    if (!roundRecord) {
      this.logger.error(`DuelRound not found for room ${roomId}, round ${room.currentRoundNumber}`);
      await this.finishDuel(roomId);
      return;
    }

    const optionsSnapshot = roundRecord.optionsSnapshot as Array<{
      optionKey: string;
      optionText: string;
      explanation?: string;
    }>;

    // Set round state
    room.playerAnswers.clear();
    room.roundStatus = 'ACTIVE';
    room.roundQuestion = {
      id: roundRecord.questionId || '',
      roundId: roundRecord.id,
      questionText: roundRecord.questionText,
      codeSnippet: roundRecord.codeSnippet,
      codeLanguage: roundRecord.arenaQuestion?.codeLanguage || null,
      imageUrl: roundRecord.imageUrl,
      options: optionsSnapshot.map((o) => ({
        optionKey: o.optionKey,
        optionText: o.optionText,
      })),
      correctOptionKey: roundRecord.correctOptionKey,
      explanation: roundRecord.arenaQuestion?.explanation || 'Toʻgʻri javob tasdiqlangan.',
      timeLimitSec: roundRecord.timeLimitSec,
    };

    // Broadcast round start to players (CORRECT ANSWER IS STRIPPED!)
    this.broadcast('round_started', roomId, {
      roundNumber: room.currentRoundNumber,
      totalRounds: room.totalRounds,
      timeLimitSec: room.roundQuestion.timeLimitSec,
      question: {
        questionText: room.roundQuestion.questionText,
        codeSnippet: room.roundQuestion.codeSnippet,
        codeLanguage: room.roundQuestion.codeLanguage,
        imageUrl: room.roundQuestion.imageUrl,
        options: room.roundQuestion.options,
      },
    });

    // If there is an AI Bot player in the room, schedule simulated bot answer
    const botPlayer = room.players.find((p) => p.isBot);
    if (botPlayer) {
      this.scheduleBotAnswer(roomId, botPlayer, room.roundQuestion);
    }

    // Set server-side timeout for round completion (+ 500ms network buffer)
    const timeoutMs = (room.roundQuestion.timeLimitSec + 0.5) * 1000;
    if (room.roundTimer) clearTimeout(room.roundTimer);
    room.roundTimer = setTimeout(() => {
      this.concludeRound(roomId);
    }, timeoutMs);
  }

  /**
   * Records a player's answer for the current active round.
   */
  async submitAnswer(
    roomId: string,
    studentId: string,
    selectedKey: string,
    timeSpentMs: number,
  ) {
    const room = this.activeRooms.get(roomId);
    if (!room || room.roundStatus !== 'ACTIVE' || !room.roundQuestion) {
      return { success: false, message: 'Raund faol emas' };
    }

    if (room.playerAnswers.has(studentId)) {
      return { success: false, message: 'Siz allaqachon javob berdingiz' };
    }

    const correctKey = room.roundQuestion.correctOptionKey;
    const isCorrect = selectedKey.toUpperCase() === correctKey.toUpperCase();

    // Scoring logic:
    // Base: 100 points for correct answer
    // Speed bonus: up to +50 points if answered quickly
    let score = 0;
    let speedBonus = 0;
    if (isCorrect) {
      const maxMs = room.roundQuestion.timeLimitSec * 1000;
      const speedRatio = Math.max(0, 1 - timeSpentMs / maxMs);
      speedBonus = Math.round(speedRatio * 50);
      score = 100 + speedBonus;
    }

    // Save answer record in memory
    const answerRecord: RoundAnswerRecord = {
      selectedKey: selectedKey.toUpperCase(),
      timeSpentMs,
      isCorrect,
      score,
      speedBonus,
    };
    room.playerAnswers.set(studentId, answerRecord);

    // Update player totals
    const prevTotal = room.playerTotalScores.get(studentId) || 0;
    room.playerTotalScores.set(studentId, prevTotal + score);

    if (isCorrect) {
      const prevCorrect = room.playerCorrectCounts.get(studentId) || 0;
      room.playerCorrectCounts.set(studentId, prevCorrect + 1);
    }

    // Persist answer in DB (for human players)
    const player = room.players.find((p) => p.studentId === studentId);
    if (player && !player.isBot) {
      try {
        await this.prisma.duelRoundAnswer.upsert({
          where: {
            roundId_studentId: {
              roundId: room.roundQuestion.roundId,
              studentId,
            },
          },
          update: {
            selectedKey: answerRecord.selectedKey,
            isCorrect: answerRecord.isCorrect,
            timeSpentMs: answerRecord.timeSpentMs,
            scoreEarned: answerRecord.score,
          },
          create: {
            roundId: room.roundQuestion.roundId,
            studentId,
            selectedKey: answerRecord.selectedKey,
            isCorrect: answerRecord.isCorrect,
            timeSpentMs: answerRecord.timeSpentMs,
            scoreEarned: answerRecord.score,
          },
        });

        // Concurrency-safe atomic usage increment
        if (room.roundQuestion.id) {
          await this.questionsService.recordQuestionUsage(
            room.roundQuestion.id,
            isCorrect,
          );
        }
      } catch (err: any) {
        this.logger.error(`Failed to persist duel answer: ${err.message}`);
      }
    }

    // Broadcast that player answered (without revealing the key!)
    this.broadcast('player_answered', roomId, {
      studentId,
      timeSpentMs,
    });

    // If all players in the room answered, conclude round immediately!
    if (room.playerAnswers.size >= room.players.length) {
      if (room.roundTimer) clearTimeout(room.roundTimer);
      if (room.botAnswerTimer) clearTimeout(room.botAnswerTimer);
      this.concludeRound(roomId);
    }

    return { success: true, isCorrect, score, speedBonus };
  }

  /**
   * Concludes the current round, reveals answers, and schedules next round.
   */
  async concludeRound(roomId: string) {
    const room = this.activeRooms.get(roomId);
    if (!room || room.roundStatus !== 'ACTIVE' || !room.roundQuestion) return;

    room.roundStatus = 'ROUND_OVER';
    if (room.roundTimer) clearTimeout(room.roundTimer);
    if (room.botAnswerTimer) clearTimeout(room.botAnswerTimer);

    // Build round summary
    const answersSummary = room.players.map((p) => {
      const ans = room.playerAnswers.get(p.studentId);
      return {
        studentId: p.studentId,
        name: p.name,
        avatarUrl: p.avatarUrl,
        selectedKey: ans?.selectedKey || null,
        isCorrect: ans?.isCorrect ?? false,
        scoreEarned: ans?.score ?? 0,
        speedBonus: ans?.speedBonus ?? 0,
        timeSpentMs: ans?.timeSpentMs ?? room.timePerRoundSec * 1000,
        totalScore: room.playerTotalScores.get(p.studentId) || 0,
      };
    });

    // Record round in history for post-battle analysis
    if (!room.roomRoundsHistory) room.roomRoundsHistory = [];
    room.roomRoundsHistory.push({
      roundNumber: room.currentRoundNumber,
      questionText: room.roundQuestion.questionText,
      codeSnippet: room.roundQuestion.codeSnippet,
      codeLanguage: room.roundQuestion.codeLanguage,
      options: room.roundQuestion.options,
      correctOptionKey: room.roundQuestion.correctOptionKey,
      explanation: room.roundQuestion.explanation,
      answers: answersSummary,
    });

    // Broadcast round ended with full reveal & explanation
    this.broadcast('round_ended', roomId, {
      roundNumber: room.currentRoundNumber,
      correctOptionKey: room.roundQuestion.correctOptionKey,
      explanation: room.roundQuestion.explanation,
      answers: answersSummary,
    });

    // Wait 3.5 seconds for players to review answer and animation, then proceed
    setTimeout(() => {
      this.startNextRound(roomId);
    }, 3500);
  }

  /**
   * Concludes the duel, calculates ELO ratings, XP & M-Coin rewards, and unlocks titles.
   */
  async finishDuel(roomId: string, surrenderedByStudentId?: string) {
    const room = this.activeRooms.get(roomId);
    if (!room || room.roundStatus === 'FINISHED') return;

    room.roundStatus = 'FINISHED';
    if (room.roundTimer) clearTimeout(room.roundTimer);
    if (room.botAnswerTimer) clearTimeout(room.botAnswerTimer);

    // Determine winner
    let p1 = room.players[0];
    let p2 = room.players[1];
    let p1Score = room.playerTotalScores.get(p1.studentId) || 0;
    let p2Score = room.playerTotalScores.get(p2.studentId) || 0;

    let winnerId: string | null = null;
    let isDraw = false;

    if (surrenderedByStudentId) {
      winnerId = surrenderedByStudentId === p1.studentId ? p2.studentId : p1.studentId;
    } else if (p1Score > p2Score) {
      winnerId = p1.studentId;
    } else if (p2Score > p1Score) {
      winnerId = p2.studentId;
    } else {
      isDraw = true;
    }

    // ELO Rating calculation
    const K = 32;
    const expected1 = 1 / (1 + Math.pow(10, (p2.rating - p1.rating) / 400));
    const expected2 = 1 / (1 + Math.pow(10, (p1.rating - p2.rating) / 400));

    let actual1 = isDraw ? 0.5 : winnerId === p1.studentId ? 1 : 0;
    let actual2 = isDraw ? 0.5 : winnerId === p2.studentId ? 1 : 0;

    const ratingDelta1 = Math.round(K * (actual1 - expected1));
    const ratingDelta2 = Math.round(K * (actual2 - expected2));

    const finalResults = [];

    // Process DB updates for human players
    for (const player of room.players) {
      const isWinner = winnerId === player.studentId;
      const isPlayerDraw = isDraw;
      const ratingDelta = player.studentId === p1.studentId ? ratingDelta1 : ratingDelta2;
      const totalScore = room.playerTotalScores.get(player.studentId) || 0;
      const correctAnswers = room.playerCorrectCounts.get(player.studentId) || 0;

      // Rewards
      let xpEarned = isWinner ? 150 : isPlayerDraw ? 75 : 50;
      let coinsEarned = isWinner ? 10 : isPlayerDraw ? 4 : 2;

      let newTitleUnlocked: any = null;

      if (!player.isBot) {
        try {
          // Update Participant record
          await this.prisma.duelParticipant.updateMany({
            where: {
              roomId,
              studentId: player.studentId,
            },
            data: {
              score: totalScore,
              accuracy: (correctAnswers / room.totalRounds) * 100,
              isWinner,
              xpEarned,
              coinsEarned,
              ratingChange: ratingDelta,
            },
          });

          // Fetch student duel profile
          const profile = await this.prisma.studentDuelProfile.findUnique({
            where: { studentId: player.studentId },
          });

          if (profile) {
            const newRating = Math.max(100, profile.rating + ratingDelta);
            const newPeak = Math.max(profile.peakRating, newRating);
            const newStreak = isWinner ? profile.winStreak + 1 : 0;
            const newBestStreak = Math.max(profile.bestStreak, newStreak);
            const newWins = profile.wins + (isWinner ? 1 : 0);
            const newLosses = profile.losses + (!isWinner && !isPlayerDraw ? 1 : 0);
            const newDraws = profile.draws + (isPlayerDraw ? 1 : 0);
            const newTotalDuels = profile.totalDuels + 1;

            await this.prisma.studentDuelProfile.update({
              where: { studentId: player.studentId },
              data: {
                rating: newRating,
                peakRating: newPeak,
                totalDuels: newTotalDuels,
                wins: newWins,
                losses: newLosses,
                draws: newDraws,
                winStreak: newStreak,
                bestStreak: newBestStreak,
                totalQuestionsAnswered: { increment: room.totalRounds },
                correctAnswersCount: { increment: correctAnswers },
                lastBattleAt: new Date(),
              },
            });

            // Check Title Unlocks
            newTitleUnlocked = await this.titlesService.checkAndUnlockTitles(
              player.studentId,
              player.rating,
              newWins,
              newBestStreak,
            );
          }
        } catch (err: any) {
          this.logger.error(`Error settling rewards for ${player.studentId}: ${err.message}`);
        }
      }

      finalResults.push({
        studentId: player.studentId,
        name: player.name,
        avatarUrl: player.avatarUrl,
        isWinner,
        isDraw,
        totalScore,
        correctCount: correctAnswers,
        ratingDelta,
        newRating: Math.max(100, player.rating + ratingDelta),
        xpEarned,
        coinsEarned,
        newTitleUnlocked,
      });
    }

    // Update room status in DB
    await this.prisma.duelRoom.update({
      where: { id: roomId },
      data: {
        status: DuelRoomStatus.COMPLETED,
        finishedAt: new Date(),
        winnerTeam: isDraw ? null : winnerId === p1.studentId ? 1 : 2,
      },
    });

    // Broadcast final battle podium with full rounds history for post-battle analysis
    this.broadcast('duel_finished', roomId, {
      roomId,
      isDraw,
      winnerId,
      results: finalResults,
      roundsHistory: room.roomRoundsHistory || [],
    });

    // Cleanup active room from memory after 15 seconds
    setTimeout(() => {
      this.activeRooms.delete(roomId);
    }, 15000);
  }

  /**
   * Simulates an intelligent human-like response from the AI Duelist bot.
   */
  private scheduleBotAnswer(
    roomId: string,
    bot: ActivePlayer,
    roundQuestion: NonNullable<ActiveDuelRoomState['roundQuestion']>,
  ) {
    const room = this.activeRooms.get(roomId);
    if (!room) return;

    // Realistic human delay between 3.5s and 8.5s
    const answerDelayMs = Math.round(3500 + Math.random() * 5000);

    // Dynamic bot intelligence based on difficulty
    let accuracy = 0.75;
    if (room.difficulty === QuestionDifficulty.EASY) accuracy = 0.88;
    if (room.difficulty === QuestionDifficulty.HARD) accuracy = 0.6;

    const willAnswerCorrectly = Math.random() < accuracy;
    let chosenKey = roundQuestion.correctOptionKey;

    if (!willAnswerCorrectly) {
      // Pick a random distractor
      const distractors = roundQuestion.options
        .map((o) => o.optionKey)
        .filter((k) => k !== roundQuestion.correctOptionKey);
      chosenKey = distractors[Math.floor(Math.random() * distractors.length)] || 'A';
    }

    room.botAnswerTimer = setTimeout(() => {
      this.submitAnswer(roomId, bot.studentId, chosenKey, answerDelayMs);
    }, answerDelayMs);
  }

  usePowerUp(
    roomId: string,
    studentId: string,
    type: 'FIFTY_FIFTY' | 'ADD_TIME' | 'HINT',
  ) {
    const room = this.activeRooms.get(roomId);
    if (!room || room.roundStatus !== 'ACTIVE' || !room.roundQuestion) {
      return { success: false, message: 'Raund faol emas' };
    }

    const playerPowerUps = room.powerUpsUsed?.get(studentId) || new Set();
    if (playerPowerUps.has(type)) {
      return { success: false, message: 'Bu qobiliyatdan bu duelda allaqachon foydalandingiz!' };
    }

    playerPowerUps.add(type);
    room.powerUpsUsed.set(studentId, playerPowerUps);

    if (type === 'FIFTY_FIFTY') {
      const correct = room.roundQuestion.correctOptionKey;
      const incorrect = room.roundQuestion.options
        .map((o) => o.optionKey)
        .filter((k) => k !== correct);

      const shuffled = [...incorrect].sort(() => 0.5 - Math.random());
      const removedKeys = shuffled.slice(0, 2);

      return {
        success: true,
        type: 'FIFTY_FIFTY',
        removedKeys,
      };
    }

    if (type === 'ADD_TIME') {
      this.broadcast('round_time_extended', roomId, {
        studentId,
        addedSec: 5,
      });
      return {
        success: true,
        type: 'ADD_TIME',
        addedSec: 5,
      };
    }

    if (type === 'HINT') {
      const explanation = room.roundQuestion.explanation || '';
      const sentences = explanation.split(/[.!?]/).filter((s) => s.trim().length > 5);
      const hint = sentences[0]?.trim() || 'Formulaga va asosiy qonuniyatlarga e’tibor qarating!';
      return {
        success: true,
        type: 'HINT',
        hint,
      };
    }

    return { success: false, message: 'Noma’lum qobiliyat' };
  }

  getActiveRoom(roomId: string) {
    return this.activeRooms.get(roomId);
  }

  /**
   * Finds the active room in which a student is currently engaged.
   */
  findActiveRoomByStudentId(studentId: string): ActiveDuelRoomState | undefined {
    for (const room of this.activeRooms.values()) {
      if (room.roundStatus !== 'FINISHED' && room.players.some((p) => p.studentId === studentId)) {
        return room;
      }
    }
    return undefined;
  }
}
