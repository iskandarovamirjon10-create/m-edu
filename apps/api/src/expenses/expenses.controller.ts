import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto, UpdateExpenseDto } from '../common/dto';
import { ExpenseQuery } from '../common/dto/query';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';

@ApiTags('Expenses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get()
  @ApiOperation({ summary: 'List all expenses' })
  findAll(@CurrentUser('organizationId') orgId: string, @Query() query: ExpenseQuery) {
    return this.expensesService.findAll(orgId, query);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get expense summary' })
  getSummary(@CurrentUser('organizationId') orgId: string, @Query() query: ExpenseQuery) {
    return this.expensesService.getSummary(orgId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get expense by ID' })
  findOne(@CurrentUser('organizationId') orgId: string, @Param('id') id: string) {
    return this.expensesService.findOne(orgId, id);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Create an expense' })
  create(@CurrentUser('organizationId') orgId: string, @Body() dto: CreateExpenseDto) {
    return this.expensesService.create(orgId, dto);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Update expense' })
  update(@CurrentUser('organizationId') orgId: string, @Param('id') id: string, @Body() dto: UpdateExpenseDto) {
    return this.expensesService.update(orgId, id, dto);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ORG_ADMIN')
  @ApiOperation({ summary: 'Delete expense' })
  remove(@CurrentUser('organizationId') orgId: string, @Param('id') id: string) {
    return this.expensesService.remove(orgId, id);
  }
}
