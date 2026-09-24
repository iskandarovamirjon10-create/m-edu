import { Module } from '@nestjs/common';
import { DataGovernanceController } from './data-governance.controller';
import { DataGovernanceService } from './data-governance.service';

@Module({
  controllers: [DataGovernanceController],
  providers: [DataGovernanceService],
  exports: [DataGovernanceService],
})
export class DataGovernanceModule {}
