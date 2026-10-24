/**
 * Unit & Integration Test Suite for StudentFormPage (Apple 10/10 VisionOS / macOS Sequoia Edition)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { I18nProvider } from '@/i18n/I18nProvider';
import {
  StudentFormPage,
  validateEmail,
  getInitials,
  nameHash,
  avatarGradient,
} from '../StudentForm';

// Mock sound hook
vi.mock('@/hooks/usePremiumSound', () => ({
  usePremiumSound: () => ({
    playTick: vi.fn(),
    playPop: vi.fn(),
    playSuccess: vi.fn(),
    playError: vi.fn(),
  }),
}));

const { mockGet, mockCreate, mockUpdate } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  studentsApi: {
    get: (...args: unknown[]) => mockGet(...args),
    create: (...args: unknown[]) => mockCreate(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
  },
}));

const mockStudent = {
  id: 'student-999',
  user: {
    id: 'user-999',
    firstName: 'Madina',
    lastName: 'Rustamova',
    email: 'madina@example.com',
    phone: '+998901112233',
  },
  dateOfBirth: '2009-08-20T00:00:00.000Z',
  gender: 'FEMALE',
  address: 'Samarkand, Registan 12',
  notes: 'A\'lochi o\'quvchi',
  parentName: 'Rustam Aliyev',
  parentPhone: '+998904445566',
  parentEmail: 'rustam@example.com',
};

function renderCreate() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <MemoryRouter initialEntries={['/students/new']}>
          <Routes>
            <Route path="/students/new" element={<StudentFormPage />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>
  );
}

function renderEdit(studentId = 'student-999') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <MemoryRouter initialEntries={[`/students/${studentId}/edit`]}>
          <Routes>
            <Route path="/students/:id/edit" element={<StudentFormPage />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>
  );
}

describe('StudentFormPage (Apple 10/10 VisionOS / macOS Sequoia Edition)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue(mockStudent);
    mockCreate.mockResolvedValue({ ...mockStudent, id: 'student-created' });
    mockUpdate.mockResolvedValue({ ...mockStudent });
  });

  /* -------------------------------------------------------------
     PURE HELPERS TEST SUITE
  ------------------------------------------------------------- */
  describe('Pure Helper Functions', () => {
    it('validateEmail correctly validates RFC compliant emails', () => {
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('student.new@edu.uz')).toBe(true);
      expect(validateEmail('invalid-email')).toBe(false);
      expect(validateEmail('missing@domain')).toBe(false);
      expect(validateEmail('   ')).toBe(false);
    });

    it('getInitials extracts two letters from first and last names', () => {
      expect(getInitials('Madina', 'Rustamova')).toBe('MR');
      expect(getInitials('Jasur', '')).toBe('J');
      expect(getInitials('', '')).toBe('—');
    });

    it('nameHash produces a deterministic positive hash integer', () => {
      const h1 = nameHash('Madina Rustamova');
      const h2 = nameHash('Madina Rustamova');
      expect(h1).toBe(h2);
      expect(h1).toBeGreaterThanOrEqual(0);
    });

    it('avatarGradient generates a valid linear gradient CSS string', () => {
      const grad = avatarGradient('Madina Rustamova');
      expect(grad).toMatch(/^linear-gradient\(135deg, #[0-9a-fA-F]{6} 0%, #[0-9a-fA-F]{6} 100%\)$/);
    });
  });

  /* -------------------------------------------------------------
     CREATE MODE RENDERING & SUBMISSION
  ------------------------------------------------------------- */
  describe('Create Mode', () => {
    it('renders empty form with live avatar preview and progress bar', () => {
      renderCreate();

      expect(screen.getByPlaceholderText('John')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Doe')).toBeInTheDocument();
      expect(screen.getAllByText(/0%/).length).toBeGreaterThanOrEqual(1);
    });

    it('validates required fields on submit without input', async () => {
      renderCreate();

      const submitBtn = screen.getByRole('button', { name: /create|yaratish|создать/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockCreate).not.toHaveBeenCalled();
      });
    });

    it('fills form and creates student successfully', async () => {
      renderCreate();

      const firstNameInput = screen.getByPlaceholderText('John');
      const lastNameInput = screen.getByPlaceholderText('Doe');
      const phoneInputs = screen.getAllByPlaceholderText('+998 90 123 4567');

      fireEvent.change(firstNameInput, { target: { value: 'Madina' } });
      fireEvent.change(lastNameInput, { target: { value: 'Rustamova' } });
      fireEvent.change(phoneInputs[0], { target: { value: '+998901112233' } });

      const submitBtn = screen.getByRole('button', { name: /create|yaratish|создать/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            firstName: 'Madina',
            lastName: 'Rustamova',
            phone: '+998901112233',
          })
        );
      });
    });
  });

  /* -------------------------------------------------------------
     EDIT MODE RENDERING & MUTATION
  ------------------------------------------------------------- */
  describe('Edit Mode', () => {
    it('loads existing student data into form inputs', async () => {
      renderEdit('student-999');

      await waitFor(() => {
        expect(screen.getByDisplayValue('Madina')).toBeInTheDocument();
      });

      expect(screen.getByDisplayValue('Rustamova')).toBeInTheDocument();
      expect(screen.getByDisplayValue('+998901112233')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Rustam Aliyev')).toBeInTheDocument();
    });

    it('submits updated student data to backend', async () => {
      renderEdit('student-999');

      await waitFor(() => {
        expect(screen.getByDisplayValue('Madina')).toBeInTheDocument();
      });

      const firstNameInput = screen.getByDisplayValue('Madina');
      fireEvent.change(firstNameInput, { target: { value: 'Madinaxon' } });

      const submitBtn = screen.getByRole('button', { name: /save|saqlash|сохранить/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledWith(
          'student-999',
          expect.objectContaining({
            firstName: 'Madinaxon',
            lastName: 'Rustamova',
          })
        );
      });
    });
  });
});
