import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCertificateDto } from './dto/certificate.dto';
import { CreateCertificateTemplateDto, UpdateCertificateTemplateDto } from './dto/certificate-template.dto';
import { randomUUID, randomBytes } from 'crypto';

interface CertificateTemplate {
  id: string;
  html: string;
  variables: string[] | Record<string, unknown>;
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

    const isPrivileged = ['SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER', 'TEACHER'].includes(userRole);
    const userBelongsToStudent = certificate.student?.userId === userId;
    if (!isPrivileged && !userBelongsToStudent) {
      throw new NotFoundException('Certificate not found');
    }

    return certificate;
  }

  async getStudentCertificates(organizationId: string, studentId: string, userId: string, userRole: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId, organizationId },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const isPrivileged = ['SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER', 'TEACHER'].includes(userRole);
    if (!isPrivileged && student.userId !== userId) {
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

    // Transaction with pessimistic lock to prevent TOCTOU duplicate certificates
    return this.prisma.$transaction(async (tx) => {
      // Serialize on the student row to prevent concurrent certificate creation
      await tx.$queryRaw`SELECT id FROM "Student" WHERE id = ${studentId}::uuid FOR UPDATE`;

      // Prevent duplicate active certificates for the same student+course.
      // Soft-deleted (isActive: false) certificates do not block re-issue.
      const existing = await tx.certificate.findFirst({
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

      // Resolve template: use dto.templateId if specified and valid; otherwise use default template
      let resolvedTemplateId: string | null = null;
      if (templateId) {
        const customTpl = await tx.certificateTemplate.findFirst({
          where: { id: templateId, organizationId },
        });
        if (customTpl) {
          resolvedTemplateId = customTpl.id;
        }
      } else {
        const defaultTpl = await tx.certificateTemplate.findFirst({
          where: { organizationId, isDefault: true },
        });
        if (defaultTpl) {
          resolvedTemplateId = defaultTpl.id;
        }
      }

      // Generate certificate with cryptographic entropy and bounded retry on collision (P2002)
      const MAX_RETRIES = 3;
      let certificate;
      let attempt = 0;

      while (attempt < MAX_RETRIES) {
        attempt++;
        // Generate unique certificate number with high-entropy random suffix
        const randomSuffix = randomBytes(3).toString('hex').toUpperCase();
        const certificateNumber = `CERT-${organizationId.slice(0, 8)}-${Date.now().toString(36).toUpperCase()}-${randomSuffix}`;

        // Generate verification code
        const verificationCode = randomUUID().replace(/-/g, '').substring(0, 12).toUpperCase();

        // Check if certificateNumber already exists in this organization
        const duplicateCert = await tx.certificate.findFirst({
          where: { organizationId, certificateNumber },
        });
        if (duplicateCert) {
          if (attempt < MAX_RETRIES) {
            continue; // retry with fresh random suffix
          }
          throw new BadRequestException('Certificate number already exists in this organization');
        }

        try {
          certificate = await tx.certificate.create({
            data: {
              organizationId,
              studentId,
              courseId,
              certificateNumber,
              verificationCode,
              issueDate: new Date(),
              isActive: true,
              templateId: resolvedTemplateId,
              metadata: {
                generatedBy: 'system',
                ...(resolvedTemplateId ? { templateId: resolvedTemplateId } : {}),
                ...(dto.notes ? { notes: dto.notes } : {}),
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

          break; // Success!
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            const target = Array.isArray(error.meta?.target)
              ? error.meta.target.join(',')
              : String(error.meta?.target || '');

            const isCertCollision =
              target.includes('certificateNumber') ||
              target.includes('Certificate_organizationId_certificateNumber_key');
            const isVerificationCollision =
              target.includes('verificationCode') ||
              target.includes('Certificate_verificationCode_key');

            if ((isCertCollision || isVerificationCollision) && attempt < MAX_RETRIES) {
              // Retry with fresh numbers
              continue;
            }

            if (isCertCollision) {
              throw new BadRequestException('Certificate number already exists in this organization');
            }
            if (isVerificationCollision) {
              throw new BadRequestException('Certificate verification code collision. Please retry.');
            }
            throw new BadRequestException(`Certificate unique constraint violation: ${target}`);
          }
          throw error;
        }
      }

      return certificate;
    });
  }

  // ===================== PDF Generation =====================

  async generatePdf(organizationId: string, certificateId: string): Promise<Buffer> {
    const certificate = await this.prisma.certificate.findFirst({
      where: { id: certificateId, organizationId },
      include: {
        organization: {
          select: {
            name: true,
          },
        },
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

    const studentName = `${certificate.student?.user?.firstName ?? ''} ${certificate.student?.user?.lastName ?? ''}`.trim() || 'Student';
    const courseName = certificate.course?.name || 'Academic Course';
    const organizationName = certificate.organization?.name || 'M-EDU Global Academy';
    const issueDate = certificate.issueDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const certificateNumber = certificate.certificateNumber;
    const verificationCode = certificate.verificationCode;
    const verificationUrl = `https://m-edu.uz/verify/${verificationCode}`;

    // Load template or use default
    const templateRecord = certificate.templateId
      ? ((await this.findTemplateById(organizationId, certificate.templateId).catch(() => null)) ?? this.getDefaultTemplate())
      : this.getDefaultTemplate();

    const htmlContent = 'htmlTemplate' in templateRecord
      ? templateRecord.htmlTemplate
      : (templateRecord as CertificateTemplate).html;

    // Render HTML with certificate data
    const html = this.renderTemplate(htmlContent, {
      studentName,
      courseName,
      issueDate,
      certificateNumber,
      verificationCode,
    });

    // Generate Apple-grade landscape PDF
    const pdfBuffer = await this.createPdf(html, {
      organizationName,
      studentName,
      courseName,
      issueDate,
      certificateNumber,
      verificationCode,
      verificationUrl,
    });

    // Store PDF URL
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

  async createPdf(
    html: string,
    meta?: {
      organizationName?: string;
      studentName?: string;
      courseName?: string;
      issueDate?: string;
      certificateNumber?: string;
      verificationCode?: string;
      verificationUrl?: string;
    },
  ): Promise<Buffer> {
    const pdfmakeRaw = await import('pdfmake');
    const pdfmake = (pdfmakeRaw.default || pdfmakeRaw) as {
      setLocalAccessPolicy: (cb: () => boolean) => void;
      setUrlAccessPolicy: (cb: () => boolean) => void;
      setFonts: (fonts: unknown) => void;
      createPdf: (docDefinition: unknown) => { getBuffer: () => Promise<Uint8Array> };
    };
    pdfmake.setLocalAccessPolicy(() => true);
    pdfmake.setUrlAccessPolicy(() => false);
    pdfmake.setFonts({
      NotoSans: {
        normal: require('path').join(__dirname, '..', 'assets', 'fonts', 'NotoSans-Regular.ttf'),
        bold: require('path').join(__dirname, '..', 'assets', 'fonts', 'NotoSans-Bold.ttf'),
        italics: require('path').join(__dirname, '..', 'assets', 'fonts', 'NotoSans-Regular.ttf'),
        bolditalics: require('path').join(__dirname, '..', 'assets', 'fonts', 'NotoSans-Bold.ttf'),
      },
    });

    const studentName = meta?.studentName ?? 'Honored Student';
    const courseName = meta?.courseName ?? 'Academic Mastery Course';
    const organizationName = meta?.organizationName ?? 'M-EDU Global Academy';
    const issueDate = meta?.issueDate ?? new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const certificateNumber = meta?.certificateNumber ?? 'CERT-0000-0000';
    const verificationCode = meta?.verificationCode ?? 'MEDU-VERIFY';
    const verificationUrl = meta?.verificationUrl ?? `https://m-edu.uz/verify/${verificationCode}`;

    const docDefinition = {
      pageSize: 'A4',
      pageOrientation: 'landscape',
      pageMargins: [36, 32, 36, 32],
      content: [
        {
          table: {
            widths: ['*'],
            body: [
              [
                {
                  stack: [
                    {
                      text: organizationName.toUpperCase(),
                      style: 'orgHeader',
                    },
                    {
                      text: 'CERTIFICATE OF ACHIEVEMENT',
                      style: 'mainTitle',
                    },
                    {
                      text: 'THIS IS PROUDLY PRESENTED TO',
                      style: 'subtitlePre',
                    },
                    {
                      text: studentName,
                      style: 'studentName',
                    },
                    {
                      canvas: [
                        {
                          type: 'line',
                          x1: 180,
                          y1: 0,
                          x2: 520,
                          y2: 0,
                          lineWidth: 1.5,
                          lineColor: '#C5A059',
                        },
                      ],
                      margin: [0, 6, 0, 14],
                    },
                    {
                      text: 'for successfully completing all requirements and demonstrating excellence in',
                      style: 'completionText',
                    },
                    {
                      text: courseName,
                      style: 'courseName',
                    },
                    {
                      columns: [
                        {
                          width: '35%',
                          stack: [
                            { text: `ISSUED: ${issueDate}`, style: 'metaText' },
                            { text: `CERTIFICATE NO: ${certificateNumber}`, style: 'metaTextBold' },
                            { text: `SECURITY HASH: ${verificationCode}`, style: 'metaTextHash' },
                          ],
                          alignment: 'left',
                          margin: [20, 22, 0, 0],
                        },
                        {
                          width: '30%',
                          stack: [
                            {
                              qr: verificationUrl,
                              fit: 52,
                              alignment: 'center',
                            },
                            {
                              text: '★ OFFICIAL ACCREDITED ★',
                              style: 'sealText',
                            },
                          ],
                          alignment: 'center',
                          margin: [0, 8, 0, 0],
                        },
                        {
                          width: '35%',
                          stack: [
                            {
                              text: 'Academic Directorate',
                              style: 'signatureScript',
                            },
                            {
                              canvas: [
                                {
                                  type: 'line',
                                  x1: 20,
                                  y1: 0,
                                  x2: 200,
                                  y2: 0,
                                  lineWidth: 1,
                                  lineColor: '#94A3B8',
                                },
                              ],
                              margin: [0, 2, 0, 4],
                            },
                            { text: 'AUTHORIZED SIGNATURE', style: 'sigLabel' },
                            { text: 'M-EDU Global Academic Accreditation', style: 'sigSub' },
                          ],
                          alignment: 'right',
                          margin: [0, 16, 20, 0],
                        },
                      ],
                    },
                  ],
                  fillColor: '#FFFFFF',
                  margin: [16, 18, 16, 18],
                },
              ],
            ],
          },
          layout: {
            hLineWidth: () => 2.5,
            vLineWidth: () => 2.5,
            hLineColor: () => '#C5A059',
            vLineColor: () => '#C5A059',
            paddingLeft: () => 14,
            paddingRight: () => 14,
            paddingTop: () => 14,
            paddingBottom: () => 14,
          },
        },
      ],
      styles: {
        orgHeader: {
          fontSize: 11,
          bold: true,
          color: '#C5A059',
          characterSpacing: 3,
          alignment: 'center',
          margin: [0, 0, 0, 6],
        },
        mainTitle: {
          fontSize: 25,
          bold: true,
          color: '#0A192F',
          characterSpacing: 2,
          alignment: 'center',
          margin: [0, 0, 0, 10],
        },
        subtitlePre: {
          fontSize: 9.5,
          color: '#64748B',
          characterSpacing: 1.5,
          alignment: 'center',
          margin: [0, 0, 0, 8],
        },
        studentName: {
          fontSize: 26,
          bold: true,
          color: '#0A192F',
          alignment: 'center',
          margin: [0, 0, 0, 2],
        },
        completionText: {
          fontSize: 10.5,
          color: '#475569',
          alignment: 'center',
          margin: [0, 0, 0, 6],
        },
        courseName: {
          fontSize: 18,
          bold: true,
          color: '#007AFF',
          alignment: 'center',
          margin: [0, 0, 0, 8],
        },
        metaText: {
          fontSize: 8,
          color: '#64748B',
          margin: [0, 0, 0, 2],
        },
        metaTextBold: {
          fontSize: 8,
          bold: true,
          color: '#1E293B',
          margin: [0, 0, 0, 2],
        },
        metaTextHash: {
          fontSize: 7.5,
          color: '#007AFF',
        },
        sealText: {
          fontSize: 7,
          bold: true,
          color: '#C5A059',
          characterSpacing: 1,
          alignment: 'center',
          margin: [0, 4, 0, 0],
        },
        signatureScript: {
          fontSize: 13,
          bold: true,
          color: '#0A192F',
          alignment: 'center',
          margin: [0, 0, 0, 4],
        },
        sigLabel: {
          fontSize: 7.5,
          bold: true,
          color: '#475569',
          characterSpacing: 1,
          alignment: 'center',
          margin: [0, 0, 0, 2],
        },
        sigSub: {
          fontSize: 7,
          color: '#94A3B8',
          alignment: 'center',
        },
      },
      defaultStyle: { font: 'NotoSans', fontSize: 10 },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doc = pdfmake.createPdf(docDefinition as any);
    return Buffer.from(await doc.getBuffer());
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

  async createTemplate(organizationId: string, dto: CreateCertificateTemplateDto) {
    return this.prisma.certificateTemplate.create({
      data: {
        ...dto,
        organizationId,
      },
    });
  }

  async updateTemplate(organizationId: string, id: string, dto: UpdateCertificateTemplateDto) {
    await this.findTemplateById(organizationId, id);

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
    await this.findTemplateById(organizationId, id);

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
