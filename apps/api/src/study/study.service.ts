import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateFocusSessionDto,
  CreateStudyCardDto,
  CreateStudyDeckDto,
  CreateStudyCardsDto,
  ReviewStudyCardDto,
  StudyRating,
  UpdateStudyCardDto,
  UpdateStudyDeckDto,
} from './dto/study.dto';

const DAY_MS = 24 * 60 * 60 * 1000;
const HISTORY_DAYS = 120;

function startOfDay(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function daysAgo(n: number): Date {
  const d = startOfDay();
  d.setDate(d.getDate() - n);
  return d;
}

interface CardScheduleState {
  ease: number;
  intervalDays: number;
  repetitions: number;
  lapses: number;
}

/**
 * SM-2 inspired scheduler.
 *
 * "again" resets the card and brings it back in ten minutes; the other grades
 * grow the interval from the previous one, with the ease factor damping or
 * accelerating growth. Pure function so it stays trivially testable.
 */
export function nextSchedule(
  state: CardScheduleState,
  rating: StudyRating,
): CardScheduleState & { dueAt: Date; lastReviewedAt: Date } {
  const now = new Date();
  const previousInterval = Math.max(0, state.intervalDays);
  let { ease, intervalDays, repetitions, lapses } = state;
  let dueAt = new Date(now.getTime() + 10 * 60 * 1000);

  switch (rating) {
    case 'again':
      lapses += 1;
      repetitions = 0;
      intervalDays = 0;
      ease = Math.max(1.3, ease - 0.2);
      break;
    case 'hard':
      repetitions += 1;
      intervalDays = Math.max(1, Math.round(Math.max(previousInterval, 1) * 1.2));
      ease = Math.max(1.3, ease - 0.15);
      break;
    case 'good':
      repetitions += 1;
      intervalDays =
        repetitions === 1
          ? 1
          : repetitions === 2
            ? 3
            : Math.max(1, Math.round(Math.max(previousInterval, 1) * ease));
      break;
    case 'easy':
      repetitions += 1;
      intervalDays =
        repetitions === 1
          ? 3
          : repetitions === 2
            ? 7
            : Math.max(1, Math.round(Math.max(previousInterval, 1) * ease * 1.3));
      ease = Math.min(3.2, ease + 0.15);
      break;
  }

  if (rating !== 'again') {
    dueAt = new Date(now.getTime() + intervalDays * DAY_MS);
  }

  return { ease, intervalDays, repetitions, lapses, dueAt, lastReviewedAt: now };
}

@Injectable()
export class StudyService {
  constructor(private readonly prisma: PrismaService) {}

  /* ── Dashboard snapshot ─────────────────────────────────────────────── */

  async overview(userId: string, organizationId: string) {
    const now = new Date();
    const today = startOfDay(now);

    const deckIds = (
      await this.prisma.studyDeck.findMany({
        where: { userId, organizationId, archived: false },
        select: { id: true },
      })
    ).map((deck) => deck.id);

    const [decks, dueRows, reviewsToday, focusToday, focusWeek, recentReviews, recentFocus] =
      await Promise.all([
        this.prisma.studyDeck.findMany({
          where: { userId, organizationId, archived: false },
          orderBy: { updatedAt: 'desc' },
          include: { _count: { select: { cards: true } } },
        }),
        this.prisma.studyCard.groupBy({
          by: ['deckId'],
          where: {
            deckId: { in: deckIds },
            dueAt: { lte: now },
          },
          _count: { _all: true },
        }),
        this.prisma.studyReview.count({
          where: { userId, organizationId, reviewedAt: { gte: today } },
        }),
        this.prisma.studyFocusSession.aggregate({
          where: { userId, organizationId, completedAt: { gte: today } },
          _sum: { minutes: true },
        }),
        this.prisma.studyFocusSession.aggregate({
          where: { userId, organizationId, completedAt: { gte: daysAgo(6) } },
          _sum: { minutes: true },
        }),
        this.prisma.studyReview.findMany({
          where: { userId, organizationId, reviewedAt: { gte: daysAgo(HISTORY_DAYS) } },
          select: { reviewedAt: true, rating: true },
        }),
        this.prisma.studyFocusSession.findMany({
          where: { userId, organizationId, completedAt: { gte: daysAgo(6) } },
          select: { completedAt: true, minutes: true },
        }),
      ]);

    const dueMap = new Map<string, number>(
      dueRows.map((row) => [row.deckId, row._count._all]),
    );

    const totalCards = decks.reduce((sum, deck) => sum + deck._count.cards, 0);
    const dueTotal = decks.reduce((sum, deck) => sum + (dueMap.get(deck.id) ?? 0), 0);

    const weekReviews = recentReviews.filter((r) => r.reviewedAt >= daysAgo(6));
    const passed = weekReviews.filter(
      (r) => r.rating === 'good' || r.rating === 'easy',
    ).length;
    const accuracy7d =
      weekReviews.length > 0 ? Math.round((passed / weekReviews.length) * 100) : 0;

    // Streak: count consecutive review days, allowing today to still be empty.
    const reviewDays = new Set(
      recentReviews.map((review) => dayKey(review.reviewedAt)),
    );
    let streakDays = 0;
    const cursor = startOfDay();
    if (!reviewDays.has(dayKey(cursor))) {
      cursor.setDate(cursor.getDate() - 1);
    }
    while (reviewDays.has(dayKey(cursor))) {
      streakDays += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    const activity = Array.from({ length: 7 }, (_, index) => {
      const date = dayKey(daysAgo(6 - index));
      return { date, reviews: 0, focusMinutes: 0 };
    });
    const activityIndex = new Map(activity.map((entry, index) => [entry.date, index]));

    for (const review of weekReviews) {
      const index = activityIndex.get(dayKey(review.reviewedAt));
      if (index !== undefined) activity[index].reviews += 1;
    }
    for (const session of recentFocus) {
      const index = activityIndex.get(dayKey(session.completedAt));
      if (index !== undefined) activity[index].focusMinutes += session.minutes;
    }

    return {
      decks: decks.map((deck) => ({
        id: deck.id,
        title: deck.title,
        subject: deck.subject,
        description: deck.description,
        accent: deck.accent,
        createdAt: deck.createdAt,
        updatedAt: deck.updatedAt,
        cardCount: deck._count.cards,
        dueCount: dueMap.get(deck.id) ?? 0,
      })),
      totals: {
        cards: totalCards,
        due: dueTotal,
        reviewsToday,
        focusMinutesToday: focusToday._sum.minutes ?? 0,
        focusMinutesWeek: focusWeek._sum.minutes ?? 0,
        streakDays,
        accuracy7d,
      },
      activity,
    };
  }

  /* ── Decks ──────────────────────────────────────────────────────────── */

  async listDecks(userId: string, organizationId: string) {
    return this.prisma.studyDeck.findMany({
      where: { userId, organizationId, archived: false },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { cards: true } } },
    });
  }

  async createDeck(
    userId: string,
    organizationId: string,
    dto: CreateStudyDeckDto,
  ) {
    return this.prisma.studyDeck.create({
      data: {
        userId,
        organizationId,
        title: dto.title.trim(),
        subject: dto.subject?.trim() || null,
        description: dto.description?.trim() || null,
        accent: dto.accent ?? 'indigo',
      },
    });
  }

  async updateDeck(
    userId: string,
    organizationId: string,
    deckId: string,
    dto: UpdateStudyDeckDto,
  ) {
    await this.requireDeck(userId, organizationId, deckId);
    return this.prisma.studyDeck.update({
      where: { id: deckId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.subject !== undefined ? { subject: dto.subject.trim() || null } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description.trim() || null }
          : {}),
        ...(dto.accent !== undefined ? { accent: dto.accent } : {}),
      },
    });
  }

  async deleteDeck(userId: string, organizationId: string, deckId: string) {
    await this.requireDeck(userId, organizationId, deckId);
    await this.prisma.studyDeck.delete({ where: { id: deckId } });
    return { deleted: true };
  }

  /* ── Cards ──────────────────────────────────────────────────────────── */

  async listCards(userId: string, organizationId: string, deckId: string) {
    await this.requireDeck(userId, organizationId, deckId);
    return this.prisma.studyCard.findMany({
      where: { deckId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addCards(
    userId: string,
    organizationId: string,
    deckId: string,
    dto: CreateStudyCardsDto | CreateStudyCardDto,
  ) {
    await this.requireDeck(userId, organizationId, deckId);
    const cards = 'cards' in dto ? dto.cards : [dto];
    if (cards.length === 0) {
      return { created: 0 };
    }
    const result = await this.prisma.studyCard.createMany({
      data: cards.map((card) => ({
        deckId,
        front: card.front.trim(),
        back: card.back.trim(),
      })),
    });
    await this.prisma.studyDeck.update({
      where: { id: deckId },
      data: { updatedAt: new Date() },
    });
    return { created: result.count };
  }

  async updateCard(
    userId: string,
    organizationId: string,
    cardId: string,
    dto: UpdateStudyCardDto,
  ) {
    await this.requireCard(userId, organizationId, cardId);
    return this.prisma.studyCard.update({
      where: { id: cardId },
      data: {
        ...(dto.front !== undefined ? { front: dto.front.trim() } : {}),
        ...(dto.back !== undefined ? { back: dto.back.trim() } : {}),
      },
    });
  }

  async deleteCard(userId: string, organizationId: string, cardId: string) {
    await this.requireCard(userId, organizationId, cardId);
    await this.prisma.studyCard.delete({ where: { id: cardId } });
    return { deleted: true };
  }

  /* ── Review queue ───────────────────────────────────────────────────── */

  async queue(userId: string, organizationId: string, limit = 40) {
    const take = Math.min(Math.max(limit, 1), 100);
    return this.prisma.studyCard.findMany({
      where: {
        deck: { userId, organizationId, archived: false },
        dueAt: { lte: new Date() },
      },
      orderBy: { dueAt: 'asc' },
      take,
      include: {
        deck: { select: { id: true, title: true, accent: true } },
      },
    });
  }

  async reviewCard(
    userId: string,
    organizationId: string,
    cardId: string,
    dto: ReviewStudyCardDto,
  ) {
    const card = await this.requireCard(userId, organizationId, cardId);
    const next = nextSchedule(
      {
        ease: card.ease,
        intervalDays: card.intervalDays,
        repetitions: card.repetitions,
        lapses: card.lapses,
      },
      dto.rating,
    );

    const [updated] = await this.prisma.$transaction([
      this.prisma.studyCard.update({
        where: { id: cardId },
        data: {
          ease: next.ease,
          intervalDays: next.intervalDays,
          repetitions: next.repetitions,
          lapses: next.lapses,
          dueAt: next.dueAt,
          lastReviewedAt: next.lastReviewedAt,
        },
      }),
      this.prisma.studyReview.create({
        data: {
          cardId,
          userId,
          organizationId,
          rating: dto.rating,
          intervalDays: next.intervalDays,
        },
      }),
    ]);

    return {
      card: updated,
      nextDueAt: updated.dueAt,
      intervalDays: updated.intervalDays,
    };
  }

  /* ── Focus sessions ─────────────────────────────────────────────────── */

  async createFocusSession(
    userId: string,
    organizationId: string,
    dto: CreateFocusSessionDto,
  ) {
    if (dto.deckId) {
      await this.requireDeck(userId, organizationId, dto.deckId);
    }
    const minutes = Math.min(Math.max(Math.round(dto.minutes), 1), 240);
    const session = await this.prisma.studyFocusSession.create({
      data: {
        userId,
        organizationId,
        minutes,
        mode: dto.mode === 'REVIEW' ? 'REVIEW' : 'FOCUS',
      },
    });
    const today = await this.prisma.studyFocusSession.aggregate({
      where: { userId, organizationId, completedAt: { gte: startOfDay() } },
      _sum: { minutes: true },
    });
    return { session, focusMinutesToday: today._sum.minutes ?? 0 };
  }

  /* ── Ownership guards ───────────────────────────────────────────────── */

  private async requireDeck(
    userId: string,
    organizationId: string,
    deckId: string,
  ) {
    const deck = await this.prisma.studyDeck.findFirst({
      where: { id: deckId, userId, organizationId },
    });
    if (!deck) {
      throw new NotFoundException('Study deck not found');
    }
    return deck;
  }

  private async requireCard(
    userId: string,
    organizationId: string,
    cardId: string,
  ) {
    const card = await this.prisma.studyCard.findFirst({
      where: { id: cardId, deck: { userId, organizationId } },
    });
    if (!card) {
      throw new NotFoundException('Study card not found');
    }
    return card;
  }
}
