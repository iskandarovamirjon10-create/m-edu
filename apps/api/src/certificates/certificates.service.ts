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
    const student = await this.prisma.student.findFirst({ where: { id: studentId, organizationId } });

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
    const student = await this.prisma.student.findFirst({ where: { id: studentId, organizationId } });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    // Verify course exists
    const course = await this.prisma.course.findFirst({ where: { id: courseId, organizationId } });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    // Verify student is enrolled in a group of the course (either active or completed)
    const enrollment = await this.prisma.studentGroup.findFirst({
      where: {
        studentId,
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
      // Using replaceAll avoids dynamic regex compilation and immune to ReDoS or special regex chars in key
      result = result.replaceAll(`{{${key}}}`, safe);
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
        <html lang="uz">
        <head>
          <meta charset="UTF-8">
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              background: #0B0E14;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              padding: 30px;
              color: #1A1F2C;
            }
            .cert-frame {
              width: 100%;
              max-width: 960px;
              background: linear-gradient(135deg, #FAF8F5 0%, #FFFFFF 50%, #F5F1EB 100%);
              border-radius: 24px;
              padding: 14px;
              position: relative;
              box-shadow: 0 32px 80px -20px rgba(0,0,0,0.5), 0 0 0 1px rgba(197, 160, 89, 0.4);
            }
            .cert-border-outer {
              border: 3px double #C5A059;
              border-radius: 18px;
              padding: 40px 48px;
              position: relative;
              background: radial-gradient(circle at 50% 50%, rgba(255,255,255,0.95) 0%, rgba(250,248,245,0.98) 100%);
            }
            .cert-guilloche-corner {
              position: absolute;
              width: 44px;
              height: 44px;
            }
            .top-left { top: 12px; left: 12px; border-top: 3px solid #C5A059; border-left: 3px solid #C5A059; }
            .top-right { top: 12px; right: 12px; border-top: 3px solid #C5A059; border-right: 3px solid #C5A059; }
            .bottom-left { bottom: 12px; left: 12px; border-bottom: 3px solid #C5A059; border-left: 3px solid #C5A059; }
            .bottom-right { bottom: 12px; right: 12px; border-bottom: 3px solid #C5A059; border-right: 3px solid #C5A059; }
            .cert-header { text-align: center; }
            .academy-name {
              font-size: 13px;
              letter-spacing: 0.35em;
              color: #9A7B38;
              font-weight: 700;
              text-transform: uppercase;
              margin-bottom: 8px;
            }
            .cert-title {
              font-size: 32px;
              font-weight: 800;
              letter-spacing: 0.06em;
              color: #0A192F;
              margin-bottom: 8px;
              text-transform: uppercase;
            }
            .cert-subtitle {
              font-size: 12px;
              font-weight: 600;
              color: #64748B;
              letter-spacing: 0.15em;
              text-transform: uppercase;
            }
            .student-block {
              text-align: center;
              margin: 32px 0 20px;
            }
            .student-prefix {
              font-size: 13px;
              color: #64748B;
              font-weight: 500;
              margin-bottom: 10px;
            }
            .student-name {
              font-size: 38px;
              font-weight: 800;
              color: #0A192F;
              letter-spacing: -0.01em;
              margin-bottom: 12px;
            }
            .gold-divider {
              height: 2px;
              width: 240px;
              background: linear-gradient(90deg, transparent, #C5A059, transparent);
              margin: 0 auto;
            }
            .course-block {
              text-align: center;
              margin-bottom: 32px;
            }
            .course-prefix {
              font-size: 13px;
              color: #64748B;
              margin-bottom: 6px;
            }
            .course-name {
              font-size: 22px;
              font-weight: 700;
              color: #007AFF;
              letter-spacing: -0.01em;
            }
            .cert-footer {
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
              border-top: 1px solid rgba(197, 160, 89, 0.35);
              padding-top: 24px;
              margin-top: 24px;
            }
            .signature-box { text-align: left; }
            .signature-title {
              font-style: italic;
              font-size: 18px;
              color: #0A192F;
              font-weight: 600;
            }
            .signature-line {
              width: 140px;
              height: 1px;
              background: #C5A059;
              margin: 6px 0;
            }
            .signature-sub {
              font-size: 10px;
              font-weight: 700;
              letter-spacing: 0.1em;
              color: #94A3B8;
              text-transform: uppercase;
            }
            .seal-box {
              text-align: center;
            }
            .gold-seal {
              width: 58px;
              height: 58px;
              border-radius: 50%;
              background: radial-gradient(circle, #FCF6BA 0%, #BF953F 60%, #AA771C 100%);
              display: inline-flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 4px 16px rgba(191,149,63,0.4);
              color: #0A192F;
              font-weight: 800;
              font-size: 18px;
              border: 2px solid #FFF;
            }
            .seal-label {
              font-size: 9px;
              font-weight: 700;
              color: #9A7B38;
              letter-spacing: 0.12em;
              margin-top: 6px;
              text-transform: uppercase;
            }
            .meta-box {
              text-align: right;
              font-size: 11px;
              color: #64748B;
            }
            .cert-id-tag {
              font-family: monospace;
              font-weight: 700;
              color: #007AFF;
              background: rgba(0,122,255,0.08);
              padding: 3px 8px;
              border-radius: 6px;
              display: inline-block;
              margin-bottom: 4px;
            }
          </style>
        </head>
        <body>
          <div class="cert-frame">
            <div class="cert-border-outer">
              <div class="cert-guilloche-corner top-left"></div>
              <div class="cert-guilloche-corner top-right"></div>
              <div class="cert-guilloche-corner bottom-left"></div>
              <div class="cert-guilloche-corner bottom-right"></div>
              <div class="cert-header">
                <div class="academy-name">M-EDU RASMIY AKADEMIYASI</div>
                <div class="cert-title">MALAKA VA NATIJALAR SERTIFIKATI</div>
                <div class="cert-subtitle">Rasmiy tasdiqlangan ta'lim hujjati</div>
              </div>
              <div class="student-block">
                <div class="student-prefix">Mazkur maxsus sertifikat faxr bilan taqdim etiladi:</div>
                <div class="student-name">{{studentName}}</div>
                <div class="gold-divider"></div>
              </div>
              <div class="course-block">
                <div class="course-prefix">Quyidagi kasbiy ta'lim dasturini a'lo baholar bilan muvaffaqiyatli tamomlaganligi uchun:</div>
                <div class="course-name">{{courseName}}</div>
              </div>
              <div class="cert-footer">
                <div class="signature-box">
                  <div class="signature-title">Bosh Direktor</div>
                  <div class="signature-line"></div>
                  <div class="signature-sub">Akademiya Rahbariyati</div>
                </div>
                <div class="seal-box">
                  <div class="gold-seal">★</div>
                  <div class="seal-label">Rasmiy Tasdiqlangan</div>
                </div>
                <div class="meta-box">
                  <div><span class="cert-id-tag">ID: {{certificateNumber}}</span></div>
                  <div>Berilgan sana: <strong>{{issueDate}}</strong></div>
                  <div style="font-family: monospace; font-size: 10px; margin-top: 3px;">Kodi: {{verificationCode}}</div>
                </div>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
      variables: ['studentName', 'courseName', 'issueDate', 'certificateNumber', 'verificationCode'],
    };
  }

  // ===================== Verification =====================

  async verifyCertificate(codeOrNumber: string) {
    const cleanCode = (codeOrNumber || '').trim();
    if (!cleanCode) {
      throw new NotFoundException('Verification code is required');
    }

    const certificate = await this.prisma.certificate.findFirst({
      where: {
        OR: [
          { verificationCode: cleanCode.toUpperCase() },
          { certificateNumber: { equals: cleanCode, mode: 'insensitive' } },
        ],
        isActive: true,
      },
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
            description: true,
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
      verificationCode: certificate.verificationCode,
      organizationName: certificate.organization?.name || 'M-EDU Global Academy',
      student: {
        firstName: certificate.student?.user?.firstName,
        lastName: certificate.student?.user?.lastName,
      },
      course: {
        name: certificate.course?.name || 'Kasbiy Kurs',
        description: certificate.course?.description,
      },
      issueDate: certificate.issueDate,
      directorName: (certificate.metadata as any)?.directorName || 'Markaz Rahbari',
      instructorName: (certificate.metadata as any)?.instructorName || "Katta O'qituvchi",
      grade: (certificate.metadata as any)?.grade || "A+ (A'lo)",
      metadata: certificate.metadata,
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
      where: { id, organizationId } as any,
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
      where: { id, organizationId } as any,
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
      typeof this.prisma.certificateTemplate.updateMany === 'function'
        ? this.prisma.certificateTemplate.updateMany({
            where: { id, organizationId },
            data: { isDefault: true },
          })
        : this.prisma.certificateTemplate.update({
            where: { id, organizationId },
            data: { isDefault: true },
          }),
    ]);
  }
}
