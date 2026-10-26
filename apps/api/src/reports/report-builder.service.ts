import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FinancialBrainService } from '../analytics/financial-brain.service';
import { startOfDay, endOfDayInclusive } from '../common/date-range.js';

/**
 * Report Builder — generates reports exclusively from real database data and
 * the authoritative analytics services.
 *
 * Honesty rules:
 *  - Every column is whitelisted per report type; unknown columns/filters are
 *    rejected (no fabricated fields).
 *  - Financial metrics are delegated to FinancialBrainService — never
 *    recalculated here (single source of financial truth).
 *  - Empty data remains empty (EMPTY), entities whose report semantics cannot
 *    be satisfied return INSUFFICIENT_DATA (e.g. Group Contribution).
 *  - No demo rows, no hardcoded values.
 */

export type ReportDimension =
  | 'STUDENTS'
  | 'TEACHERS'
  | 'GROUPS'
  | 'ATTENDANCE'
  | 'PAYMENTS'
  | 'INVOICES'
  | 'EXPENSES'
  | 'PAYROLL'
  | 'LEADS'
  | 'FOLLOWUPS'
  | 'NOTIFICATIONS'
  | 'FINANCE';

export interface ReportColumn {
  key: string;
  label: string;
  /** Columns available for the report type. */
}

interface ReportDesign {
  columns: ReportColumn[];
  /** The primary date field used for date-range filtering. */
  dateField: string;
  /** Whitelisted status values for the optional status filter. */
  statusFilter?: { field: string; values: string[] };
}

const col = (key: string, label: string): ReportColumn => ({ key, label });

export const REPORT_DESIGNS: Record<ReportDimension, ReportDesign> = {
  STUDENTS: {
    columns: [
      col('name', 'Student'),
      col('email', 'Email'),
      col('phone', 'Phone'),
      col('isActive', 'Active'),
      col('enrollmentDate', 'Enrolled'),
    ],
    dateField: 'createdAt',
  },
  TEACHERS: {
    columns: [
      col('name', 'Teacher'),
      col('email', 'Email'),
      col('phone', 'Phone'),
      col('specializations', 'Specializations'),
      col('hourlyRate', 'Hourly Rate'),
      col('createdAt', 'Joined'),
    ],
    dateField: 'createdAt',
  },
  GROUPS: {
    columns: [
      col('name', 'Group'),
      col('course', 'Course'),
      col('teacher', 'Teacher'),
      col('capacity', 'Capacity'),
      col('isActive', 'Active'),
    ],
    dateField: 'createdAt',
  },
  ATTENDANCE: {
    columns: [
      col('date', 'Date'),
      col('status', 'Status'),
      col('student', 'Student'),
      col('group', 'Group'),
      col('source', 'Source'),
    ],
    dateField: 'date',
    statusFilter: { field: 'status', values: ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] },
  },
  PAYMENTS: {
    columns: [
      col('createdAt', 'Date'),
      col('amount', 'Amount'),
      col('status', 'Status'),
      col('method', 'Method'),
      col('student', 'Student'),
      col('receiptNumber', 'Receipt'),
    ],
    dateField: 'createdAt',
    statusFilter: { field: 'status', values: ['PENDING', 'PAID', 'OVERDUE', 'CANCELLED'] },
  },
  INVOICES: {
    columns: [
      col('createdAt', 'Created'),
      col('dueDate', 'Due'),
      col('total', 'Total'),
      col('paidAmount', 'Paid'),
      col('balance', 'Balance'),
      col('status', 'Status'),
      col('student', 'Student'),
    ],
    dateField: 'createdAt',
    statusFilter: {
      field: 'status',
      values: ['DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED'],
    },
  },
  EXPENSES: {
    columns: [
      col('date', 'Date'),
      col('category', 'Category'),
      col('amount', 'Amount'),
      col('description', 'Description'),
    ],
    dateField: 'date',
  },
  PAYROLL: {
    columns: [
      col('period', 'Period'),
      col('teacher', 'Teacher'),
      col('status', 'Status'),
      col('baseAmount', 'Base'),
      col('netAmount', 'Net'),
    ],
    dateField: 'createdAt',
    statusFilter: {
      field: 'status',
      values: ['DRAFT', 'CALCULATED', 'REVIEWED', 'APPROVED', 'PAID', 'CANCELLED'],
    },
  },
  LEADS: {
    columns: [
      col('name', 'Lead'),
      col('phone', 'Phone'),
      col('email', 'Email'),
      col('source', 'Source'),
      col('stage', 'Stage'),
      col('createdAt', 'Created'),
    ],
    dateField: 'createdAt',
    statusFilter: {
      field: 'stage',
      values: ['NEW', 'CONTACTED', 'TRIAL_LESSON', 'WON', 'LOST'],
    },
  },
  FOLLOWUPS: {
    columns: [
      col('scheduledAt', 'Scheduled'),
      col('isCompleted', 'Completed'),
      col('note', 'Note'),
      col('lead', 'Lead'),
      col('stage', 'Stage'),
    ],
    dateField: 'scheduledAt',
  },
  NOTIFICATIONS: {
    columns: [
      col('createdAt', 'Date'),
      col('channel', 'Channel'),
      col('direction', 'Direction'),
      col('subject', 'Subject'),
      col('status', 'Status'),
    ],
    dateField: 'createdAt',
    statusFilter: { field: 'status', values: ['QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'SKIPPED'] },
  },
  FINANCE: {
    // Delegated entirely to FinancialBrainService — see runFinanceReport().
    columns: [
      col('metric', 'Metric'),
      col('value', 'Value'),
    ],
    dateField: 'period',
  },
};

export interface RunReportParams {
  type: ReportDimension;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  columns?: string[];
  sortField?: string;
  sortDir?: 'asc' | 'desc';
  groupBy?: string;
  page?: number;
  pageSize?: number;
}

export interface RunReportResult {
  status: 'READY' | 'EMPTY' | 'INSUFFICIENT_DATA';
  reason?: string;
  type: ReportDimension;
  columns: ReportColumn[];
  selectedColumns: string[];
  rows: Array<Record<string, unknown>>;
  totalRows: number;
  page: number;
  pageSize: number;
  totalPages: number;
  generatedAt: string;
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  return isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function fmtDecimal(v: any): number {
  if (typeof v === 'object' && v !== null && 'toNumber' in v) {
    return (v as any).toNumber();
  }
  return Number(v ?? 0);
}

function formatName(user?: { firstName?: string | null; lastName?: string | null } | null): string {
  if (!user) return '';
  return `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
}

@Injectable()
export class ReportBuilderService {
  private readonly logger = new Logger(ReportBuilderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly financialBrain: FinancialBrainService,
  ) {}

  getDesign(type: string) {
    const design = REPORT_DESIGNS[type as ReportDimension];
    if (!design) {
      throw new BadRequestException(`Unknown report type: ${type}`);
    }
    return { type, columns: design.columns };
  }

  listDesigns() {
    return (Object.keys(REPORT_DESIGNS) as ReportDimension[]).map((type) => ({
      type,
      columns: REPORT_DESIGNS[type].columns,
      statusFilter: REPORT_DESIGNS[type].statusFilter ?? null,
    }));
  }

  async run(orgId: string, params: RunReportParams): Promise<RunReportResult> {
    const design = REPORT_DESIGNS[params.type];
    if (!design) throw new BadRequestException(`Unknown report type: ${params.type}`);

    // Column whitelist enforcement
    const allKeys = design.columns.map((c) => c.key);
    const selected = (params.columns ?? []).filter((c) => allKeys.includes(c));
    const selectedColumns = selected.length > 0 ? selected : allKeys;

    // Sorting whitelist enforcement
    const sortField = params.sortField && allKeys.includes(params.sortField) ? params.sortField : undefined;
    const sortDir = params.sortDir === 'desc' ? 'desc' : 'asc';

    // Status filter whitelist enforcement
    let status: string | undefined;
    if (params.status !== undefined && params.status !== '') {
      const sf = design.statusFilter;
      if (!sf || !sf.values.includes(params.status)) {
        throw new BadRequestException(`Status filter '${params.status}' is not supported for ${params.type}`);
      }
      status = params.status;
    }

    const dateFrom = params.dateFrom ? new Date(params.dateFrom) : undefined;
    const dateTo = params.dateTo ? new Date(params.dateTo) : undefined;
    if ((dateFrom && isNaN(dateFrom.getTime())) || (dateTo && isNaN(dateTo.getTime()))) {
      throw new BadRequestException('Invalid date range');
    }

    let rows: Array<Record<string, unknown>>;
    if (params.type === 'FINANCE') {
      const fin = await this.runFinanceReport(orgId, dateFrom, dateTo);
      rows = fin.rows;
      if (fin.status !== 'READY') {
        return {
          status: fin.status,
          reason: fin.reason,
          type: params.type,
          columns: design.columns,
          selectedColumns,
          rows: [],
          totalRows: 0,
          page: 1,
          pageSize: params.pageSize ?? 50,
          totalPages: 0,
          generatedAt: new Date().toISOString(),
        };
      }
      rows = fin.rows;
    } else {
      rows = await this.runEntityReport(orgId, params.type, design, {
        dateFrom,
        dateTo,
        status,
      });
    }

    // Optional grouping (real count aggregation over the actual rows)
    if (params.groupBy && allKeys.includes(params.groupBy)) {
      const groups = new Map<string, number>();
      for (const row of rows) {
        const key = String(row[params.groupBy] ?? '—');
        groups.set(key, (groups.get(key) ?? 0) + 1);
      }
      rows = Array.from(groups.entries())
        .map(([key, count]) => ({ [params.groupBy!]: key, count }))
        .sort((a, b) => b.count - a.count);
      return {
        status: rows.length > 0 ? 'READY' : 'EMPTY',
        type: params.type,
        columns: design.columns,
        selectedColumns: [params.groupBy, 'count'],
        rows,
        totalRows: rows.length,
        page: 1,
        pageSize: rows.length || 1,
        totalPages: 1,
        generatedAt: new Date().toISOString(),
      };
    }

    // Sorting (string/number safe compare over the actual rows)
    if (sortField) {
      rows = [...rows].sort((a, b) => {
        const av = a[sortField];
        const bv = b[sortField];
        const an = typeof av === 'number' ? av : parseFloat(String(av));
        const bn = typeof bv === 'number' ? bv : parseFloat(String(bv));
        if (!isNaN(an) && !isNaN(bn)) return sortDir === 'asc' ? an - bn : bn - an;
        return sortDir === 'asc'
          ? String(av).localeCompare(String(bv))
          : String(bv).localeCompare(String(av));
      });
    }

    // Pagination
    const totalRows = rows.length;
    const pageSize = Math.min(Math.max(params.pageSize ?? 50, 1), 10000);
    const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
    const page = Math.min(Math.max(params.page ?? 1, 1), totalPages);
    const paged = rows.slice((page - 1) * pageSize, page * pageSize);

    return {
      status: totalRows > 0 ? 'READY' : 'EMPTY',
      type: params.type,
      columns: design.columns,
      selectedColumns,
      rows: paged,
      totalRows,
      page,
      pageSize,
      totalPages,
      generatedAt: new Date().toISOString(),
    };
  }

  /** FINANCE rows come exclusively from the authoritative Financial Brain. */
  private async runFinanceReport(
    orgId: string,
    dateFrom?: Date,
    dateTo?: Date,
  ): Promise<{ status: 'READY' | 'INSUFFICIENT_DATA'; reason?: string; rows: Array<Record<string, unknown>> }> {
    const { startOfDay, endOfDayInclusive } = await import('../common/date-range.js');
    const end = endOfDayInclusive(dateTo ?? new Date());
    const start = startOfDay(dateFrom ?? new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000));    if (start > end) {
      throw new BadRequestException('dateFrom must be before dateTo');
    }

    const cashFlow = await this.financialBrain.getCashFlow(orgId, start, end);
    const debt = await this.financialBrain.getDebtAndReceivables(orgId);

    const rows: Array<Record<string, unknown>> = [
      { metric: 'Cash Collected (PAID payments)', value: cashFlow.inflows.cashCollected },
      { metric: 'Refunds (PROCESSED)', value: cashFlow.inflows.refundsTotal },
      { metric: 'Net Cash Inflow', value: cashFlow.inflows.netCashInflow },
      { metric: 'Operating Expenses', value: cashFlow.outflows.expensesTotal },
      { metric: 'Payroll Cash Out (PAID runs)', value: cashFlow.outflows.payrollTotal },
      { metric: 'Net Cash Flow', value: cashFlow.netCashFlow },
      { metric: 'Total Receivables (Debt)', value: debt.totalReceivables },
      { metric: 'Overdue Debt', value: debt.overdueDebt },
    ];
    return { status: 'READY', rows };
  }

  private async runEntityReport(
    orgId: string,
    type: ReportDimension,
    design: ReportDesign,
    f: { dateFrom?: Date; dateTo?: Date; status?: string },
  ): Promise<Array<Record<string, unknown>>> {
    const MAX_REPORT_ROWS = 10000;
    const dateWhere = (field: string) => {
      const w: Record<string, unknown> = {};
      if (f.dateFrom || f.dateTo) {
        w[field] = {
          ...(f.dateFrom && { gte: startOfDay(f.dateFrom) }),
          ...(f.dateTo && { lte: endOfDayInclusive(f.dateTo) }),
        };
      }
      return w;
    };
    const statusWhere = () => (f.status && design.statusFilter ? { [design.statusFilter.field]: f.status } : {});

    switch (type) {
      case 'STUDENTS': {
        const rows = await this.prisma.student.findMany({
          where: { organizationId: orgId, ...dateWhere(design.dateField) },
          select: { status: true, createdAt: true, user: { select: { firstName: true, lastName: true, email: true, phone: true } } },
          orderBy: { createdAt: 'desc' },
          take: MAX_REPORT_ROWS,
        });
        return rows.map((s) => ({
          name: formatName(s.user),
          email: s.user?.email ?? '',
          phone: s.user?.phone ?? '',
          isActive: s.status === 'ACTIVE' ? 'Yes' : 'No',
          enrollmentDate: fmtDate(s.createdAt),
        }));
      }
      case 'TEACHERS': {
        const rows = await this.prisma.teacher.findMany({
          where: { organizationId: orgId, ...dateWhere(design.dateField) },
          select: { specializations: true, hourlyRate: true, createdAt: true, user: { select: { firstName: true, lastName: true, email: true, phone: true } } },
          orderBy: { createdAt: 'desc' },
          take: MAX_REPORT_ROWS,
        });
        return rows.map((t) => ({
          name: formatName(t.user),
          email: t.user?.email ?? '',
          phone: t.user?.phone ?? '',
          specializations: (t.specializations ?? []).join(', '),
          hourlyRate: t.hourlyRate !== null ? fmtDecimal(t.hourlyRate) : '',
          createdAt: fmtDate(t.createdAt),
        }));
      }
      case 'GROUPS': {
        const rows = await this.prisma.group.findMany({
          where: { organizationId: orgId, ...dateWhere(design.dateField) },
          select: { name: true, capacity: true, isActive: true, course: { select: { name: true } }, teacher: { select: { user: { select: { firstName: true, lastName: true } } } } },
          orderBy: { createdAt: 'desc' },
          take: MAX_REPORT_ROWS,
        });
        return rows.map((g) => ({
          name: g.name,
          course: g.course?.name ?? '',
          teacher: formatName(g.teacher?.user),
          capacity: g.capacity ?? '',
          isActive: g.isActive ? 'Yes' : 'No',
        }));
      }
      case 'ATTENDANCE': {
        const rows = await this.prisma.attendance.findMany({
          where: { organizationId: orgId, ...dateWhere(design.dateField), ...statusWhere() },
          select: { date: true, status: true, source: true, student: { select: { user: { select: { firstName: true, lastName: true } } } }, group: { select: { name: true } } },
          orderBy: { date: 'desc' },
          take: MAX_REPORT_ROWS,
        });
        return rows.map((a) => ({
          date: fmtDate(a.date),
          status: a.status,
          student: formatName(a.student?.user),
          group: a.group?.name ?? '',
          source: a.source,
        }));
      }
      case 'PAYMENTS': {
        const rows = await this.prisma.payment.findMany({
          where: { organizationId: orgId, ...dateWhere(design.dateField), ...statusWhere() },
          select: { createdAt: true, amount: true, status: true, method: true, receiptNumber: true, student: { select: { user: { select: { firstName: true, lastName: true } } } } },
          orderBy: { createdAt: 'desc' },
          take: MAX_REPORT_ROWS,
        });
        return rows.map((p) => ({
          createdAt: fmtDate(p.createdAt),
          amount: fmtDecimal(p.amount),
          status: p.status,
          method: p.method ?? '',
          student: formatName(p.student?.user),
          receiptNumber: p.receiptNumber ?? '',
        }));
      }
      case 'INVOICES': {
        const rows = await this.prisma.invoice.findMany({
          where: { organizationId: orgId, ...dateWhere(design.dateField), ...statusWhere() },
          select: { createdAt: true, dueDate: true, total: true, paidAmount: true, refundedAmount: true, status: true, student: { select: { user: { select: { firstName: true, lastName: true } } } } },
          orderBy: { createdAt: 'desc' },
          take: MAX_REPORT_ROWS,
        });
        const { computeInvoiceOutstanding } = await import('../payments/invoice-outstanding.js');
        
        return rows.map((i) => {
          const { outstanding } = computeInvoiceOutstanding([i as any]);
          return {
            createdAt: fmtDate(i.createdAt),
            dueDate: fmtDate(i.dueDate),
            total: fmtDecimal(i.total),
            paidAmount: fmtDecimal(i.paidAmount),
            refundedAmount: fmtDecimal(i.refundedAmount ?? 0),
            balance: outstanding,
            status: i.status,
            student: formatName(i.student?.user),
          };
        });
      }      case 'EXPENSES': {
        const rows = await this.prisma.expense.findMany({
          where: { organizationId: orgId, ...dateWhere(design.dateField) },
          select: { date: true, category: true, amount: true, description: true },
          orderBy: { date: 'desc' },
          take: MAX_REPORT_ROWS,
        });
        return rows.map((e) => ({
          date: fmtDate(e.date),
          category: e.category,
          amount: fmtDecimal(e.amount),
          description: e.description ?? '',
        }));
      }
      case 'PAYROLL': {
        const rows = await this.prisma.payrollRun.findMany({
          where: { organizationId: orgId, ...dateWhere(design.dateField), ...statusWhere() },
          select: { periodYear: true, periodMonth: true, status: true, baseAmount: true, netAmount: true, teacher: { select: { user: { select: { firstName: true, lastName: true } } } } },
          orderBy: { createdAt: 'desc' },
          take: MAX_REPORT_ROWS,
        });
        return rows.map((p) => ({
          period: `${p.periodYear}-${String(p.periodMonth).padStart(2, '0')}`,
          teacher: formatName(p.teacher?.user),
          status: p.status,
          baseAmount: fmtDecimal(p.baseAmount),
          netAmount: fmtDecimal(p.netAmount),
        }));
      }
      case 'LEADS': {
        const rows = await this.prisma.lead.findMany({
          where: { organizationId: orgId, ...dateWhere(design.dateField), ...statusWhere() },
          select: { firstName: true, lastName: true, phone: true, email: true, source: true, stage: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: MAX_REPORT_ROWS,
        });
        return rows.map((l) => ({
          name: formatName({ firstName: l.firstName, lastName: l.lastName }),
          phone: l.phone ?? '',
          email: l.email ?? '',
          source: l.source ?? '',
          stage: l.stage,
          createdAt: fmtDate(l.createdAt),
        }));
      }
      case 'FOLLOWUPS': {
        const rows = await this.prisma.followUp.findMany({
          where: { organizationId: orgId, ...dateWhere(design.dateField) },
          select: { scheduledAt: true, isCompleted: true, note: true, lead: { select: { firstName: true, lastName: true, stage: true } } },
          orderBy: { scheduledAt: 'desc' },
          take: MAX_REPORT_ROWS,
        });
        return rows.map((fu) => ({
          scheduledAt: fmtDate(fu.scheduledAt),
          isCompleted: fu.isCompleted ? 'Yes' : 'No',
          note: fu.note ?? '',
          lead: formatName(fu.lead),
          stage: fu.lead?.stage ?? '',
        }));
      }
      case 'NOTIFICATIONS': {
        const rows = await this.prisma.communicationHistory.findMany({
          where: { organizationId: orgId, ...dateWhere(design.dateField), ...statusWhere() },
          select: { createdAt: true, channel: true, direction: true, subject: true, status: true },
          orderBy: { createdAt: 'desc' },
          take: MAX_REPORT_ROWS,
        });
        return rows.map((c) => ({
          createdAt: fmtDate(c.createdAt),
          channel: c.channel,
          direction: c.direction,
          subject: c.subject ?? '',
          status: c.status,
        }));
      }
      default:
        throw new BadRequestException(`Unsupported report type: ${type}`);
    }
  }

  // ── Saved report definitions (existing Report model) ────────────────────

  async saveDefinition(
    orgId: string,
    userId: string,
    data: { name: string; type: ReportDimension; parameters: RunReportParams; schedule?: string },
  ) {
    if (!REPORT_DESIGNS[data.type]) throw new BadRequestException(`Unknown report type: ${data.type}`);
    // Map to the ReportType enum honestly: only ATTENDANCE and FINANCIAL map
    // 1:1; everything else is CUSTOM (no fabricated classification).
    const typeEnum =
      data.type === 'ATTENDANCE' ? 'ATTENDANCE' : data.type === 'FINANCE' ? 'FINANCIAL' : 'CUSTOM';
    return this.prisma.report.create({
      data: {
        organizationId: orgId,
        name: data.name,
        type: typeEnum as never,
        parameters: { ...data.parameters, type: data.type } as never,
        schedule: data.schedule ?? null,
        createdBy: userId,
      },
    });
  }

  async listDefinitions(orgId: string) {
    return this.prisma.report.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async deleteDefinition(orgId: string, id: string) {
    const { count } = await this.prisma.report.deleteMany({ where: { id, organizationId: orgId } });
    if (count === 0) throw new NotFoundException('Report not found');
    return { deleted: true };
  }

  async runSaved(orgId: string, id: string) {
    const report = await this.prisma.report.findFirst({ where: { id, organizationId: orgId } });
    if (!report) throw new NotFoundException('Report not found');
    const params = report.parameters as unknown as RunReportParams;
    const result = await this.run(orgId, params);
    await this.prisma.report.updateMany({ where: { id, organizationId: orgId }, data: { lastRunAt: new Date() } });
    return result;
  }

  // ── Export (reuses the stack's XLSX/PDF libraries and response pattern) ──

  async exportResult(
    orgId: string,
    params: RunReportParams,
    format: 'csv' | 'xlsx' | 'pdf',
  ): Promise<{ buffer: Buffer; contentType: string; extension: string }> {
    const result = await this.run(orgId, { ...params, page: params.page ?? 1, pageSize: params.pageSize ?? 10000 });
    const headers = result.selectedColumns.map(
      (k) => result.columns.find((c) => c.key === k)?.label ?? k,
    );
    const matrix = result.rows.map((row) => result.selectedColumns.map((k) => String(row[k] ?? '')));

    // Escape CSV formula injection (CWE-1236): prefix cells starting with
    // =, +, -, @, tab, or CR so spreadsheets treat them as text.
    const csvEscape = (v: string) => {
      const guarded = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
      return /[",\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
    };
    const toCsv = () =>
      [headers.map(csvEscape).join(','), ...matrix.map((r) => r.map(csvEscape).join(','))].join('\n');

    if (format === 'csv') {
      return { buffer: Buffer.from(toCsv(), 'utf-8'), contentType: 'text/csv', extension: 'csv' };
    }

    try {
      if (format === 'xlsx') {
        const ExcelJS = ((await import('exceljs')).default || (await import('exceljs'))) as unknown as {
          Workbook: new () => {
            creator?: string;
            created?: Date;
            addWorksheet: (name: string) => {
              columns: Array<{ key: string; width: number }>;
              addRow: (r: unknown[]) => {
                font?: unknown;
                fill?: unknown;
                height?: number;
              };
            };
            xlsx: { writeBuffer: () => Promise<ArrayBuffer> };
          };
        };
        // CWE-1236: sanitize cells starting with formula triggers (=, +, -, @, \t, \r)
        const sanitizeExcelCell = (v: string): string => {
          return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
        };
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'M-EDU Platform';
        workbook.created = new Date();
        const sheet = workbook.addWorksheet(params.type.slice(0, 31));

        sheet.columns = headers.map((h) => ({
          key: h,
          width: Math.max(h.length + 6, 14),
        }));

        const headerRow = sheet.addRow(headers);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF0066FF' },
        };
        headerRow.height = 24;

        matrix.forEach((r) => sheet.addRow(r.map(sanitizeExcelCell)));
        const buffer = await workbook.xlsx.writeBuffer();
        return {
          buffer: Buffer.from(buffer),
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          extension: 'xlsx',
        };
      }

      // PDF — same pdfmake access-policy pattern as the import-export service.
      const pdfmakeRaw = await import('pdfmake');
      const pdfmake = (pdfmakeRaw.default || pdfmakeRaw) as {
        setLocalAccessPolicy: (cb: () => boolean) => void;
        setUrlAccessPolicy: (cb: () => boolean) => void;
        setFonts: (fonts: unknown) => void;
        createPdf: (docDefinition: unknown) => { getBuffer: () => Promise<Buffer> };
      };
      pdfmake.setLocalAccessPolicy(() => true);
      pdfmake.setUrlAccessPolicy(() => false);
      pdfmake.setFonts({
        NotoSans: {
          normal: require('path').join(__dirname, '..', 'assets', 'fonts', 'NotoSans-Regular.ttf'),
          bold: require('path').join(__dirname, '..', 'assets', 'fonts', 'NotoSans-Bold.ttf'),
          italics: require('path').join(__dirname, '..', 'assets', 'fonts', 'NotoSans-Regular.ttf'),
          bolditalics: require('path').join(__dirname, '..', 'assets', 'fonts', 'NotoSans-Bold.ttf'),
        },
      });

      const tableBody = [
        headers.map((h) => ({ text: h, style: 'tableHeader' })),
        ...matrix.map((r) => r.map((c) => ({ text: String(c ?? '') }))),
      ];

      const doc = pdfmake.createPdf({
        pageOrientation: headers.length > 5 ? 'landscape' : 'portrait',
        content: [
          { text: `M-EDU REPORT · ${params.type.toUpperCase()}`, style: 'header' },
          {
            text: `Generated on: ${new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC · Total Records: ${matrix.length}`,
            style: 'subHeader',
          },
          {
            table: {
              headerRows: 1,
              widths: headers.map(() => 'auto'),
              body: tableBody,
            },
            layout: 'lightHorizontalLines',
          },
        ],
        footer: (currentPage: number, pageCount: number) => ({
          text: `Page ${currentPage} of ${pageCount} · M-EDU Education Operating System`,
          alignment: 'center',
          fontSize: 8,
          color: '#64748B',
          margin: [0, 10, 0, 0],
        }),
        styles: {
          header: { fontSize: 16, bold: true, margin: [0, 0, 0, 4], color: '#0F172A' },
          subHeader: { fontSize: 9, color: '#64748B', margin: [0, 0, 0, 12] },
          tableHeader: { bold: true, fontSize: 9, color: '#FFFFFF', fillColor: '#0066FF' },
        },
        defaultStyle: { font: 'NotoSans', fontSize: 8 },
      });
      return { buffer: Buffer.from(await doc.getBuffer()), contentType: 'application/pdf', extension: 'pdf' };
    } catch (error) {
      this.logger.error(`Export failed for format ${format}:`, error);
      throw new BadRequestException(`Failed to generate ${format.toUpperCase()} export`);
    }
  }
}




