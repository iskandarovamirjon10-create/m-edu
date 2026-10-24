import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { StudentsModule } from '../students/students.module';
import { TeachersModule } from '../teachers/teachers.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { PaymentsModule } from '../payments/payments.module';
import { ScheduleModule } from '../schedule/schedule.module';
import { AuditModule } from '../audit/audit.module';
import { GroupsModule } from '../groups/groups.module';
import { CoursesModule } from '../courses/courses.module';
import { AcademicRiskModule } from '../academic-risk/academic-risk.module';

import { StudentsService } from '../students/students.service';
import { TeachersService } from '../teachers/teachers.service';
import { AttendanceService } from '../attendance/attendance.service';
import { ScheduleService } from '../schedule/schedule.service';
import { InvoicesService } from '../payments/invoices.service';
import { GroupsService } from '../groups/groups.service';
import { CoursesService } from '../courses/courses.service';

// ── Legacy single-channel adapter (Telegram `/copilot` still depends on
//    `AiService.chat`; removed once Telegram is migrated to the gateway) ────
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

// ── Canonical engine ─────────────────────────────────────────────────────
import { AiWorkspaceController } from './ai-workspace.controller';
import { AiContextService } from './application/context.service';
import { AiPolicyService } from './application/ai-policy.service';
import { ConversationService } from './application/conversation.service';
import { AiActionService } from './application/action.service';
import { ToolOrchestratorService } from './application/tool-orchestrator.service';
import { AiGatewayService } from './application/ai-gateway.service';
import {
  AI_TOOL_DEFINITIONS,
  ToolRegistryService,
} from './tools/registry/tool-registry.service';
import { createAiToolDefinitions } from './tools/registry';
import { AI_PROVIDER } from './infrastructure/providers/ai-provider.interface';
import { GeminiProvider } from './infrastructure/providers/gemini.provider';

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    StudentsModule,
    TeachersModule,
    AttendanceModule,
    PaymentsModule,
    ScheduleModule,
    AuditModule,
    GroupsModule,
    CoursesModule,
    AcademicRiskModule,
  ],
  controllers: [AiController, AiWorkspaceController],
  providers: [
    // Legacy (Telegram)
    AiService,
    // Canonical
    AiContextService,
    AiPolicyService,
    ConversationService,
    AiActionService,
    ToolOrchestratorService,
    AiGatewayService,
    ToolRegistryService,
    GeminiProvider,
    { provide: AI_PROVIDER, useClass: GeminiProvider },
    {
      provide: AI_TOOL_DEFINITIONS,
      useFactory: createAiToolDefinitions,
      inject: [
        StudentsService,
        TeachersService,
        AttendanceService,
        ScheduleService,
        InvoicesService,
        GroupsService,
        CoursesService,
        PrismaService,
      ],
    },
  ],
  exports: [AiService, AiGatewayService],
})
export class AiModule {}
