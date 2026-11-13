import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import {
  ApplySiblingGroupDiscountsDto,
  EvaluateStudentDiscountsDto,
} from './dto/smart-discount.dto';

export interface AppliedDiscountBreakdown {
  ruleName: string;
  category: 'SIBLING' | 'MERIT' | 'MULTI_COURSE' | 'LOYALTY';
  type: 'PERCENTAGE' | 'FIXED';
  value: number;
  deductionAmountUz: number;
  explanation: string;
}

export interface StudentDiscountEvaluation {
  studentId: string;
  studentName: string;
  grossTuitionUz: number;
  totalDeductionUz: number;
  netPayableUz: number;
  effectiveDiscountPercentage: number;
  appliedDiscounts: AppliedDiscountBreakdown[];
  siblingNetwork: {
    siblingCount: number;
    birthOrEnrollmentOrder: number;
    members: { studentId: string; name: string; enrolledGroups: string[] }[];
  };
}

@Injectable()
export class SmartDiscountService {
  private readonly logger = new Logger(SmartDiscountService.name);

  // Maximum allowed total cumulative discount to protect center unit economics
  private readonly MAX_DISCOUNT_CAP_PERCENT = 40;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Resolves sibling family network for a student based on shared parent links or matching phone numbers.
   */
  async detectSiblingNetwork(organizationId: string, studentId: string) {
    const target = await this.prisma.student.findFirst({
      where: { id: studentId, organizationId },
      include: {
        user: { select: { firstName: true, lastName: true, phone: true } },
        parentStudents: { select: { parentId: true } },
      },
    });

    if (!target) {
      throw new NotFoundException(`Student [${studentId}] not found in this organization`);
    }

    const parentAccountIds = target.parentStudents.map((ps) => ps.parentId);
    const parentPhone = target.parentPhone?.trim();

    // Query for siblings in the same organization
    const siblings = await this.prisma.student.findMany({
      where: {
        organizationId,
        status: 'ACTIVE',
        OR: [
          ...(parentAccountIds.length > 0
            ? [{ parentStudents: { some: { parentId: { in: parentAccountIds } } } }]
            : []),
          ...(parentPhone && parentPhone.length >= 7
            ? [{ parentPhone: { equals: parentPhone } }]
            : []),
        ],
      },
      include: {
        user: { select: { firstName: true, lastName: true } },
        groups: {
          where: { isActive: true },
          include: { group: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: 'asc' }, // Older enrollments come first
    });

    const members = siblings.map((s, idx) => ({
      studentId: s.id,
      name: `${s.user.firstName} ${s.user.lastName}`.trim(),
      order: idx + 1, // 1st child, 2nd child, etc.
      enrolledGroups: (s.groups || []).map((sg) => sg.group?.name || 'Guruh'),
    }));

    const myIndex = members.findIndex((m) => m.studentId === target.id);
    const birthOrEnrollmentOrder = myIndex >= 0 ? myIndex + 1 : 1;

    return {
      siblingCount: members.length,
      birthOrEnrollmentOrder,
      members,
    };
  }

  /**
   * Evaluates all automatic pricing rules (Family Sibling, Merit, Multi-Course, Loyalty).
   */
  async evaluateDiscounts(
    organizationId: string,
    dto: EvaluateStudentDiscountsDto,
  ): Promise<StudentDiscountEvaluation> {
    const student = await this.prisma.student.findFirst({
      where: { id: dto.studentId, organizationId },
      include: {
        user: { select: { firstName: true, lastName: true, createdAt: true } },
        groups: { where: { isActive: true } },
        grades: {
          where: {
            createdAt: { gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) },
          },
          select: { value: true },
        },
      },
    });

    if (!student) {
      throw new NotFoundException(`Student [${dto.studentId}] not found in this organization`);
    }

    const grossTuition = Math.max(0, dto.tuitionAmount);
    const appliedDiscounts: AppliedDiscountBreakdown[] = [];

    // 1. Sibling / Family Discount Evaluation
    const siblingNetwork = await this.detectSiblingNetwork(organizationId, student.id);
    if (siblingNetwork.siblingCount > 1) {
      if (siblingNetwork.birthOrEnrollmentOrder === 2) {
        // 2nd child: 10% discount
        const deduction = Math.round(grossTuition * 0.1);
        appliedDiscounts.push({
          ruleName: 'Oila / Aka-uka chegirmasi (2-farzand)',
          category: 'SIBLING',
          type: 'PERCENTAGE',
          value: 10,
          deductionAmountUz: deduction,
          explanation: `Bir oiladan ${siblingNetwork.siblingCount} nafar farzand o‘qimoqda (2-farzand uchun 10% chegirma).`,
        });
      } else if (siblingNetwork.birthOrEnrollmentOrder >= 3) {
        // 3rd+ child: 20% discount
        const deduction = Math.round(grossTuition * 0.2);
        appliedDiscounts.push({
          ruleName: `Oila / Aka-uka chegirmasi (${siblingNetwork.birthOrEnrollmentOrder}-farzand)`,
          category: 'SIBLING',
          type: 'PERCENTAGE',
          value: 20,
          deductionAmountUz: deduction,
          explanation: `Bir oiladan ${siblingNetwork.siblingCount} nafar farzand o‘qimoqda (${siblingNetwork.birthOrEnrollmentOrder}-farzand uchun 20% chegirma).`,
        });
      }
    }

    // 2. Merit / Academic Excellence Grant (Average score >= 90%)
    const validScores = (student.grades || []).map((g) => Number(g.value)).filter(Number.isFinite);
    if (validScores.length >= 2) {
      const avgScore = validScores.reduce((a, b) => a + b, 0) / validScores.length;
      if (avgScore >= 90) {
        const deduction = Math.round(grossTuition * 0.15);
        appliedDiscounts.push({
          ruleName: 'Akademik Grand / A’lochi talaba stipendiyasi',
          category: 'MERIT',
          type: 'PERCENTAGE',
          value: 15,
          deductionAmountUz: deduction,
          explanation: `So‘nggi imtihonlar o‘rtacha bali ${Math.round(avgScore)}% (Grant: 15% chegirma).`,
        });
      }
    }

    // 3. Multi-Course Bundle Discount (Enrolled in >= 2 active groups)
    if ((student.groups || []).length >= 2) {
      const deduction = Math.round(grossTuition * 0.1);
      appliedDiscounts.push({
        ruleName: 'Multi-kurs to‘plami (2+ ta guruhda faol)',
        category: 'MULTI_COURSE',
        type: 'PERCENTAGE',
        value: 10,
        deductionAmountUz: deduction,
        explanation: `Talaba bir vaqtning o‘zida ${student.groups.length} ta guruhda o‘rganmoqda (10% to‘plam chegirmasi).`,
      });
    }

    // 4. Loyalty Discount (Enrolled > 180 days)
    const enrollmentDate = student.enrollmentDate || student.createdAt;
    const daysEnrolled = Math.floor(
      (Date.now() - new Date(enrollmentDate).getTime()) / (24 * 60 * 60 * 1000),
    );
    if (daysEnrolled >= 180) {
      const deduction = Math.round(grossTuition * 0.05);
      appliedDiscounts.push({
        ruleName: 'Sodiqlik chegirmasi (6+ oylik faol ta’lim)',
        category: 'LOYALTY',
        type: 'PERCENTAGE',
        value: 5,
        deductionAmountUz: deduction,
        explanation: `Talaba markazda ${daysEnrolled} kundan buyon uzluksiz ta’lim olmoqda (5% sodiqlik chegirmasi).`,
      });
    }

    // Calculate total deduction with ceiling cap
    const rawTotalDeduction = appliedDiscounts.reduce((sum, d) => sum + d.deductionAmountUz, 0);
    const maxAllowedDeduction = Math.round(grossTuition * (this.MAX_DISCOUNT_CAP_PERCENT / 100));

    const totalDeductionUz = Math.min(rawTotalDeduction, maxAllowedDeduction);
    const netPayableUz = Math.max(0, grossTuition - totalDeductionUz);
    const effectiveDiscountPercentage =
      grossTuition > 0 ? Math.round((totalDeductionUz / grossTuition) * 100) : 0;

    return {
      studentId: student.id,
      studentName: `${student.user.firstName} ${student.user.lastName}`.trim(),
      grossTuitionUz: grossTuition,
      totalDeductionUz,
      netPayableUz,
      effectiveDiscountPercentage,
      appliedDiscounts,
      siblingNetwork,
    };
  }

  /**
   * Automatically persists sibling discounts into the database for the entire family.
   */
  async applySiblingDiscounts(
    organizationId: string,
    actorId: string,
    dto: ApplySiblingGroupDiscountsDto,
  ) {
    const network = await this.detectSiblingNetwork(organizationId, dto.studentId);
    if (network.siblingCount < 2) {
      throw new BadRequestException(
        'Ushbu talaba uchun oila a’zolari (aka-uka/opa-singillar) topilmadi.',
      );
    }

    const tier2 = dto.discountPercentTier2 ?? 10;
    const tier3 = dto.discountPercentTier3 ?? 20;

    const createdDiscounts: any[] = [];

    for (const member of network.members) {
      if (member.order === 1) continue; // 1st child pays full price

      const percent = member.order === 2 ? tier2 : tier3;
      const discountName = `Oila chegirmasi (${member.order}-farzand, ${percent}%)`;

      // Deactivate older sibling discounts for this student
      await this.prisma.discount.updateMany({
        where: {
          organizationId,
          studentId: member.studentId,
          name: { startsWith: 'Oila chegirmasi' },
        },
        data: { isActive: false },
      });

      const rec = await this.prisma.discount.create({
        data: {
          organizationId,
          studentId: member.studentId,
          name: discountName,
          type: 'PERCENTAGE',
          value: percent,
          scope: 'STUDENT',
          reason: `Aka-uka tarmog‘i: ${network.siblingCount} ta farzand, tartib raqami: ${member.order}`,
          createdBy: actorId,
          isActive: true,
        },
      });
      createdDiscounts.push(rec);
    }

    await this.audit.record({
      organizationId,
      userId: actorId,
      action: 'APPLY_FAMILY_DISCOUNTS',
      resource: 'Discount',
      resourceId: dto.studentId,
      changes: {
        familyDiscounts: {
          old: null,
          new: {
            familyMembersCount: network.siblingCount,
            appliedCount: createdDiscounts.length,
            tier2,
            tier3,
          },
        },
      },
    });

    this.logger.log(
      `Family discount batch applied for ${network.siblingCount} siblings in org [${organizationId}] by user [${actorId}]`,
    );

    return {
      success: true,
      familyMembersCount: network.siblingCount,
      appliedDiscountsCount: createdDiscounts.length,
      discounts: createdDiscounts,
      message: `Oila chegirmasi ${network.siblingCount} nafar farzand uchun muvaffaqiyatli saqlandi va faollashtirildi.`,
    };
  }
}
