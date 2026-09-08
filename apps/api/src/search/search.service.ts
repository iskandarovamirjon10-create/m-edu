import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

export interface SearchQuery {
  q: string;
  types?: string[];
  limit?: number;
}

export interface SearchResultItem {
  id: string;
  type: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  href: string;
  relevanceScore: number;
  metadata?: Record<string, unknown> | null;
}

export interface SearchResponse {
  query: string;
  results: SearchResultItem[];
  total: number;
  byType: Record<string, number>;
  tookMs: number;
}

type EntitySearchFn = (prisma: PrismaService, orgId: string, q: string, limit: number) => Promise<SearchResultItem[]>;

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(organizationId: string, query: SearchQuery): Promise<SearchResponse> {
    const start = Date.now();
    const q = (query.q || '').trim();
    if (!q || q.length < 2) {
      return { query: q, results: [], total: 0, byType: {}, tookMs: 0 };
    }

    const searchers: Record<string, EntitySearchFn> = {
      STUDENT: this.searchStudents.bind(this),
      TEACHER: this.searchTeachers.bind(this),
      GROUP: this.searchGroups.bind(this),
      COURSE: this.searchCourses.bind(this),
      LEAD: this.searchLeads.bind(this),
      PAYMENT: this.searchPayments.bind(this),
      EMPLOYEE: this.searchEmployees.bind(this),
      BOOK: this.searchBooks.bind(this),
      CERTIFICATE: this.searchCertificates.bind(this),
      USER: this.searchUsers.bind(this),
    };

    const requestedTypes = query.types && query.types.length > 0
      ? query.types
      : Object.keys(searchers);

    const limit = Math.min(query.limit ?? 20, 50);

    const entries = await Promise.allSettled(
      requestedTypes.map(type => searchers[type]?.(this.prisma, organizationId, q, limit))
        ?? Promise.resolve([]),
    );

    const results: SearchResultItem[] = [];
    const byType: Record<string, number> = {};

    entries.forEach((entry, i) => {
      const type = requestedTypes[i];
      if (entry.status === 'fulfilled' && entry.value) {
        results.push(...entry.value);
        byType[type] = entry.value.length;
      } else {
        byType[type] = 0;
      }
    });

    // Sort by relevance descending
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return {
      query: q,
      results: results.slice(0, limit),
      total: results.length,
      byType,
      tookMs: Date.now() - start,
    };
  }

  private async searchStudents(
    prisma: PrismaService, orgId: string, q: string, limit: number,
  ): Promise<SearchResultItem[]> {
    const students = await prisma.student.findMany({
      where: {
        organizationId: orgId,
        user: {
          OR: [
            { firstName: { contains: q, mode: 'insensitive' } },
            { lastName: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q, mode: 'insensitive' } },
          ],
        },
      },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } } },
      take: limit,
    });

    return students.map(s => ({
      id: s.id,
      type: 'STUDENT',
      title: `${s.user?.firstName ?? ''} ${s.user?.lastName ?? ''}`.trim(),
      subtitle: s.user?.email ?? undefined,
      href: `/students/${s.id}`,
      relevanceScore: this.score(q, s.user?.firstName ?? '', s.user?.lastName ?? ''),
      metadata: { email: s.user?.email, phone: s.user?.phone },
    }));
  }

  private async searchTeachers(
    prisma: PrismaService, orgId: string, q: string, limit: number,
  ): Promise<SearchResultItem[]> {
    const teachers = await prisma.teacher.findMany({
      where: {
        organizationId: orgId,
        OR: [
          { user: { firstName: { contains: q, mode: 'insensitive' } } },
          { user: { lastName: { contains: q, mode: 'insensitive' } } },
          { user: { email: { contains: q, mode: 'insensitive' } } },
          { specializations: { has: q } },
        ],
      },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      take: limit,
    });

    return teachers.map(t => ({
      id: t.id,
      type: 'TEACHER',
      title: `${t.user?.firstName ?? ''} ${t.user?.lastName ?? ''}`.trim(),
      subtitle: t.specializations.join(', ') || undefined,
      href: `/teachers/${t.id}`,
      relevanceScore: this.score(q, t.user?.firstName ?? '', t.user?.lastName ?? ''),
      metadata: { specializations: t.specializations },
    }));
  }

  private async searchGroups(
    prisma: PrismaService, orgId: string, q: string, limit: number,
  ): Promise<SearchResultItem[]> {
    const groups = await prisma.group.findMany({
      where: {
        organizationId: orgId,
        name: { contains: q, mode: 'insensitive' },
      },
      include: { course: { select: { name: true } } },
      take: limit,
    });

    return groups.map(g => ({
      id: g.id,
      type: 'GROUP',
      title: g.name,
      subtitle: g.course?.name,
      href: `/groups/${g.id}`,
      relevanceScore: this.score(q, g.name),
      metadata: { room: g.room, capacity: g.capacity },
    }));
  }

  private async searchCourses(
    prisma: PrismaService, orgId: string, q: string, limit: number,
  ): Promise<SearchResultItem[]> {
    const courses = await prisma.course.findMany({
      where: {
        organizationId: orgId,
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: limit,
    });

    return courses.map(c => ({
      id: c.id,
      type: 'COURSE',
      title: c.name,
      subtitle: c.description ?? undefined,
      href: `/courses/${c.id}`,
      relevanceScore: this.score(q, c.name, c.description ?? ''),
    }));
  }

  private async searchLeads(
    prisma: PrismaService, orgId: string, q: string, limit: number,
  ): Promise<SearchResultItem[]> {
    const leads = await prisma.lead.findMany({
      where: {
        organizationId: orgId,
        OR: [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: limit,
    });

    return leads.map(l => ({
      id: l.id,
      type: 'LEAD',
      title: `${l.firstName} ${l.lastName ?? ''}`.trim(),
      subtitle: `${l.stage} · ${l.source ?? 'unknown source'}`,
      href: `/leads/${l.id}`,
      relevanceScore: this.score(q, l.firstName, l.lastName ?? ''),
      metadata: { stage: l.stage, source: l.source },
    }));
  }

  private async searchPayments(
    prisma: PrismaService, orgId: string, q: string, limit: number,
  ): Promise<SearchResultItem[]> {
    const payments = await prisma.payment.findMany({
      where: {
        organizationId: orgId,
        OR: [
          { description: { contains: q, mode: 'insensitive' } },
          { reference: { contains: q, mode: 'insensitive' } },
          { student: { user: { firstName: { contains: q, mode: 'insensitive' } } } },
          { student: { user: { lastName: { contains: q, mode: 'insensitive' } } } },
        ],
      },
      include: { student: { include: { user: { select: { firstName: true, lastName: true } } } } },
      take: limit,
    });

    return payments.map(p => ({
      id: p.id,
      type: 'PAYMENT',
      title: `${p.amount} — ${p.student?.user?.firstName ?? ''} ${p.student?.user?.lastName ?? ''}`.trim(),
      subtitle: `${p.status} · ${p.description ?? ''}`,
      href: `/payments/${p.id}`,
      relevanceScore: this.score(q, p.description ?? '', p.reference ?? ''),
      metadata: { status: p.status, amount: p.amount },
    }));
  }

  private async searchEmployees(
    prisma: PrismaService, orgId: string, q: string, limit: number,
  ): Promise<SearchResultItem[]> {
    const employees = await prisma.employee.findMany({
      where: {
        organizationId: orgId,
        OR: [
          { user: { firstName: { contains: q, mode: 'insensitive' } } },
          { user: { lastName: { contains: q, mode: 'insensitive' } } },
          { user: { email: { contains: q, mode: 'insensitive' } } },
          { position: { contains: q, mode: 'insensitive' } },
        ],
      },
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
      take: limit,
    });

    return employees.map(e => ({
      id: e.id,
      type: 'EMPLOYEE',
      title: `${e.user?.firstName ?? ''} ${e.user?.lastName ?? ''}`.trim(),
      subtitle: `${e.position} · ${e.department ?? 'N/A'}`,
      href: `/hr/employees/${e.id}`,
      relevanceScore: this.score(q, e.user?.firstName ?? '', e.user?.lastName ?? '', e.position ?? ''),
    }));
  }

  private async searchBooks(
    prisma: PrismaService, orgId: string, q: string, limit: number,
  ): Promise<SearchResultItem[]> {
    const books = await prisma.libraryBook.findMany({
      where: {
        organizationId: orgId,
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { author: { contains: q, mode: 'insensitive' } },
          { isbn: { contains: q, mode: 'insensitive' } },
          { barcode: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: limit,
    });

    return books.map(b => ({
      id: b.id,
      type: 'BOOK',
      title: b.title,
      subtitle: `${b.author ?? 'Unknown'} · ISBN: ${b.isbn ?? b.barcode}`,
      href: `/library/books/${b.id}`,
      relevanceScore: this.score(q, b.title, b.author ?? ''),
      metadata: { available: b.available, isbn: b.isbn },
    }));
  }

  private async searchCertificates(
    prisma: PrismaService, orgId: string, q: string, limit: number,
  ): Promise<SearchResultItem[]> {
    const certs = await prisma.certificate.findMany({
      where: {
        organizationId: orgId,
        OR: [
          { certificateNumber: { contains: q, mode: 'insensitive' } },
          { verificationCode: { contains: q, mode: 'insensitive' } },
          { student: { user: { firstName: { contains: q, mode: 'insensitive' } } } },
          { student: { user: { lastName: { contains: q, mode: 'insensitive' } } } },
        ],
      },
      include: {
        student: { include: { user: { select: { firstName: true, lastName: true } } } },
        course: { select: { name: true } },
      },
      take: limit,
    });

    return certs.map(c => ({
      id: c.id,
      type: 'CERTIFICATE',
      title: `Certificate · ${c.course?.name ?? c.certificateNumber}`,
      subtitle: `${c.student?.user?.firstName ?? ''} ${c.student?.user?.lastName ?? ''} · ${c.certificateNumber}`,
      href: `/certificates/${c.id}`,
      relevanceScore: this.score(q, c.course?.name ?? '', c.certificateNumber, c.verificationCode),
      metadata: { number: c.certificateNumber, verified: !!c.pdfUrl },
    }));
  }

  private async searchUsers(
    prisma: PrismaService, orgId: string, q: string, limit: number,
  ): Promise<SearchResultItem[]> {
    const users = await prisma.user.findMany({
      where: {
        organizationId: orgId,
        OR: [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: limit,
    });

    return users.map(u => ({
      id: u.id,
      type: 'USER',
      title: `${u.firstName} ${u.lastName}`.trim(),
      subtitle: u.email,
      href: `/users/${u.id}`,
      relevanceScore: this.score(q, u.firstName, u.lastName),
      metadata: { email: u.email, role: u.role },
    }));
  }

  /**
   * Simple relevance scorer: exact match = 100, prefix match = 80, contains = 60.
   * Returns 0 if no match.
   */
  private score(q: string, ...fields: string[]): number {
    const ql = q.toLowerCase();
    for (const field of fields) {
      if (!field) continue;
      const fl = field.toLowerCase();
      if (fl === ql) return 100;
      if (fl.startsWith(ql)) return 80;
      if (fl.includes(ql)) return 60;
    }
    return 0;
  }
}
