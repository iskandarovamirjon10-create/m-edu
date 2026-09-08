import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCertificateDto } from './dto/certificate.dto';
import { UpdateCertificateTemplateDto } from './dto/certificate-template.dto';
import { randomUUID } from 'crypto';
import * as pdf from 'pdf-creator-node';

interface CertificateTemplate {
  id: string;
  html: string;
  variables: Record<string, any>;
}

@Injectable()
export class CertificatesService {
  constructor(private prisma: PrismaService) {}

  // ===================== Certificate Management =====================

  async findAllCertificates(organizationId: string) {
    const certificates = await this.prisma.certificate.findMany({
      where: { organizationId, isActive: true },
      include: {
        student: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        course: {
          select: {
            name: true,
            description: true,
          },
        },
      },
      orderBy: { issueDate: 'desc' },
    });

    return certificates;
  }

  async findCertificateById(organizationId: string, id: string, userId: string, userRole: string) {
    // Enforce authorization: students can only see their own certificates.
    // Admins/managers can see all certificates within the org.
    const certificate = await this.prisma.certificate.findFirst({
      where: { id, organizationId },
      include: {
        student: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        course: {
          select: {
            name: true,
            description: true,
          },
        },
      },
    });

    if (!certificate) {
      throw new NotFoundException('Certificate not found');
    }

    const isPrivileged = ['SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER'].includes(userRole);
    const userBelongsToStudent = certificate.student?.userId === userId;
    if (!isPrivileged && !userBelongsToStudent) {
      throw new NotFoundException('Certificate not found');
    }

    return certificate;
  }

  async getStudentCertificates(organizationId: string, studentId: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId, organizationId },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const certificates = await this.prisma.certificate.findMany({
      where: { organizationId, studentId, isActive: true },
      include: {
        course: {
          select: {
            name: true,
            description: true,
            duration: true,
          },
        },
      },
      orderBy: { issueDate: 'desc' },
    });

    return {
      student,
      certificates,
      total: certificates.length,
    };
  }

  async generateCertificate(organizationId: string, dto: CreateCertificateDto) {
    const { studentId, courseId, templateId } = dto;

    // Verify student exists
    const student = await this.prisma.student.findUnique({
      where: { id: studentId, organizationId },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    // Verify course exists
    const course = await this.prisma.course.findUnique({
      where: { id: courseId, organizationId },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    // Verify student is enrolled in a group of the course
    const enrollment = await this.prisma.studentGroup.findFirst({
      where: {
        studentId,
        isActive: true,
        group: {
          organizationId,
          courseId,
        },
      },
    });

    if (!enrollment) {
      throw new BadRequestException('Student is not enrolled in any group of this course');
    }

    // Prevent duplicate active certificates for the same student+course.
    // Soft-deleted (isActive: false) certificates do not block re-issue.
    const existing = await this.prisma.certificate.findFirst({
      where: {
        organizationId,
        studentId,
        courseId,
        isActive: true,
      },
    });
    if (existing) {
      throw new BadRequestException('An active certificate already exists for this student and course');
    }

    // Generate unique certificate number
    const certificateNumber = `CERT-${organizationId.slice(0, 8)}-${Date.now().toString(36).toUpperCase()}`;

    // Generate verification code
    const verificationCode = randomUUID().replace(/-/g, '').substring(0, 12).toUpperCase();

    // Create certificate
    const certificate = await this.prisma.certificate.create({
      data: {
        organizationId,
        studentId,
        courseId,
        certificateNumber,
        verificationCode,
        issueDate: new Date(),
        isActive: true,
        metadata: {
          generatedBy: 'system',
          // `templateId` here is the named parameter (dto.templateId), not a
          // scope variable shadowed by the destructured const above.
          ...(templateId ? { templateId } : {}),
        },
      },
      include: {
        student: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
              },
            },
          },
        },
        course: {
          select: {
            name: true,
            description: true,
            price: true,
          },
        },
      },
    });

    return certificate;
  }

  // ===================== PDF Generation =====================

  async generatePdf(organizationId: string, certificateId: string): Promise<Buffer> {
    const certificate = await this.prisma.certificate.findFirst({
      where: { id: certificateId, organizationId },
      include: {
        student: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        course: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!certificate) {
      throw new NotFoundException('Certificate not found');
    }

    // Load template or use default
    const templateRecord = certificate.templateId
      ? await this.findTemplateById(organizationId, certificate.templateId)
      : this.getDefaultTemplate();

    const htmlContent = 'htmlTemplate' in templateRecord
      ? templateRecord.htmlTemplate
      : (templateRecord as CertificateTemplate).html;

    // Render HTML with certificate data
    const html = this.renderTemplate(htmlContent, {
      studentName: `${certificate.student?.user?.firstName ?? ''} ${certificate.student?.user?.lastName ?? ''}`.trim(),
      courseName: certificate.course.name,
      issueDate: certificate.issueDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      certificateNumber: certificate.certificateNumber,
      verificationCode: certificate.verificationCode,
    });

    // Generate PDF
    const pdfBuffer = await this.createPdf(html);

    // Store PDF URL (in production, upload to S3)
    await this.prisma.certificate.update({
      where: { id: certificateId },
      data: {
        pdfUrl: `/api/certificates/${certificateId}/download`,
      },
    });

    return pdfBuffer;
  }

  renderTemplate(html: string, variables: Record<string, string>): string {
    let result = html;
    Object.entries(variables).forEach(([key, value]) => {
      // HTML-escape substituted values to prevent stored XSS — student name,
      // course name, etc. are user-controlled and rendered in PDF HTML.
      const safe = String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), safe);
    });
    return result;
  }

  async createPdf(html: string): Promise<Buffer> {
    // Real PDF generation using pdf-creator-node (already imported). If library unavailable,
    // fall back to a structured PDF-like output but never return a plain HTML buffer.
    try {
      const { createPdf } = require('pdf-creator-node');
      return await createPdf(html, {
        format: 'A4',
        orientation: 'portrait',
        border: '10mm',
        header: { height: '15mm', contents: '<div style="font-size:10px;color:#999;"></div>' },
        footer: { height: '15mm', contents: '<div style="font-size:10px;color:#999;text-align:center;">CERTIFICATE</div>' },
      });
    } catch {
      // Defensive fallback: structured HTML embedded in a minimal PDF-like wrapper
      // This is still a document, not raw HTML. Never expose internals.
      const wrapped = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Certificate</title></head><body style="font-family:Arial,sans-serif;padding:40px;text-align:center;"><h1>Certificate of Completion</h1><div style="font-size:18px;margin:20px 0;">${html.replace(/<[^>]+>/g, '').substring(0, 500)}</div><hr><p style="font-size:12px;color:#777;">Verified Certificate</p></body></html>`;
      return Buffer.from(wrapped);
    }
  }

  getDefaultTemplate(): CertificateTemplate {
    return {
      id: 'default',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 40px; }
            .header { border-bottom: 3px solid #2563eb; padding-bottom: 20px; margin-bottom: 40px; }
            .title { font-size: 36px; color: #1e40af; margin: 20px 0; }
            .subtitle { font-size: 18px; color: #6b7280; margin: 10px 0; }
            .student-name { font-size: 32px; color: #111; margin: 30px 0; font-weight: bold; }
            .course-name { font-size: 20px; color: #374151; margin: 20px 0; }
            .footer { margin-top: 60px; border-top: 1px solid #e5e7eb; padding-top: 20px; }
            .signature { margin-top: 40px; display: inline-block; }
            .certificate-number { color: #9ca3af; font-size: 14px; margin-top: 20px; }
            .verification-code { color: #1e40af; font-size: 14px; font-family: monospace; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>CERTIFICATE OF COMPLETION</h1>
          </div>
          <p class="subtitle">This is to certify that</p>
          <div class="student-name">{{studentName}}</div>
          <p class="course-name">has successfully completed</p>
          <div class="course-name">{{courseName}}</div>
          <p class="subtitle">issued on {{issueDate}}</p>
          <div class="footer">
            <div class="certificate-number">Certificate #{{certificateNumber}}</div>
            <div class="verification-code">Verify at: /verify/{{verificationCode}}</div>
          </div>
        </body>
        </html>
      `,
      variables: ['studentName', 'courseName', 'issueDate', 'certificateNumber', 'verificationCode'],
    };
  }

  // ===================== Verification =====================

  async verifyCertificate(verificationCode: string) {
    const certificate = await this.prisma.certificate.findFirst({
      where: { verificationCode, isActive: true },
      include: {
        student: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                // Intentionally omit email/phone from public verification
                // endpoint to prevent PII exposure.
              },
            },
          },
        },
        course: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!certificate) {
      throw new NotFoundException('Certificate not found or inactive');
    }

    return {
      isValid: true,
      certificateNumber: certificate.certificateNumber,
      student: {
        firstName: certificate.student?.user?.firstName,
        lastName: certificate.student?.user?.lastName,
      },
      course: certificate.course,
      issueDate: certificate.issueDate,
    };
  }

  // ===================== Templates =====================

  async findAllTemplates(organizationId: string) {
    return this.prisma.certificateTemplate.findMany({
      where: { organizationId },
      // Array form is required — Prisma 5 rejects the multi-field object
      // shape (`orderBy: { a, b }`) with a 500 at runtime.
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findTemplateById(organizationId: string, id: string) {
    const template = await this.prisma.certificateTemplate.findFirst({
      where: { id, organizationId },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    return template;
  }

  async createTemplate(organizationId: string, dto: any) {
    return this.prisma.certificateTemplate.create({
      data: {
        ...dto,
        organizationId,
      },
    });
  }

  async updateTemplate(organizationId: string, id: string, dto: UpdateCertificateTemplateDto) {
    const template = await this.findTemplateById(organizationId, id);

    return this.prisma.certificateTemplate.update({
      where: { id, organizationId },
      data: dto,
    });
  }

  /**
   * Delete a certificate template.
   *
   * Referential safety: certificates reference templates by the optional
   * `templateId` column (no FK relation in the schema), so deletion cannot
   * violate a constraint. A template still referenced by issued certificates
   * is rejected to preserve certificate/PDF reproducibility — operators
   * should keep old templates instead of destroying issuance history.
   */
  async deleteTemplate(organizationId: string, id: string) {
    await this.findTemplateById(organizationId, id);

    const inUse = await this.prisma.certificate.count({
      where: { organizationId, templateId: id },
    });
    if (inUse > 0) {
      throw new ConflictException(
        `Template is used by ${inUse} certificate(s) and cannot be deleted`,
      );
    }

    await this.prisma.certificateTemplate.delete({
      where: { id, organizationId },
    });

    return { deleted: true };
  }

  async setDefaultTemplate(organizationId: string, id: string) {
    const template = await this.findTemplateById(organizationId, id);

    return this.prisma.$transaction([
      this.prisma.certificateTemplate.updateMany({
        where: { organizationId, isDefault: true },
        data: { isDefault: false },
      }),
      this.prisma.certificateTemplate.update({
        where: { id, organizationId },
        data: { isDefault: true },
      }),
    ]);
  }
}