import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule as NestScheduleModule } from '@nestjs/schedule';
import { authTracker } from './config/auth-tracker';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { RedisPubSubModule } from './common/redis/redis-pubsub.module';
import { AuthModule } from './auth/auth.module';
import { GlobalAuthGuard } from './auth/global-auth.guard';
import { UsersModule } from './users/users.module';
import { AdminModule } from './admin/admin.module';
import { StudentsModule } from './students/students.module';
import { TeachersModule } from './teachers/teachers.module';
import { CoursesModule } from './courses/courses.module';
import { SubjectsModule } from './subjects/subjects.module';
import { CurriculumModule } from './curriculum/curriculum.module';
import { LessonsModule } from './lessons/lessons.module';
import { LearningMaterialsModule } from './learning-materials/learning-materials.module';
import { AssignmentsModule } from './assignments/assignments.module';
import { AssessmentModule } from './assessment/assessment.module';
import { ProgressModule } from './progress/progress.module';
import { CommunicationModule } from './communication/communication.module';
import { CalendarModule } from './calendar/calendar.module';
import { GroupsModule } from './groups/groups.module';
import { ScheduleModule } from './schedule/schedule.module';
import { AttendanceModule } from './attendance/attendance.module';
import { PaymentsModule } from './payments/payments.module';
import { ExpensesModule } from './expenses/expenses.module';
import { LeadsModule } from './leads/leads.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { NotificationsModule } from './notifications/notifications.module';
import { TelegramModule } from './telegram/telegram.module';
import { GradesModule } from './grades/grades.module';
import { HomeworkModule } from './homework/homework.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { HealthModule } from './health/health.module';
import { FaceModule } from './face/face.module';
import { CameraModule } from './camera/camera.module';
import { AiModule } from './ai/ai.module';
import { CsrfMiddleware } from './security/csrf.middleware';

// ===================== v2 Modules =====================
import { LibraryModule } from './library/library.module';
import { HrModule } from './hr/hr.module';
import { ExamsModule } from './exams/exams.module';
import { CertificatesModule } from './certificates/certificates.module';
import { InventoryModule } from './inventory/inventory.module';
import { AuditModule } from './audit/audit.module';
import { AuditInterceptor } from './audit/audit.interceptor';
import { SearchModule } from './search/search.module';
import { DocumentsModule } from './documents/documents.module';
import { DataQualityModule } from './data-quality/data-quality.module';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
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
import { ApiKeysModule } from './api-keys/api-keys.module';
import { BranchesModule } from './branches/branches.module';
import { ReportsModule } from './reports/reports.module';
import { ParentPortalModule } from './parent-portal/parent-portal.module';
import { GamificationModule } from './gamification/gamification.module';
import { ChatModule } from './chat/chat.module';
import { DataGovernanceModule } from './data-governance/data-governance.module';
import { AutomationModule } from './automation/automation.module';
import { PlatformModule } from './platform/platform.module';
import { CronModule } from './cron/cron.module';
import { ObservabilityModule } from './observability/observability.module';
import { PerformanceModule } from './performance/performance.module';
import { PublicMetricsController } from './observability/public-metrics.controller';

import { RootController } from './common/root.controller';
import { ResilientRedisThrottlerStorage } from './common/guards/throttler-redis.storage';
import { isCredentialEndpoint } from './common/guards/is-credential-endpoint';
import { isRedisEnabled, redisQueueConnection } from './config/redis.config';
import type { ExecutionContext } from '@nestjs/common';

// @ts-ignore ï¿½ @nestjs/bullmq is ESM-only; resolved at runtime via monorepo hoisting
const { BullModule } = require('@nestjs/bullmq');

const redisEnabled = isRedisEnabled();

@Module({
  imports: [
    PrometheusModule.register({ controller: PublicMetricsController }),
    ConfigModule.forRoot({ isGlobal: true }),
    NestScheduleModule.forRoot(),
    // Central BullMQ connection for every registerQueue() below.
    // Without forRoot, workers get an unconfigured default connection and
    // silently fail to consume jobs in any non-local environment.
    ...(redisEnabled
      ? [BullModule.forRoot({ connection: redisQueueConnection() })]
      : []),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        // Rate limits are env-tunable so the CI/E2E server can raise the
        // ceiling (THROTTLE_*_LIMIT) instead of the suite tripping 429s —
        // production keeps the hardened defaults below.
        const intEnv = (key: string, fallback: number): number => {
          const raw = config.get<string>(key);
          const parsed = raw === undefined || raw === '' ? Number.NaN : Number(raw);
          return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
        };
        return {
          storage: new ResilientRedisThrottlerStorage(config.get<string>('REDIS_URL') || 'redis://localhost:6379'),
          throttlers: [
            {
              name: 'default',
              ttl: intEnv('THROTTLE_DEFAULT_TTL', 60000),
              limit: intEnv('THROTTLE_DEFAULT_LIMIT', 100),
            },
            {
              /*
               * Second bucket covering ONLY credential endpoints (see
               * `isCredentialEndpoint`). Its `name` is what lets the storage
               * recognize a security-critical bucket and fail closed when
               * Redis is down — with a single `default` throttler that branch
               * was dead code. `skipIf` keeps the extra Redis round-trip off
               * every other route.
               */
              name: 'security',
              ttl: intEnv('THROTTLE_SECURITY_TTL', 60000),
              limit: intEnv('THROTTLE_SECURITY_LIMIT', 10),
              skipIf: (context: ExecutionContext) => !isCredentialEndpoint(context),
            },
          ],
          // Rate-limit authenticated requests per-user (stable account id),
          // falling back to the client IP for anonymous traffic (login/register).
          // This prevents one user behind a shared NAT from exhausting the
          // shared-IP bucket, and prevents anonymous abuse of auth endpoints.
          getTracker: authTracker,
        };
      },
    }),
    PrismaModule,
    RedisPubSubModule,
    AuthModule,
    UsersModule,
    AdminModule,
    StudentsModule,
    TeachersModule,
    CoursesModule,
    SubjectsModule,
    CurriculumModule,
    LessonsModule,
    LearningMaterialsModule,
    AssignmentsModule,
    AssessmentModule,
    ProgressModule,
    CommunicationModule,
    CalendarModule,
    GroupsModule,
    ScheduleModule,
    AttendanceModule,
    PaymentsModule,
    ExpensesModule,
    LeadsModule,
    OrganizationsModule,
    NotificationsModule,
    TelegramModule,
    GradesModule,
    HomeworkModule,
    DashboardModule,
    AnalyticsModule,
    HealthModule,
    FaceModule,
    CameraModule,
    AiModule,

    // v2 Premium Modules
    LibraryModule,
    HrModule,
    ExamsModule,
    CertificatesModule,
    InventoryModule,

    // Platform Expansion Modules
    AuditModule,
    SearchModule,
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
    ApiKeysModule,
    BranchesModule,
    ReportsModule,
    ParentPortalModule,
    GamificationModule,
    ChatModule,
    DataGovernanceModule,
    AutomationModule,
    PlatformModule,
    CronModule,
    ObservabilityModule,
    PerformanceModule,
  ],
  controllers: [RootController],
  providers: [
    // Apply rate limiting to every HTTP endpoint. Per-endpoint overrides use
    // @Throttle({ default: { limit, ttl } }) â€” e.g. auth (login/register) and
    // face capture/attempt endpoints are tightened well below the 100/min
    // default (see auth.controller.ts and face.controller.ts).
    //
    // ORDER MATTERS. ThrottlerGuard must stay first:
    //   1. `rate-limiting.spec.ts` resolves the first APP_GUARD provider.
    //   2. `authTracker` keys anonymous traffic by IP, so brute-force attempts
    //      are counted before we spend a JWT verification on them.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // FAIL-CLOSED AUTHENTICATION. Every HTTP route now requires a valid JWT
    // unless its handler/controller carries `@AllowPublic()` (see
    // auth/public.decorator.ts for the reviewed allow-list). Registering a
    // controller without @UseGuards(...) no longer publishes it.
    { provide: APP_GUARD, useClass: GlobalAuthGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],

})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CsrfMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}




