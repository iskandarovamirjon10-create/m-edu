import type { AiToolDefinition } from '@medu/contracts';
import type { StudentsService } from '../../../students/students.service';
import type { TeachersService } from '../../../teachers/teachers.service';
import type { AttendanceService } from '../../../attendance/attendance.service';
import type { ScheduleService } from '../../../schedule/schedule.service';
import type { InvoicesService } from '../../../payments/invoices.service';
import type { GroupsService } from '../../../groups/groups.service';
import type { CoursesService } from '../../../courses/courses.service';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { LeadsService } from '../../../leads/leads.service';
import type { ExpensesService } from '../../../expenses/expenses.service';
import type { InventoryService } from '../../../inventory/inventory.service';
import type { ExamsService } from '../../../exams/exams.service';
import { createStudentsTools } from '../students/students.tools';
import { createTeachersTools } from '../teachers/teachers.tools';
import { createAttendanceTools } from '../attendance/attendance.tools';
import { createPaymentsTools } from '../payments/payments.tools';
import { createScheduleTools } from '../schedule/schedule.tools';
import { createGroupsTools } from '../groups/groups.tools';
import { createCoursesTools } from '../courses/courses.tools';
import { createNotificationsTools } from '../notifications/notifications.tools';
import { createGradesTools } from '../grades/grades.tools';
import { createLeadsTools } from '../leads/leads.tools';
import { createFinanceTools } from '../finance/finance.tools';
import { createBiometricsTools } from '../biometrics/biometrics.tools';
import { createInventoryTools } from '../inventory/inventory.tools';
import { createExamsTools } from '../exams/exams.tools';

export interface AiToolDependencies {
  students: StudentsService;
  teachers: TeachersService;
  attendance: AttendanceService;
  schedule: ScheduleService;
  invoices: InvoicesService;
  groups: GroupsService;
  courses: CoursesService;
  prisma: PrismaService;
  leads?: LeadsService;
  expenses?: ExpensesService;
  inventory?: InventoryService;
  exams?: ExamsService;
}

/** Build the full, canonical set of AI tools from domain services. */
export function createAiToolDefinitions(deps: AiToolDependencies): AiToolDefinition[] {
  const tools: AiToolDefinition[] = [
    ...createStudentsTools(deps.students, deps.prisma),
    ...createTeachersTools(deps.teachers, deps.prisma),
    ...createAttendanceTools(deps.attendance, deps.prisma),
    ...createPaymentsTools(deps.invoices),
    ...createScheduleTools(deps.schedule),
    ...createGroupsTools(deps.groups),
    ...createCoursesTools(deps.courses),
    ...createNotificationsTools(deps.prisma),
    ...createGradesTools(deps.prisma),
    ...createBiometricsTools(deps.prisma),
  ];

  if (deps.leads) {
    tools.push(...createLeadsTools(deps.leads));
  }
  if (deps.expenses) {
    tools.push(...createFinanceTools(deps.expenses, deps.prisma));
  }
  if (deps.inventory) {
    tools.push(...createInventoryTools(deps.inventory));
  }
  if (deps.exams) {
    tools.push(...createExamsTools(deps.exams));
  }

  return tools;
}
