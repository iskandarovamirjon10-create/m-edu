import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser } from '../../auth/current-user.decorator';
import { ADMIN_ROLES, STAFF_ROLES } from '../../auth/authorization.policy';
import { SmartDiscountService } from './smart-discount.service';
import {
  ApplySiblingGroupDiscountsDto,
  EvaluateStudentDiscountsDto,
} from './dto/smart-discount.dto';

@ApiTags('Smart Discounts & Family Loyalty Engine')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('payments/discounts')
export class SmartDiscountController {
  constructor(private readonly discountService: SmartDiscountService) {}

  @Post('evaluate')
  @Roles(...STAFF_ROLES)
  @ApiOperation({
    summary: 'Evaluate dynamic sibling, merit, multi-course and loyalty discounts for a student',
  })
  async evaluateDiscounts(
    @CurrentUser('organizationId') orgId: string,
    @Body() dto: EvaluateStudentDiscountsDto,
  ) {
    return this.discountService.evaluateDiscounts(orgId, dto);
  }

  @Get('family/:studentId')
  @Roles(...STAFF_ROLES)
  @ApiOperation({
    summary: 'Detect linked sibling network and family members across the organization',
  })
  async getFamilyNetwork(
    @CurrentUser('organizationId') orgId: string,
    @Param('studentId') studentId: string,
  ) {
    return this.discountService.detectSiblingNetwork(orgId, studentId);
  }

  @Post('apply-family')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({
    summary: 'Persist tiered sibling discounts for all children in a family network',
  })
  async applyFamilyDiscounts(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') actorId: string,
    @Body() dto: ApplySiblingGroupDiscountsDto,
  ) {
    return this.discountService.applySiblingDiscounts(orgId, actorId, dto);
  }
}
