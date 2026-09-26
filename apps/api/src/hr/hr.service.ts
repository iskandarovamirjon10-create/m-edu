import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { Prisma, LeaveStatus, LeaveType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeDto, UpdateEmployeeDto, CreateLeaveRequestDto } from './dto/employee.dto';
import { GeneratePayrollDto } from './dto/payroll.dto';
import { PaginationParams } from '../common/dto/pagination';
import { parsePagination } from '../lib/pagination';
import { userPublicSelect } from '../common/selects/user.select';

@Injectable()
export class HremployeeService {
  constructor(private prisma: PrismaService) {}

  // ===================== Employee Management =====================

  async findAllEmployees(organizationId: string, params: PaginationParams) {
    const { search, department, isActive } = params;

    const where: Prisma.EmployeeWhereInput = { organizationId };

    if (search) {
      where.user = {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    if (department) {
      where.department = department;
    }

    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const { skip } = parsePagination(params);
    const pageVal = Math.max(1, parseInt(String(params?.page ?? ''), 10) || 1);
    const limitVal = Math.min(Math.max(1, parseInt(String(params?.limit ?? ''), 10) || 20), 100);

    const [employees, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        skip,
        take: limitVal,
        include: { user: userPublicSelect },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.employee.count({ where }),
    ]);

    return {
      employees,
      total,
      page: pageVal,
      limit: limitVal,
      totalPages: Math.ceil(total / limitVal),
    };
  }

  async findEmployeeById(organizationId: string, id: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, organizationId },
      include: {
        user: userPublicSelect,
        salaryRecords: {
          orderBy: { month: 'desc' },
          take: 12,
        },
        leaveRequests: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    return employee;
  }

  async createEmployee(organizationId: string, dto: CreateEmployeeDto) {
    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId, organizationId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if user is already an employee
    const existingEmployee = await this.prisma.employee.findFirst({
      where: { userId: dto.userId },
    });

    if (existingEmployee) {
      throw new BadRequestException('User is already an employee');
    }

    return this.prisma.employee.create({
      data: {
        ...dto,
        organizationId,
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }

  async updateEmployee(organizationId: string, id: string, dto: UpdateEmployeeDto) {
    await this.findEmployeeById(organizationId, id);

    return this.prisma.employee.update({
      where: { id, organizationId },
      data: dto,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }

  async terminateEmployee(organizationId: string, id: string, reason: string) {
    await this.findEmployeeById(organizationId, id);
    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      throw new BadRequestException('Termination reason is required');
    }
    return this.prisma.employee.update({
      where: { id, organizationId },
      data: {
        isActive: false,
        terminationDate: new Date(),
      },
    });
  }

  // ===================== Leave Management =====================

  async findAllLeaveRequests(organizationId: string, params: PaginationParams) {
    const { status, type, employeeId } = params;

    const where: Prisma.LeaveRequestWhereInput = { organizationId };

    if (status) {
      where.status = status as LeaveStatus;
    }

    if (type) {
      where.type = type as LeaveType;
    }

    if (employeeId) {
      where.employeeId = employeeId;
    }

    const { skip } = parsePagination(params);
    const pageVal = Math.max(1, parseInt(String(params?.page ?? ''), 10) || 1);
    const limitVal = Math.min(Math.max(1, parseInt(String(params?.limit ?? ''), 10) || 20), 100);

    const [requests, total] = await Promise.all([
      this.prisma.leaveRequest.findMany({
        where,
        skip,
        take: limitVal,
        include: {
          employee: {
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
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.leaveRequest.count({ where }),
    ]);

    return {
      requests,
      total,
      page: pageVal,
      limit: limitVal,
      totalPages: Math.ceil(total / limitVal),
    };
  }

  async createLeaveRequest(organizationId: string, dto: CreateLeaveRequestDto) {
    await this.findEmployeeById(organizationId, dto.employeeId);

    // Wrap check-and-create in a transaction so concurrent requests
    // can't both pass the overlap check and create duplicate leaves.
    return this.prisma.$transaction(async (tx) => {
      const overlapping = await tx.leaveRequest.findFirst({
        where: {
          organizationId,
          employeeId: dto.employeeId,
          status: { in: ['PENDING', 'APPROVED'] },
          startDate: { lte: new Date(dto.endDate) },
          endDate: { gte: new Date(dto.startDate) },
        },
      });

      if (overlapping) {
        throw new BadRequestException('Employee has overlapping leave request');
      }

      return tx.leaveRequest.create({
        data: {
          ...dto,
          organizationId,
          startDate: new Date(dto.startDate),
          endDate: new Date(dto.endDate),
        },
        include: {
          employee: {
            include: {
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
    });
  }

  async approveLeaveRequest(organizationId: string, id: string, approvedBy: string) {
    const request = await this.prisma.leaveRequest.findFirst({
      where: { id, organizationId, status: 'PENDING' },
    });

    if (!request) {
      throw new NotFoundException('Leave request not found or already processed');
    }

    return this.prisma.leaveRequest.update({
      where: { id, organizationId },
      data: {
        status: 'APPROVED',
        approvedBy,
        approvedAt: new Date(),
      },
    });
  }

  async rejectLeaveRequest(organizationId: string, id: string, reason: string) {
    const request = await this.prisma.leaveRequest.findFirst({
      where: { id, organizationId, status: 'PENDING' },
    });

    if (!request) {
      throw new NotFoundException('Leave request not found or already processed');
    }

    return this.prisma.leaveRequest.update({
      where: { id, organizationId },
      data: {
        status: 'REJECTED',
        rejectionReason: reason,
      },
    });
  }

  // ===================== Payroll =====================

  async getEmployeeSalaryHistory(organizationId: string, employeeId: string, userId: string, role: string, year?: number) {
    const employee = await this.findEmployeeById(organizationId, employeeId);
    
    if (role === 'TEACHER' && employee.userId !== userId) {
      throw new ForbiddenException('You can only view your own salary history');
    }

    const where: Prisma.SalaryRecordWhereInput = { organizationId, employeeId };

    if (year) {
      const startOfYear = new Date(year, 0, 1);
      const endOfYear = new Date(year, 11, 31, 23, 59, 59);
      where.month = {
        gte: startOfYear,
        lte: endOfYear,
      };
    }

    const salaryRecords = await this.prisma.salaryRecord.findMany({
      where,
      orderBy: { month: 'desc' },
    });

    return {
      employee,
      salaryRecords,
    };
  }

  async generatePayroll(organizationId: string, dto: GeneratePayrollDto) {
    const { month, employeeIds } = dto;
    const payrollDate = new Date(month);
    const startOfMonth = new Date(payrollDate.getFullYear(), payrollDate.getMonth(), 1);
    const endOfMonth = new Date(payrollDate.getFullYear(), payrollDate.getMonth() + 1, 0);

    // Get employees to process
    const where: Prisma.EmployeeWhereInput = { organizationId, isActive: true };
    if (employeeIds && employeeIds.length > 0) {
      where.id = { in: employeeIds };
    }

    const employees = await this.prisma.employee.findMany({
      where,
      include: {
        salaryRecords: {
          where: {
            month: {
              gte: startOfMonth,
              lte: endOfMonth,
            },
          },
        },
      },
    });

    // Atomic payroll generation: check for existing records and create
    // inside a transaction to prevent concurrent double-generation.
    const salaryRecords = await this.prisma.$transaction(async (tx) => {
      // Lock existing records for the month by checking inside transaction.
      const existingChecks = await tx.salaryRecord.findMany({
        where: {
          organizationId,
          employeeId: { in: employees.map((e) => e.id) },
          month: { gte: startOfMonth, lte: endOfMonth },
        },
      });
      if (existingChecks.length > 0) {
        throw new BadRequestException('Payroll already generated for some employees this month');
      }
      return Promise.all(
        employees.map(async (employee) => {
          const bonuses = dto.bonuses?.[employee.id] || 0;
          const deductions = dto.deductions?.[employee.id] || 0;
          // Round tax/net to 2 decimal places to avoid float drift in money.
          const taxRate = 0.12;
          const taxableIncome = Number(employee.salary) + bonuses - deductions;
          const tax = Math.round(taxableIncome * taxRate * 100) / 100;
          const netSalary = Math.round((taxableIncome - tax) * 100) / 100;
          return tx.salaryRecord.create({
            data: {
              organizationId,
              employeeId: employee.id,
              month: startOfMonth,
              baseSalary: employee.salary,
              bonuses,
              deductions,
              tax,
              netSalary,
              status: 'PENDING',
            },
          });
        }),
      );
    });

    return {
      month: startOfMonth,
      generatedCount: salaryRecords.length,
      salaryRecords,
    };
  }

  async processSalaryPayment(organizationId: string, recordId: string) {
    // Atomic conditional update: only one concurrent caller can flip
    // PENDING → PAID; the rest see count === 0 (no TOCTOU race).
    const result = await this.prisma.salaryRecord.updateMany({
      where: { id: recordId, organizationId, status: 'PENDING' },
      data: {
        status: 'PAID',
        paymentDate: new Date(),
      },
    });

    if (result.count === 0) {
      throw new NotFoundException('Salary record not found or already processed');
    }

    return this.prisma.salaryRecord.findFirst({ where: { id: recordId, organizationId } });
  }

  async getPayrollSummary(organizationId: string, month: string) {
    const payrollDate = new Date(month);
    const startOfMonth = new Date(payrollDate.getFullYear(), payrollDate.getMonth(), 1);
    const endOfMonth = new Date(payrollDate.getFullYear(), payrollDate.getMonth() + 1, 0);

    const records = await this.prisma.salaryRecord.findMany({
      where: {
        organizationId,
        month: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      include: {
        employee: {
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
    });

    const summary = {
      totalBaseSalary: records.reduce((sum, r) => sum + Number(r.baseSalary), 0),
      totalBonuses: records.reduce((sum, r) => sum + Number(r.bonuses || 0), 0),
      totalDeductions: records.reduce((sum, r) => sum + Number(r.deductions || 0), 0),
      totalTax: records.reduce((sum, r) => sum + Number(r.tax || 0), 0),
      totalNetSalary: records.reduce((sum, r) => sum + Number(r.netSalary), 0),
      paidCount: records.filter((r) => r.status === 'PAID').length,
      pendingCount: records.filter((r) => r.status === 'PENDING').length,
      records,
    };

    return summary;
  }

  // ===================== Reports =====================

  async getHRStats(organizationId: string) {
    const [totalEmployees, activeEmployees, departments, pendingLeaves, monthlyPayroll] =
      await Promise.all([
        this.prisma.employee.count({ where: { organizationId } }),
        this.prisma.employee.count({ where: { organizationId, isActive: true } }),
        this.prisma.employee.groupBy({
          by: ['department'],
          where: { organizationId },
          _count: { department: true },
        }),
        this.prisma.leaveRequest.count({
          where: { organizationId, status: 'PENDING' },
        }),
        this.prisma.salaryRecord.aggregate({
          where: {
            organizationId,
            createdAt: {
              gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            },
          },
          _sum: {
            netSalary: true,
          },
        }),
      ]);

    return {
      totalEmployees,
      activeEmployees,
      departments: departments.map((d) => ({
        name: d.department,
        count: d._count.department,
      })),
      pendingLeaves,
      monthlyPayroll: monthlyPayroll._sum.netSalary || 0,
    };
  }
}
