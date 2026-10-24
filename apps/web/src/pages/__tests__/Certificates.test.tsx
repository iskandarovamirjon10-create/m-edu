/**
 * Comprehensive Vitest Suite for CertificatesPage (Apple 10/10 visionOS Edition)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  CertificatesPage,
  nameHash,
  avatarGradient,
  getInitials,
  formatStudentName,
  validateCertificateForm,
  validateTemplateForm,
  computeCertificateStats,
  type CertificateFormState,
  type TemplateFormState,
} from '../Certificates';
import {
  certificatesApi,
  coursesApi,
  studentsApi,
  downloadFile,
} from '@/lib/api';
import { openSidecar } from '@/stores/ui.store';
import type { Certificate, CertificateTemplate } from '@/lib/types';

/* --------------------------------------------------------------------------
 * MOCKS
 * ------------------------------------------------------------------------ */

vi.mock('@/lib/api', () => ({
  certificatesApi: {
    list: vi.fn(),
    listTemplates: vi.fn(),
    generate: vi.fn(),
    createTemplate: vi.fn(),
    updateTemplate: vi.fn(),
    setDefaultTemplate: vi.fn(),
    removeTemplate: vi.fn(),
  },
  coursesApi: {
    list: vi.fn(),
  },
  studentsApi: {
    list: vi.fn(),
  },
  downloadFile: vi.fn(),
}));

vi.mock('@/stores/ui.store', () => ({
  openSidecar: vi.fn(),
}));

vi.mock('@/hooks/usePageTitle', () => ({
  usePageTitle: vi.fn(),
}));

vi.mock('@/hooks/usePremiumSound', () => ({
  usePremiumSound: () => ({
    playTick: vi.fn(),
    playPop: vi.fn(),
    playSuccess: vi.fn(),
    playError: vi.fn(),
  }),
}));

vi.mock('@/i18n/I18nProvider', () => ({
  useSafeI18n: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
    locale: 'uz',
  }),
}));

vi.mock('@/components/certificates/TiltCertificate', () => ({
  TiltCertificate: ({ data }: { data: any }) => (
    <div data-testid="tilt-certificate">
      <span>{data.certificateNumber}</span>
      <span>{data.student?.name}</span>
    </div>
  ),
}));

vi.mock('@/components/pdf-studio', () => ({
  ExecutivePDFStudio: ({ open }: { open: boolean }) =>
    open ? <div data-testid="executive-pdf-studio">Studio Open</div> : null,
}));

/* --------------------------------------------------------------------------
 * FIXTURES
 * ------------------------------------------------------------------------ */

const mockStudents = {
  items: [
    {
      id: 'stu-1',
      user: { firstName: 'Ali', lastName: 'Valiyev' },
    },
    {
      id: 'stu-2',
      user: { firstName: 'Zarina', lastName: 'Karimova' },
    },
  ],
};

const mockCourses = {
  items: [
    { id: 'course-1', name: 'Frontend React & Next.js' },
    { id: 'course-2', name: 'Python Backend & Django' },
  ],
};

const mockCertificates: Certificate[] = [
  {
    id: 'cert-1',
    organizationId: 'org-1',
    studentId: 'stu-1',
    courseId: 'course-1',
    certificateNumber: 'MEDU-2026-001',
    title: 'Frontend React Sertifikati',
    issueDate: new Date().toISOString(),
    verificationCode: 'VRF-998877',
    course: { id: 'course-1', name: 'Frontend React & Next.js' } as any,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'cert-2',
    organizationId: 'org-1',
    studentId: 'stu-2',
    courseId: 'course-2',
    certificateNumber: 'MEDU-2026-002',
    title: 'Python Backend Sertifikati',
    issueDate: '2025-01-15T00:00:00.000Z',
    verificationCode: 'VRF-112233',
    course: { id: 'course-2', name: 'Python Backend & Django' } as any,
    createdAt: '2025-01-15T00:00:00.000Z',
    updatedAt: '2025-01-15T00:00:00.000Z',
  },
];

const mockTemplates: CertificateTemplate[] = [
  {
    id: 'tpl-1',
    organizationId: 'org-1',
    name: 'Oltin Premium Shablon',
    htmlTemplate: '<div class="cert">{{studentName}}</div>',
    cssStyles: '.cert { color: gold; }',
    isDefault: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tpl-2',
    organizationId: 'org-1',
    name: 'Zamonaviy Minimalist',
    htmlTemplate: '<div>{{courseName}}</div>',
    cssStyles: '',
    isDefault: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

function renderWithClient() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <CertificatesPage />
    </QueryClientProvider>,
  );
}

/* --------------------------------------------------------------------------
 * TESTS
 * ------------------------------------------------------------------------ */

describe('CertificatesPage (Apple 10/10 visionOS Edition)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (studentsApi.list as any).mockResolvedValue(mockStudents);
    (coursesApi.list as any).mockResolvedValue(mockCourses);
    (certificatesApi.list as any).mockResolvedValue(mockCertificates);
    (certificatesApi.listTemplates as any).mockResolvedValue(mockTemplates);
    (certificatesApi.generate as any).mockResolvedValue({ id: 'cert-new' });
    (certificatesApi.setDefaultTemplate as any).mockResolvedValue({});
    (certificatesApi.createTemplate as any).mockResolvedValue({ id: 'tpl-new' });
    (certificatesApi.removeTemplate as any).mockResolvedValue({});
    (downloadFile as any).mockResolvedValue(undefined);

    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn() },
      writable: true,
      configurable: true,
    });
  });

  /* --------------------------------------------------------------------------
   * 1. PURE DOMAIN HELPERS
   * ------------------------------------------------------------------------ */
  describe('Pure Domain Helpers', () => {
    it('nameHash produces deterministic non-negative numbers', () => {
      const h1 = nameHash('Ali Valiyev');
      const h2 = nameHash('Ali Valiyev');
      expect(h1).toBe(h2);
      expect(h1).toBeGreaterThanOrEqual(0);
      expect(nameHash('')).toBe(0);
    });

    it('avatarGradient generates a CSS gradient string', () => {
      const grad = avatarGradient('Ali Valiyev');
      expect(grad).toMatch(/^linear-gradient\(135deg, #[0-9A-Fa-f]{6} 0%, #[0-9A-Fa-f]{6} 100%\)$/);
    });

    it('getInitials extracts initials or fallback', () => {
      expect(getInitials('Ali Valiyev')).toBe('AV');
      expect(getInitials('Zarina')).toBe('Z');
      expect(getInitials('')).toBe('—');
      expect(getInitials(null)).toBe('—');
    });

    it('formatStudentName safely formats student name', () => {
      expect(formatStudentName(mockStudents.items[0] as any)).toBe('Ali Valiyev');
      expect(formatStudentName(undefined)).toBe('—');
      expect(formatStudentName({ id: 'x' } as any)).toBe('—');
    });

    it('validateCertificateForm validates required studentId and courseId', () => {
      const emptyForm: CertificateFormState = {
        studentId: '',
        courseId: '',
        templateId: '',
        notes: '',
      };
      const errors = validateCertificateForm(emptyForm);
      expect(errors.studentId).toBe('certificates.studentRequired');
      expect(errors.courseId).toBe('certificates.courseRequired');

      const validForm: CertificateFormState = {
        studentId: 'stu-1',
        courseId: 'course-1',
        templateId: 'tpl-1',
        notes: '',
      };
      expect(Object.keys(validateCertificateForm(validForm)).length).toBe(0);
    });

    it('validateTemplateForm validates name, html, and max lengths', () => {
      const emptyForm: TemplateFormState = {
        name: '',
        htmlTemplate: '',
        cssStyles: '',
        isDefault: false,
      };
      const errors = validateTemplateForm(emptyForm);
      expect(errors.name).toBe('templates.nameRequired');
      expect(errors.htmlTemplate).toBe('templates.htmlRequired');

      const tooLongHtml: TemplateFormState = {
        name: 'Valid Name',
        htmlTemplate: 'a'.repeat(100_001),
        cssStyles: '',
        isDefault: false,
      };
      expect(validateTemplateForm(tooLongHtml).htmlTemplate).toBe('templates.htmlTooLong');
    });

    it('computeCertificateStats correctly counts totals and this month', () => {
      const stats = computeCertificateStats(mockCertificates, mockTemplates);
      expect(stats.total).toBe(2);
      expect(stats.templatesCount).toBe(2);
      expect(stats.defaultTemplate).toBe('Oltin Premium Shablon');
      expect(stats.thisMonth).toBe(1); // cert-1 is now, cert-2 is 2025
    });
  });

  /* --------------------------------------------------------------------------
   * 2. MAIN COMPONENT RENDERING & STATS
   * ------------------------------------------------------------------------ */
  describe('Main View & Summary Stats', () => {
    it('renders hero title, badges and KPI cards', async () => {
      renderWithClient();

      expect(await screen.findByText('Sertifikatlar va Tasdiqlash')).toBeInTheDocument();
      expect(screen.getByText('Asosiy shablon')).toBeInTheDocument();
      expect(screen.getByText('Shu oyda berilgan')).toBeInTheDocument();
    });

    it('renders certificate rows with student names, numbers, and codes', async () => {
      renderWithClient();

      expect(await screen.findByText('Ali Valiyev')).toBeInTheDocument();
      expect(screen.getByText('Zarina Karimova')).toBeInTheDocument();
      expect(screen.getByText('MEDU-2026-001')).toBeInTheDocument();
      expect(screen.getByText('VRF-998877')).toBeInTheDocument();
      expect(screen.getByText('VRF-112233')).toBeInTheDocument();
    });
  });

  /* --------------------------------------------------------------------------
   * 3. SEARCH & FILTERING
   * ------------------------------------------------------------------------ */
  describe('Search & Filtering', () => {
    it('filters certificates by student name or code', async () => {
      renderWithClient();

      expect(await screen.findByText('Ali Valiyev')).toBeInTheDocument();

      const searchInput = screen.getByPlaceholderText(/Talaba, kurs, sertifikat raqami yoki tasdiqlash kodi.../i);
      fireEvent.change(searchInput, { target: { value: 'Zarina' } });

      expect(screen.queryByText('Ali Valiyev')).not.toBeInTheDocument();
      expect(screen.getByText('Zarina Karimova')).toBeInTheDocument();
    });

    it('shows empty search state when no match is found', async () => {
      renderWithClient();

      expect(await screen.findByText('Ali Valiyev')).toBeInTheDocument();

      const searchInput = screen.getByPlaceholderText(/Talaba, kurs, sertifikat raqami yoki tasdiqlash kodi.../i);
      fireEvent.change(searchInput, { target: { value: 'NonexistentStudent999' } });

      expect(screen.getByText('Mos keluvchi sertifikatlar topilmadi')).toBeInTheDocument();
    });
  });

  /* --------------------------------------------------------------------------
   * 4. ACTIONS & INTERACTION
   * ------------------------------------------------------------------------ */
  describe('Certificate Actions', () => {
    it('opens 3D Tilt Preview modal when clicking preview button', async () => {
      renderWithClient();

      expect(await screen.findByText('Ali Valiyev')).toBeInTheDocument();

      const previewButtons = screen.getAllByRole('button', { name: "Ko'rish" });
      fireEvent.click(previewButtons[0]);

      expect(await screen.findByTestId('tilt-certificate')).toBeInTheDocument();
      expect(screen.getAllByText('MEDU-2026-001').length).toBeGreaterThanOrEqual(2);
    });

    it('opens Split-View sidecar when clicking sidecar button', async () => {
      renderWithClient();

      expect(await screen.findByText('Ali Valiyev')).toBeInTheDocument();

      const sidecarBtns = screen.getAllByRole('button', { name: 'Split-view sidecar' });
      fireEvent.click(sidecarBtns[0]);

      expect(openSidecar).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'cert-1',
          type: 'general',
          title: expect.stringContaining('MEDU-2026-001'),
        }),
      );
    });

    it('triggers PDF download mutation on download click', async () => {
      renderWithClient();

      expect(await screen.findByText('Ali Valiyev')).toBeInTheDocument();

      const downloadBtns = screen.getAllByRole('button', { name: /PDF yuklab olish/i });
      fireEvent.click(downloadBtns[0]);

      await waitFor(() => {
        expect(downloadFile).toHaveBeenCalledWith('/certificates/cert-1/download', expect.any(Object));
      });
    });

    it('copies verification link to clipboard', async () => {
      renderWithClient();

      expect(await screen.findByText('Ali Valiyev')).toBeInTheDocument();

      const copyBtns = screen.getAllByRole('button', { name: 'Havolani nusxalash' });
      fireEvent.click(copyBtns[0]);

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('/verify/VRF-998877'),
      );
    });
  });

  /* --------------------------------------------------------------------------
   * 5. CREATE CERTIFICATE MODAL
   * ------------------------------------------------------------------------ */
  describe('Create Certificate Modal', () => {
    it('opens modal, validates inputs, and triggers generate mutation', async () => {
      renderWithClient();

      expect(await screen.findByText('Ali Valiyev')).toBeInTheDocument();

      const generateBtn = screen.getByRole('button', { name: /Sertifikat berish/i });
      fireEvent.click(generateBtn);

      expect(screen.getByText(/Talabaga kurs bo'yicha rasmiy sertifikat taqdim eting/i)).toBeInTheDocument();

      // Submit empty to check validation
      const submitBtn = screen.getByRole('button', { name: 'Generatsiya qilish' });
      fireEvent.click(submitBtn);

      expect(screen.getByText('certificates.studentRequired')).toBeInTheDocument();
      expect(screen.getByText('certificates.courseRequired')).toBeInTheDocument();

      // Fill in fields
      const studentSelect = screen.getByRole('combobox', { name: 'Talabani tanlang' });
      fireEvent.change(studentSelect, { target: { value: 'stu-1' } });

      const courseSelect = screen.getByRole('combobox', { name: 'Kursni tanlang' });
      fireEvent.change(courseSelect, { target: { value: 'course-1' } });

      // Re-submit
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(certificatesApi.generate).toHaveBeenCalledWith(
          expect.objectContaining({
            studentId: 'stu-1',
            courseId: 'course-1',
          }),
        );
      });
    });
  });

  /* --------------------------------------------------------------------------
   * 6. TEMPLATES TAB & OPERATIONS
   * ------------------------------------------------------------------------ */
  describe('Templates Tab & Actions', () => {
    it('switches to templates tab and displays template list', async () => {
      renderWithClient();

      expect(await screen.findByText('Ali Valiyev')).toBeInTheDocument();

      const templatesTab = screen.getByRole('tab', { name: /Shablonlar/i });
      fireEvent.click(templatesTab);

      expect(await screen.findByText('Oltin Premium Shablon')).toBeInTheDocument();
      expect(screen.getByText('Zamonaviy Minimalist')).toBeInTheDocument();
      expect(screen.getByText('Asosiy')).toBeInTheDocument();
    });

    it('sets template as default when clicking make default', async () => {
      renderWithClient();

      expect(await screen.findByText('Ali Valiyev')).toBeInTheDocument();

      const templatesTab = screen.getByRole('tab', { name: /Shablonlar/i });
      fireEvent.click(templatesTab);

      expect(await screen.findByText('Zamonaviy Minimalist')).toBeInTheDocument();

      const makeDefaultBtn = screen.getByRole('button', { name: /Asosiy qilish/i });
      fireEvent.click(makeDefaultBtn);

      await waitFor(() => {
        expect(certificatesApi.setDefaultTemplate).toHaveBeenCalledWith('tpl-2');
      });
    });
  });

  /* --------------------------------------------------------------------------
   * 7. ACCESSIBILITY & TOUCH TARGETS (WCAG 2.2 AA SC 2.5.8)
   * ------------------------------------------------------------------------ */
  describe('WCAG 2.2 AA SC 2.5.8 Touch Targets (>= 44x44px)', () => {
    it('verifies all row interactive controls have >= 44x44px touch targets', async () => {
      renderWithClient();

      expect(await screen.findByText('Ali Valiyev')).toBeInTheDocument();

      const sidecarBtns = screen.getAllByRole('button', { name: 'Split-view sidecar' });
      for (const btn of sidecarBtns) {
        expect(btn.className).toMatch(/min-h-\[44px\]/);
        expect(btn.className).toMatch(/min-w-\[44px\]/);
      }

      const copyBtns = screen.getAllByRole('button', { name: 'Havolani nusxalash' });
      for (const btn of copyBtns) {
        expect(btn.className).toMatch(/min-h-\[44px\]/);
        expect(btn.className).toMatch(/min-w-\[44px\]/);
      }
    });
  });
});
