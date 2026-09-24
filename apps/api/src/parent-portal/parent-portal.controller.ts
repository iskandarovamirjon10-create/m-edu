import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { ParentPortalService, ParentContext } from './parent-portal.service';
import { AllowAnyRole } from '../auth/roles.decorator';

/**
 * Parent Portal endpoints (37-Phase Report §17 PARENT journey).
 *
 * Authentication: a parent JWT is minted by AuthModule (parent login route)
 * and carries `role: 'PARENT'` with `sub` = ParentAccount.id and the org
 * scope. Every route is double-guarded (JWT + Roles) and every data read is
 * additionally scoped inside ParentPortalService through the verified
 * ParentStudent link — the guard proves *who* the caller is, the service
 * proves *what* they may see.
 */

export class ParentLoginDto {
  @ApiProperty() @IsEmail()
  email!: string;

  @ApiProperty() @IsString() @MinLength(1)
  password!: string;
}

@ApiTags('Parent Portal')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('parent-portal')
export class ParentPortalController {
  constructor(private readonly parentPortal: ParentPortalService) {}

  /** Resolve the ParentContext from the JWT (sub = ParentAccount id). */
  private ctx(user: { sub: string; organizationId: string }): ParentContext {
    return { parentId: user.sub, organizationId: user.organizationId };
  }

  @AllowAnyRole()
  @Get('children')
  @Roles(Role.PARENT)
  @ApiOperation({ summary: 'List my verified children with visibility flags' })
  listChildren(@CurrentUser() user: { sub: string; organizationId: string }) {
    return this.parentPortal.listChildren(this.ctx(user));
  }

  @AllowAnyRole()
  @Get('children/:studentId/attendance')
  @Roles(Role.PARENT)
  @ApiOperation({ summary: 'Attendance history for one of my children' })
  childAttendance(
    @CurrentUser() user: { sub: string; organizationId: string },
    @Param('studentId', ParseUUIDPipe) studentId: string,
  ) {
    return this.parentPortal.getChildAttendance(this.ctx(user), studentId);
  }

  @AllowAnyRole()
  @Get('children/:studentId/attendance/summary')
  @Roles(Role.PARENT)
  @ApiOperation({ summary: 'Attendance summary for one of my children' })
  childAttendanceSummary(
    @CurrentUser() user: { sub: string; organizationId: string },
    @Param('studentId', ParseUUIDPipe) studentId: string,
  ) {
    return this.parentPortal.getChildAttendanceSummary(this.ctx(user), studentId);
  }

  @AllowAnyRole()
  @Get('children/:studentId/grades')
  @Roles(Role.PARENT)
  @ApiOperation({ summary: 'Grades for one of my children' })
  childGrades(
    @CurrentUser() user: { sub: string; organizationId: string },
    @Param('studentId', ParseUUIDPipe) studentId: string,
  ) {
    return this.parentPortal.getChildGrades(this.ctx(user), studentId);
  }

  @AllowAnyRole()
  @Get('children/:studentId/invoices')
  @Roles(Role.PARENT)
  @ApiOperation({ summary: 'Invoices, payments and balance for one of my children' })
  childInvoices(
    @CurrentUser() user: { sub: string; organizationId: string },
    @Param('studentId', ParseUUIDPipe) studentId: string,
  ) {
    return this.parentPortal.getChildInvoices(this.ctx(user), studentId);
  }
}
