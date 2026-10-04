/**
 * Student certificates and certificate templates.
 */

import type { Course } from './academics';
import type { Student } from './students';

export interface CertificateTemplate {
  id: string;
  organizationId: string;
  name: string;
  htmlTemplate: string;
  cssStyles?: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Certificate {
  id: string;
  organizationId: string;
  studentId: string;
  courseId?: string;
  certificateNumber: string;
  title: string;
  description?: string;
  issueDate: string;
  expiryDate?: string;
  verificationCode: string;
  pdfUrl?: string;
  templateId?: string;
  student?: Student;
  course?: Course;
  createdAt: string;
  updatedAt: string;
}
