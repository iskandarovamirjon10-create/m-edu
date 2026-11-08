import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ArenaBattleEngineService } from '../services/arena-battle-engine.service';
import { ArenaMatchmakingService } from '../services/arena-matchmaking.service';
import {
  ArenaSubjectCategory,
  DuelMode,
  DuelRoomStatus,
  QuestionDifficulty,
} from '@prisma/client';

describe('ArenaBattleEngine & Matchmaking — Real-time Duel Simulation', () => {
  let battleEngine: ArenaBattleEngineService;
  let matchmaking: ArenaMatchmakingService;
  let prisma: any;
  let questionsService: any;
  let titlesService: any;
  let avatarsService: any;

  const mockOrgId = 'org-test-arena-1';
  const player1 = {
    studentId: 'student-p1',
    userId: 'user-p1',
    name: 'Alisher Navoiy',
    avatarUrl: '/avatars/arena/cyber-scholar/battle.png',
    rating: 1200,
    socketId: 'sock-p1',
  };
  const player2 = {
    studentId: 'student-p2',
    userId: 'user-p2',
    name: 'Bobur Mirzo',
    avatarUrl: '/avatars/arena/neon-samurai/battle.png',
    rating: 1210,
    socketId: 'sock-p2',
  };

  const sampleBattleQuestions = [
    {
      id: 'q-1',
      version: 1,
      questionText: '12 * 8 nechaga teng?',
      timeLimitSec: 15,
      options: [
        { optionKey: 'A', optionText: '96', isCorrect: true },
        { optionKey: 'B', optionText: '84', isCorrect: false },
        { optionKey: 'C', optionText: '92', isCorrect: false },
        { optionKey: 'D', optionText: '100', isCorrect: false },
      ],
      explanation: '12 * 8 = 96 boʻladi.',
    },
    {
      id: 'q-2',
      version: 1,
      questionText: 'F = m * a kimning qonuni?',
      timeLimitSec: 15,
      options: [
        { optionKey: 'A', optionText: 'Nyuton 1-qonuni', isCorrect: false },
        { optionKey: 'B', optionText: 'Nyuton 2-qonuni', isCorrect: true },
        { optionKey: 'C', optionText: 'Arximed qonuni', isCorrect: false },
        { optionKey: 'D', optionText: 'Ohm qonuni', isCorrect: false },
      ],
      explanation: 'Nyutonning ikkinchi qonuni.',
    },
  ];

  beforeEach(() => {
    prisma = {
      duelRoom: {
        create: vi.fn().mockResolvedValue({ id: 'room-123' }),
        update: vi.fn(),
      },
      duelRound: {
        create: vi.fn().mockImplementation((args) => Promise.resolve({ id: `round-${args.data.roundNumber}`, ...args.data })),
        findUnique: vi.fn().mockImplementation((args) => {
          const rNum = args.where.duelRoomId_roundNumber.roundNumber;
          const q = sampleBattleQuestions[rNum - 1] || sampleBattleQuestions[0];
          return Promise.resolve({
            id: `round-${rNum}`,
            questionId: q.id,
            questionText: q.questionText,
            correctOptionKey: 'A',
            timeLimitSec: 15,
            optionsSnapshot: q.options,
            arenaQuestion: { explanation: q.explanation },
          });
        }),
      },
      duelRoundAnswer: {
        upsert: vi.fn().mockResolvedValue({ id: 'ans-1' }),
      },
      duelParticipant: {
        updateMany: vi.fn(),
      },
      studentDuelProfile: {
        findUnique: vi.fn().mockResolvedValue({
          rating: 1200,
          peakRating: 1200,
          totalDuels: 5,
          wins: 3,
          losses: 2,
          draws: 0,
          winStreak: 2,
          bestStreak: 2,
        }),
        update: vi.fn(),
      },
    };

    questionsService = {
      getBattleQuestions: vi.fn().mockResolvedValue(sampleBattleQuestions),
      recordQuestionUsage: vi.fn(),
    };

    titlesService = {
      checkAndUnlockTitles: vi.fn().mockResolvedValue(null),
    };

    avatarsService = {
      getCatalog: vi.fn().mockResolvedValue([
        { battleRenderUrl: '/avatars/arena/cyber-scholar/battle.png' },
      ]),
    };

    battleEngine = new ArenaBattleEngineService(
      prisma,
      questionsService,
      titlesService,
    );
    matchmaking = new ArenaMatchmakingService(battleEngine, avatarsService);
  });

  describe('1. Battle Room Generation & Snapshot Freezing', () => {
    it('should create a duel room with frozen round snapshots and notify players', async () => {
      const emitterMock = vi.fn();
      battleEngine.setEmitter(emitterMock);

      const room = await battleEngine.createDuelRoom(
        mockOrgId,
        [player1, player2],
        ArenaSubjectCategory.MATHEMATICS,
        QuestionDifficulty.MEDIUM,
      );

      expect(room.id).toBe('room-123');
      expect(prisma.duelRoom.create).toHaveBeenCalled();
      expect(prisma.duelRound.create).toHaveBeenCalledTimes(sampleBattleQuestions.length);
      expect(emitterMock).toHaveBeenCalledWith('duel_matched', 'room-123', expect.any(Object));
    });
  });

  describe('2. Answer Submission & Speed Scoring', () => {
    it('should calculate speed bonus and score for fast correct answers', async () => {
      const emitterMock = vi.fn();
      battleEngine.setEmitter(emitterMock);

      await battleEngine.createDuelRoom(
        mockOrgId,
        [player1, player2],
        ArenaSubjectCategory.MATHEMATICS,
        QuestionDifficulty.MEDIUM,
      );

      await battleEngine.startNextRound('room-123');

      // Submit answer in 2000ms (fast!)
      const result = await battleEngine.submitAnswer('room-123', player1.studentId, 'A', 2000);

      expect(result.success).toBe(true);
      expect(result.isCorrect).toBe(true);
      expect(result.score).toBeGreaterThan(130); // 100 base + speed bonus
      expect(result.speedBonus).toBeGreaterThan(30);
    });

    it('should award 0 points for incorrect answers', async () => {
      await battleEngine.createDuelRoom(
        mockOrgId,
        [player1, player2],
        ArenaSubjectCategory.MATHEMATICS,
        QuestionDifficulty.MEDIUM,
      );

      await battleEngine.startNextRound('room-123');

      const result = await battleEngine.submitAnswer('room-123', player2.studentId, 'C', 3000);

      expect(result.success).toBe(true);
      expect(result.isCorrect).toBe(false);
      expect(result.score).toBe(0);
      expect(result.speedBonus).toBe(0);
    });
  });

  describe('3. Matchmaking Queue & Bot Fallback', () => {
    it('should match two compatible human players in queue', async () => {
      const createSpy = vi.spyOn(battleEngine, 'createDuelRoom').mockResolvedValue({ id: 'room-match' } as any);

      await matchmaking.enqueuePlayer({
        ...player1,
        organizationId: mockOrgId,
        subjectCategory: ArenaSubjectCategory.MATHEMATICS,
        difficulty: QuestionDifficulty.MEDIUM,
        mode: DuelMode.SOLO_1V1,
        joinedAt: Date.now(),
      });

      await matchmaking.enqueuePlayer({
        ...player2,
        organizationId: mockOrgId,
        subjectCategory: ArenaSubjectCategory.MATHEMATICS,
        difficulty: QuestionDifficulty.MEDIUM,
        mode: DuelMode.SOLO_1V1,
        joinedAt: Date.now(),
      });

      expect(createSpy).toHaveBeenCalledWith(
        mockOrgId,
        expect.arrayContaining([expect.objectContaining({ studentId: player1.studentId })]),
        ArenaSubjectCategory.MATHEMATICS,
        QuestionDifficulty.MEDIUM,
        DuelMode.SOLO_1V1,
      );
    });

    it('should spawn AI Bot when player has waited in queue for >= 8 seconds', async () => {
      const createSpy = vi.spyOn(battleEngine, 'createDuelRoom').mockResolvedValue({ id: 'room-bot' } as any);

      await matchmaking.enqueuePlayer({
        ...player1,
        organizationId: mockOrgId,
        subjectCategory: ArenaSubjectCategory.MATHEMATICS,
        difficulty: QuestionDifficulty.MEDIUM,
        mode: DuelMode.SOLO_1V1,
        joinedAt: Date.now() - 9000, // 9 seconds ago!
      });

      expect(createSpy).toHaveBeenCalledWith(
        mockOrgId,
        expect.arrayContaining([
          expect.objectContaining({ studentId: player1.studentId }),
          expect.objectContaining({ isBot: true }),
        ]),
        ArenaSubjectCategory.MATHEMATICS,
        QuestionDifficulty.MEDIUM,
        DuelMode.SOLO_1V1,
      );
    });
  });
});
