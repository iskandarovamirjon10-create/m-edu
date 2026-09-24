import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TeacherWorkloadQueryDto } from './dto/teacher-workload-query.dto';

export interface WorkloadSummary {
  total: number;
  overloaded: number;
  balanced: number;
  underutilized: number;
  avgUtilization: number;
}

export interface TeacherWorkloadItem {
  teacherId: string;
  teacherName: string;
  groupsCount: number;
  studentsCount: number;
  hoursPerWeek: number;
  capacityHours: number;
  utilization: number;
  status: 'UNDERUTILIZED' | 'BALANCED' | 'OVERLOADED';
}

@Injectable()
export class TeacherWorkloadService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(orgId: string): Promise<WorkloadSummary> {
    const items = await this.findAll(orgId, { limit: 500, page: 1 });
    const total = items.items.length;
    const overloaded = items.items.filter(i => i.status === 'OVERLOADED').length;
    const balanced = items.items.filter(i => i.status === 'BALANCED').length;
    const underutilized = items.items.filter(i => i.status === 'UNDERUTILIZED').length;
    const avgUtilization = total > 0
      ? Math.round((items.items.reduce((s, i) => s + i.utilization, 0) / total) * 100) / 100
      : 0;
    return { total, overloaded, balanced, underutilized, avgUtilization };
  }

  async findAll(
    orgId: string,
    query: TeacherWorkloadQueryDto,
  ): Promise<{ items: TeacherWorkloadItem[]; total: number }> {
    const teachers = await this.prisma.teacher.findMany({
      where: { organizationId: orgId },
      include: {
        user: { select: { firstName: true, lastName: true } },
        groups: {
          where: { isActive: true },
          include: {
            schedules: { where: { isActive: true } },
            enrollments: { where: { isActive: true } },
          },
        },
      },
    });

    const items: TeacherWorkloadItem[] = [];

    for (const teacher of teachers) {
      const groupsCount = teacher.groups.length;
      let studentsCount = 0;
      let minutesPerWeek = 0;

      for (const group of teacher.groups) {
        studentsCount += group.enrollments.length;
        for (const sched of group.schedules) {
          minutesPerWeek += this.parseMinutes(sched.startTime, sched.endTime);
        }
      }

      const hoursPerWeek = Math.round((minutesPerWeek / 60) * 100) / 100;
      const capacityHours = 40;
      const utilization = capacityHours > 0 ? Math.round((hoursPerWeek / capacityHours) * 100) / 100 : 0;

      let status: 'UNDERUTILIZED' | 'BALANCED' | 'OVERLOADED';
      if (utilization < 0.6) status = 'UNDERUTILIZED';
      else if (utilization <= 1) status = 'BALANCED';
      else status = 'OVERLOADED';

      items.push({
        teacherId: teacher.id,
        teacherName: `${teacher.user.firstName} ${teacher.user.lastName}`,
        groupsCount,
        studentsCount,
        hoursPerWeek,
        capacityHours,
        utilization,
        status,
      });
    }

    if (query.status) {
      const filtered = items.filter(i => i.status === query.status);
      const limit = query.limit ?? 50;
      const page = query.page ?? 1;
      const total = filtered.length;
      return { items: filtered.slice((page - 1) * limit, page * limit), total };
    }

    const limit = query.limit ?? 50;
    const page = query.page ?? 1;
    const total = items.length;
    return { items: items.slice((page - 1) * limit, page * limit), total };
  }

  private parseMinutes(startTime: string, endTime: string): number {
    try {
      const [sh, sm] = startTime.split(':').map(Number);
      const [eh, em] = endTime.split(':').map(Number);
      const startMin = sh * 60 + sm;
      const endMin = eh * 60 + em;
      const diff = endMin - startMin;
      return diff > 0 ? diff : 0;
    } catch {
      return 60;
    }
  }
}
