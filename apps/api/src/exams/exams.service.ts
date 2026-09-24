import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExamDto, UpdateExamDto, CreateExamResultDto, PublishExamDto } from './dto/exam.dto';
import { PaginationParams } from '../common/dto/pagination';
import { parsePagination } from '../lib/pagination';

@Injectable()
export class ExamsService {
  constructor(private prisma: PrismaService) {}

  // ===================== Exam Management =====================

  async findAllExams(organizationId: string, params: PaginationParams) {
    const { search, examType, isPublished } = params;

    const where: Prisma.ExamWhereInput = { organizationId };

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { subject: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (examType) {
      where.examType = examType as Prisma.EnumExamTypeFilter['equals'];
    }

    if (isPublished !== undefined) {
      // Query params arrive as strings; Boolean('false') is true — parse explicitly.
      where.isPublished = isPublished === 'true' || isPublished === '1';
    }

    const { skip } = parsePagination(params);
    const pageVal = Math.max(1, parseInt(String(params?.page ?? ''), 10) || 1);
    const limitVal = Math.min(Math.max(1, parseInt(String(params?.limit ?? ''), 10) || 20), 100);

    const [exams, total] = await Promise.all([
      this.prisma.exam.findMany({
        where,
        skip,
        take: limitVal,
        orderBy: { examDate: 'desc' },
        include: {
          group: {
            select: {
              id: true,
              name: true,
              course: true,
            },
          },
          results: {
            select: {
              id: true,
              marksObtained: true,
              isPassed: true,
              student: true,
            },
            take: 5,
          },
        },
      }),
      this.prisma.exam.count({ where }),
    ]);

    return {
      exams,
      total,
      page: pageVal,
      limit: limitVal,
      totalPages: Math.ceil(total / limitVal),
    };
  }

  async findExamById(organizationId: string, id: string) {
    const exam = await this.prisma.exam.findFirst({
      where: { id, organizationId },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            courseId: true,
            teacher: true,
          },
        },
        results: {
          include: {
            student: {
              select: {
                id: true,
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!exam) {
      throw new NotFoundException('Exam not found');
    }

    return exam;
  }

  async createExam(organizationId: string, dto: CreateExamDto) {
    // Verify group exists and belongs to organization
    const group = await this.prisma.group.findFirst({
      where: { id: dto.groupId, organizationId },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    return this.prisma.exam.create({
      data: {
        ...dto,
        organizationId,
        examDate: new Date(dto.examDate),
      },
      include: {
        group: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async updateExam(organizationId: string, id: string, dto: UpdateExamDto) {
    const exam = await this.findExamById(organizationId, id);

    // Check if exam is already published
    if (exam.isPublished) {
      throw new BadRequestException('Cannot update published exam');
    }

    return this.prisma.exam.update({
      where: { id },
      data: dto,
    });
  }

  async deleteExam(organizationId: string, id: string) {
    const exam = await this.findExamById(organizationId, id);

    // Check if exam is published
    if (exam.isPublished) {
      throw new BadRequestException('Cannot delete published exam');
    }

    // Check if results exist
    const resultsCount = await this.prisma.examResult.count({
      where: { examId: id },
    });

    if (resultsCount > 0) {
      throw new BadRequestException('Cannot delete exam with existing results');
    }

    return this.prisma.exam.delete({
      where: { id },
    });
  }

  async publishExam(organizationId: string, id: string, dto: PublishExamDto) {
    await this.findExamById(organizationId, id);

    // Validate results exist
    const results = await this.prisma.examResult.findMany({
      where: { examId: id },
    });

    if (results.length === 0 && !dto.force) {
      throw new BadRequestException('Cannot publish exam without results');
    }

    return this.prisma.exam.update({
      where: { id },
      data: {
        isPublished: dto.isPublished,
      },
    });
  }

  // ===================== Exam Results =====================

  async getExamResults(organizationId: string, examId: string, studentId?: string) {
    const exam = await this.findExamById(organizationId, examId);

    const where: Prisma.ExamResultWhereInput = { examId, organizationId };

    if (studentId) {
      where.studentId = studentId;
    }

    const results = await this.prisma.examResult.findMany({
      where,
      include: {
        student: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: [{ rank: 'asc' }, { createdAt: 'desc' }],
    });

    return {
      exam,
      results,
    };
  }

  async createExamResult(organizationId: string, examId: string, dto: CreateExamResultDto) {
    const exam = await this.findExamById(organizationId, examId);

    // Cross-tenant guard: the student must belong to this organization.
    const student = await this.prisma.student.findFirst({
      where: { id: dto.studentId, organizationId },
      select: { id: true },
    });
    if (!student) {
      throw new NotFoundException('Student not found');
    }

    // The exam always targets a group, so the student must be an active member
    // of that group — otherwise a caller could attach results to an unrelated
    // roster. Membership lives in the StudentGroup join table.
    const membership = await this.prisma.studentGroup.findFirst({
      where: {
        studentId: dto.studentId,
        groupId: exam.groupId,
        organizationId,
        isActive: true,
      },
      select: { studentId: true },
    });
    if (!membership) {
      throw new BadRequestException('Student is not enrolled in this exam group');
    }

    // Check if result already exists
    const existingResult = await this.prisma.examResult.findFirst({
      where: { examId, studentId: dto.studentId },
    });

    if (existingResult) {
      throw new BadRequestException('Result for this student already exists');
    }

    // Calculate grade and pass/fail
    const marksObtained = Number(dto.marksObtained);
    const totalMarks = Number(exam.totalMarks);

    if (marksObtained < 0) {
      throw new BadRequestException('Marks obtained cannot be negative');
    }
    if (marksObtained > totalMarks) {
      throw new BadRequestException(
        `Marks obtained (${marksObtained}) cannot exceed total marks (${totalMarks})`,
      );
    }

    const isPassed = marksObtained >= Number(exam.passingMarks);
    const percentage = (marksObtained / totalMarks) * 100;
    let grade: string;

    if (percentage >= 90) grade = 'A+';
    else if (percentage >= 80) grade = 'A';
    else if (percentage >= 70) grade = 'B+';
    else if (percentage >= 60) grade = 'B';
    else if (percentage >= 50) grade = 'C';
    else grade = 'F';

    return this.prisma.examResult.create({
      data: {
        examId,
        studentId: dto.studentId,
        organizationId,
        marksObtained: marksObtained,
        grade,
        isPassed,
        submittedAt: new Date(),
        evaluatedAt: new Date(),
      },
      include: {
        student: {
          select: {
            id: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });
  }

  // ===================== Statistics =====================

  async getExamStats(organizationId: string) {
    const [
      totalExams,
      publishedExams,
      averageScore,
      resultCountRow,
      highestScore,
      lowestScore,
      passedCount,
    ] = await Promise.all([
      this.prisma.exam.count({ where: { organizationId } }),
      this.prisma.exam.count({ where: { organizationId, isPublished: true } }),
      this.prisma.examResult.aggregate({
        where: { organizationId },
        _avg: { marksObtained: true },
      }),
      this.prisma.examResult.aggregate({
        where: { organizationId },
        _count: { _all: true },
      }),
      this.prisma.examResult.aggregate({
        where: { organizationId },
        _max: { marksObtained: true },
      }),
      this.prisma.examResult.aggregate({
        where: { organizationId },
        _min: { marksObtained: true },
      }),
      this.prisma.examResult.count({
        where: { organizationId, isPassed: true },
      }),
    ]);

    const totalResults = resultCountRow._count._all ?? 0;
    const passRate = totalResults > 0 ? (passedCount / totalResults) * 100 : 0;

    return {
      totalExams,
      publishedExams,
      totalResults,
      passedCount,
      averageScore: averageScore._avg.marksObtained || 0,
      passRate,
      highestScore: highestScore._max.marksObtained || 0,
      lowestScore: lowestScore._min.marksObtained || 0,
    };
  }

  // ===================== Student View =====================

  async getStudentExamResults(organizationId: string, studentId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, organizationId },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const results = await this.prisma.examResult.findMany({
      where: { organizationId, studentId },
      include: {
        exam: {
          select: {
            id: true,
            title: true,
            subject: true,
            examDate: true,
            duration: true,
            totalMarks: true,
            passingMarks: true,
            examType: true,
            isPublished: true,
          },
        },
      },
      orderBy: { exam: { examDate: 'desc' } },
    });

    // Calculate statistics
    const passed = results.filter((r) => r.isPassed).length;
    const total = results.length;
    const average = results.reduce((sum, r) => sum + Number(r.marksObtained), 0) / (total || 1);

    return {
      student,
      results,
      statistics: {
        totalExams: total,
        passedExams: passed,
        failedExams: total - passed,
        averageScore: average || 0,
        passingRate: total > 0 ? (passed / total) * 100 : 0,
      },
    };
  }
}