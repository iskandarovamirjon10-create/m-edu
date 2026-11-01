import { Module } from '@nestjs/common';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';
import { StudentRetentionController } from './retention/student-retention.controller';
import { StudentRetentionService } from './retention/student-retention.service';
import { PrismaModule } from '../prisma/prisma.module';
import { SecurityModule } from '../security/security.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, SecurityModule, AuditModule],
  controllers: [StudentsController, StudentRetentionController],
  providers: [StudentsService, StudentRetentionService],
  exports: [StudentsService, StudentRetentionService],
})
export class StudentsModule {}
