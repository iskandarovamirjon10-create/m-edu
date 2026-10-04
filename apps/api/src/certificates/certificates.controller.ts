import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
  Res,
  Header,
} from '@nestjs/common';
import { CertificatesService } from './certificates.service';
import { CreateCertificateDto, VerifyCertificateDto } from './dto/certificate.dto';
import {
  CreateCertificateTemplateDto,
  UpdateCertificateTemplateDto,
} from './dto/certificate-template.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { Response } from 'express';
import type { RequestUser } from '../auth/types';
import { AllowAnyRole } from '../auth/roles.decorator';

@Controller('certificates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CertificatesController {
  constructor(private readonly certificatesService: CertificatesService) {}

  // ===================== Certificate Management =====================

  @AllowAnyRole()
  @Get()
  @Roles(Role.ORG_ADMIN, Role.MANAGER, Role.TEACHER)
  async findAllCertificates(@CurrentUser() user: RequestUser) {
    return this.certificatesService.findAllCertificates(user.organizationId);
  }

  // NOTE: static routes MUST be declared before the parameterized `:id`
  // route — NestJS matches controllers routes in declaration order, so a
  // `GET /certificates/templates` would otherwise be captured by `:id` and
  // rejected by ParseUUIDPipe with a 400 before ever reaching its handler.
  @AllowAnyRole()
  @Get('student/:studentId')
  @Roles(Role.ORG_ADMIN, Role.MANAGER, Role.TEACHER, Role.STUDENT)
  async getStudentCertificates(
    @CurrentUser() user: RequestUser,
    @Param('studentId', ParseUUIDPipe) studentId: string,
  ) {
    return this.certificatesService.getStudentCertificates(user.organizationId, studentId, user.sub, user.role);
  }

  @AllowAnyRole()
  @Get('verify/:code')
  async verifyCertificate(@Param('code') code: string) {
    return this.certificatesService.verifyCertificate(code);
  }

  @AllowAnyRole()
  @Get('templates')
  @Roles(Role.ORG_ADMIN, Role.MANAGER)
  async findAllTemplates(@CurrentUser() user: RequestUser) {
    return this.certificatesService.findAllTemplates(user.organizationId);
  }

  @AllowAnyRole()
  @Get(':id')
  @Roles(Role.ORG_ADMIN, Role.MANAGER, Role.TEACHER, Role.STUDENT)
  async findCertificateById(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.certificatesService.findCertificateById(user.organizationId, id, user.sub, user.role);
  }

  @Post('generate')
  @Roles(Role.ORG_ADMIN, Role.MANAGER, Role.TEACHER)
  async generateCertificate(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateCertificateDto,
  ) {
    return this.certificatesService.generateCertificate(user.organizationId, dto);
  }

  @Post(':id/download')
  @Header('Content-Type', 'application/pdf')
  @Roles(Role.ORG_ADMIN, Role.MANAGER, Role.TEACHER)
  async downloadCertificate(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() response: Response,
  ) {
    const pdf = await this.certificatesService.generatePdf(user.organizationId, id);
    response.header('Content-Disposition', `attachment; filename="certificate-${id}.pdf"`);
    response.send(pdf);
  }

  // ===================== Templates =====================

  @AllowAnyRole()
  @Get('templates/:id')
  @Roles(Role.ORG_ADMIN, Role.MANAGER)
  async findTemplateById(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.certificatesService.findTemplateById(user.organizationId, id);
  }

  @Post('templates')
  @Roles(Role.ORG_ADMIN)
  async createTemplate(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateCertificateTemplateDto,
  ) {
    return this.certificatesService.createTemplate(user.organizationId, dto);
  }

  @Put('templates/:id')
  @Roles(Role.ORG_ADMIN)
  async updateTemplate(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCertificateTemplateDto,
  ) {
    return this.certificatesService.updateTemplate(user.organizationId, id, dto);
  }

  @Delete('templates/:id')
  @Roles(Role.ORG_ADMIN)
  async deleteTemplate(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.certificatesService.deleteTemplate(user.organizationId, id);
  }

  @Post('templates/:id/default')
  @Roles(Role.ORG_ADMIN)
  async setDefaultTemplate(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.certificatesService.setDefaultTemplate(user.organizationId, id);
  }
}
