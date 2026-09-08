import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { authTracker } from './config/auth-tracker';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { StudentsModule } from './students/students.module';
import { TeachersModule } from './teachers/teachers.module';
import { CoursesModule } from './courses/courses.module';
import { GroupsModule } from './groups/groups.module';
import { ScheduleModule } from './schedule/schedule.module';
import { AttendanceModule } from './attendance/attendance.module';
import { PaymentsModule } from './payments/payments.module';
import { ExpensesModule } from './expenses/expenses.module';
import { LeadsModule } from './leads/leads.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { NotificationsModule } from './notifications/notifications.module';
import { GradesModule } from './grades/grades.module';
import { HomeworkModule } from './homework/homework.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { HealthModule } from './health/health.module';
import { FaceModule } from './face/face.module';
import { CameraModule } from './camera/camera.module';

// ===================== v2 Modules =====================
import { LibraryModule } from './library/library.module';
import { HrModule } from './hr/hr.module';
import { ExamsModule } from './exams/exams.module';
import { CertificatesModule } from './certificates/certificates.module';
import { InventoryModule } from './inventory/inventory.module';
import { AuditModule } from './audit/audit.module';
import { SearchModule } from './search/search.module';
import { WorkflowModule } from './workflow/workflow.module';
import { DocumentsModule } from './documents/documents.module';
import { DataQualityModule } from './data-quality/data-quality.module';
import { EarlyWarningModule } from './early-warning/early-warning.module';
import { AcademicRiskModule } from './academic-risk/academic-risk.module';
import { TeacherWorkloadModule } from './teacher-workload/teacher-workload.module';
import { ForecastingModule } from './forecasting/forecasting.module';
import { ResourcesModule } from './resources/resources.module';
import { BookingsModule } from './bookings/bookings.module';
import { FeatureFlagsModule } from './feature-flags/feature-flags.module';
import { SecurityModule } from './security/security.module';
import { SystemHealthModule } from './system-health/system-health.module';
import { ImportExportModule } from './import-export/import-export.module';
import { RelationshipsModule } from './relationships/relationships.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'default',
          ttl: 60000,
          limit: 100,
        },
      ],
      // Rate-limit authenticated requests per-user (stable account id),
      // falling back to the client IP for anonymous traffic (login/register).
      // This prevents one user behind a shared NAT from exhausting the
      // shared-IP bucket, and prevents anonymous abuse of auth endpoints.
      getTracker: authTracker,
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    StudentsModule,
    TeachersModule,
    CoursesModule,
    GroupsModule,
    ScheduleModule,
    AttendanceModule,
    PaymentsModule,
    ExpensesModule,
    LeadsModule,
    OrganizationsModule,
    NotificationsModule,
    GradesModule,
    HomeworkModule,
    DashboardModule,
    AnalyticsModule,
    HealthModule,
    FaceModule,
    CameraModule,

    // v2 Premium Modules
    LibraryModule,
    HrModule,
    ExamsModule,
    CertificatesModule,
    InventoryModule,

    // Platform Expansion Modules
    AuditModule,
    SearchModule,
    WorkflowModule,
    DocumentsModule,
    DataQualityModule,
    EarlyWarningModule,
    AcademicRiskModule,
    TeacherWorkloadModule,
    ForecastingModule,
    ResourcesModule,
    BookingsModule,
    FeatureFlagsModule,
    SecurityModule,
    SystemHealthModule,
    ImportExportModule,
    RelationshipsModule,
  ],
  providers: [
    // Apply rate limiting to every HTTP endpoint. Per-endpoint overrides use
    // @Throttle({ default: { limit, ttl } }) — e.g. auth (login/register) and
    // face capture/attempt endpoints are tightened well below the 100/min
    // default (see auth.controller.ts and face.controller.ts).
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
