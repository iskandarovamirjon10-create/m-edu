import type { AiToolDefinition } from '@medu/contracts';
import type { StudentsService } from '../../../students/students.service';
import type { TeachersService } from '../../../teachers/teachers.service';
import type { AttendanceService } from '../../../attendance/attendance.service';
import type { ScheduleService } from '../../../schedule/schedule.service';
import type { InvoicesService } from '../../../payments/invoices.service';
import type { GroupsService } from '../../../groups/groups.service';
import type { CoursesService } from '../../../courses/courses.service';
import type { PrismaService } from '../../../prisma/prisma.service';
import { createStudentsTools } from '../students/students.tools';
import { createTeachersTools } from '../teachers/teachers.tools';
import { createAttendanceTools } from '../attendance/attendance.tools';
import { createPaymentsTools } from '../payments/payments.tools';
import { createScheduleTools } from '../schedule/schedule.tools';
import { createGroupsTools } from '../groups/groups.tools';
import { createCoursesTools } from '../courses/courses.tools';
import { createNotificationsTools } from '../notifications/notifications.tools';
import { createGradesTools } from '../grades/grades.tools';

export interface AiToolDependencies {
  students: StudentsService;
  teachers: TeachersService;
  attendance: AttendanceService;
  schedule: ScheduleService;
  invoices: InvoicesService;
  groups: GroupsService;
  courses: CoursesService;
  prisma: PrismaService;
}

/** Build the full, canonical set of AI tools from domain services. */
export function createAiToolDefinitions(deps: AiToolDependencies): AiToolDefinition[] {
  return [
    ...createStudentsTools(deps.students),
    ...createTeachersTools(deps.teachers, deps.prisma),
    ...createAttendanceTools(deps.attendance, deps.prisma),
    ...createPaymentsTools(deps.invoices),
    ...createScheduleTools(deps.schedule),
    ...createGroupsTools(deps.groups),
    ...createCoursesTools(deps.courses),
    ...createNotificationsTools(deps.prisma),
    ...createGradesTools(deps.prisma),
  ];
}
