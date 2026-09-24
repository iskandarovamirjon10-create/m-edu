import { Module } from '@nestjs/common';
import { ParentPortalController } from './parent-portal.controller';
import { ParentPortalService } from './parent-portal.service';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * Parent Portal module (37-Phase Report §17/§28): exposes the DB models that
 * existed but were unreachable (ParentAccount / ParentStudent) through
 * strictly child-scoped read endpoints.
 */
@Module({
  imports: [PrismaModule],
  controllers: [ParentPortalController],
  providers: [ParentPortalService],
  exports: [ParentPortalService],
})
export class ParentPortalModule {}
