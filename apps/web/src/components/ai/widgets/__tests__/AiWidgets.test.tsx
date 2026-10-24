import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  AiAttendanceCard,
  AiDebtorsCard,
  AiScheduleTimeline,
  AiStudentProfileCard,
  AiGradeAnalyticsCard,
  AiTeacherWorkloadCard,
  AiBroadcastCard,
} from '../index';
import type {
  AiAttendanceSummaryData,
  AiDebtorsData,
  AiScheduleListData,
  AiStudentSearchData,
  AiGradeAnalyticsData,
  AiTeacherWorkloadData,
  AiBroadcastData,
} from '@/types/ai';

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('AiAttendanceCard (v2 Interactive Widget)', () => {
  it('renders overall attendance rate and status breakdown correctly', () => {
    const mockData: AiAttendanceSummaryData = {
      overall: {
        total: 50,
        present: 45,
        rate: 90,
      },
      byStatus: [
        { status: 'PRESENT', _count: { status: 45 } },
        { status: 'ABSENT', _count: { status: 3 } },
        { status: 'LATE', _count: { status: 2 } },
      ],
    };

    renderWithRouter(<AiAttendanceCard data={mockData} />);

    expect(screen.getByTestId('ai-attendance-card')).toBeInTheDocument();
    expect(screen.getByText('90%')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
    expect(screen.getByText('45')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders loading placeholder skeleton', () => {
    renderWithRouter(<AiAttendanceCard loading />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByLabelText(/yuklanmoqda/i)).toBeInTheDocument();
  });

  it('renders error alert when error message provided', () => {
    renderWithRouter(<AiAttendanceCard error="Tarmoq xatosi ro'y berdi" />);
    expect(screen.getByRole('alert')).toHaveTextContent("Tarmoq xatosi ro'y berdi");
  });

  it('renders empty fallback when data is null or empty', () => {
    renderWithRouter(<AiAttendanceCard data={null} />);
    expect(screen.getByText(/topilmadi/i)).toBeInTheDocument();
  });
});

describe('AiDebtorsCard (v2 Interactive Widget)', () => {
  it('renders debtors list and total outstanding formatted in UZS', () => {
    const mockData: AiDebtorsData = {
      total: 2,
      outstanding: 1500000,
      debtors: [
        {
          id: 'inv-1',
          student: 'Jasur Bekov',
          total: 1000000,
          paidAmount: 200000,
          status: 'OVERDUE',
          dueDate: '2026-10-30',
        },
        {
          id: 'inv-2',
          student: 'Dilnoza Karimova',
          total: 700000,
          paidAmount: 0,
          status: 'OVERDUE',
          dueDate: '2026-11-05',
        },
      ],
    };

    renderWithRouter(<AiDebtorsCard data={mockData} />);

    expect(screen.getByTestId('ai-debtors-card')).toBeInTheDocument();
    expect(screen.getByText('Jasur Bekov')).toBeInTheDocument();
    expect(screen.getByText('Dilnoza Karimova')).toBeInTheDocument();
    expect(screen.getByText(/1.*500.*000.*UZS/)).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders empty state when there are no debtors', () => {
    renderWithRouter(<AiDebtorsCard data={{ total: 0, outstanding: 0, debtors: [] }} />);
    expect(screen.getByText(/mavjud emas/i)).toBeInTheDocument();
  });

  it('renders error state', () => {
    renderWithRouter(<AiDebtorsCard error="Moliya ma'lumotlarini yuklab bo'lmadi" />);
    expect(screen.getByRole('alert')).toHaveTextContent("Moliya ma'lumotlarini yuklab bo'lmadi");
  });
});

describe('AiScheduleTimeline (v2 Interactive Widget)', () => {
  it('renders lesson timeline items with times, group name and room', () => {
    const mockData: AiScheduleListData = {
      total: 2,
      lessons: [
        {
          id: 'les-1',
          group: 'Frontend Bootcamp #4',
          dayOfWeek: 'MONDAY',
          startTime: '09:00',
          endTime: '10:30',
          room: 'Xona 204',
        },
        {
          id: 'les-2',
          group: 'Backend Node.js #2',
          dayOfWeek: 'MONDAY',
          startTime: '11:00',
          endTime: '12:30',
          room: 'Xona 101',
        },
      ],
    };

    renderWithRouter(<AiScheduleTimeline data={mockData} />);

    expect(screen.getByTestId('ai-schedule-timeline')).toBeInTheDocument();
    expect(screen.getByText('Frontend Bootcamp #4')).toBeInTheDocument();
    expect(screen.getByText('Backend Node.js #2')).toBeInTheDocument();
    expect(screen.getByText('09:00 - 10:30')).toBeInTheDocument();
    expect(screen.getByText('Xona 204')).toBeInTheDocument();
  });

  it('renders empty state when no lessons are scheduled', () => {
    renderWithRouter(<AiScheduleTimeline data={{ total: 0, lessons: [] }} />);
    expect(screen.getByText(/topilmadi/i)).toBeInTheDocument();
  });
});

describe('AiStudentProfileCard (v2 Interactive Widget)', () => {
  it('renders student profile items with name, initials, and group chips', () => {
    const mockData: AiStudentSearchData = {
      total: 1,
      students: [
        {
          id: 'std-123',
          firstName: 'Sanjar',
          lastName: 'Olimov',
          email: 'sanjar@example.com',
          groups: ['IELTS 7.5 Intensive', 'Speaking Club'],
        },
      ],
    };

    renderWithRouter(<AiStudentProfileCard data={mockData} />);

    expect(screen.getByTestId('ai-student-profile-card')).toBeInTheDocument();
    expect(screen.getByText('Sanjar Olimov')).toBeInTheDocument();
    expect(screen.getByText('sanjar@example.com')).toBeInTheDocument();
    expect(screen.getByText('IELTS 7.5 Intensive')).toBeInTheDocument();
    expect(screen.getByText('Speaking Club')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /profil/i });
    expect(link).toHaveAttribute('href', '/students/std-123');
  });

  it('renders empty state when search returns zero students', () => {
    renderWithRouter(<AiStudentProfileCard data={{ total: 0, students: [] }} />);
    expect(screen.getByText(/topilmadi/i)).toBeInTheDocument();
  });
});

describe('AiGradeAnalyticsCard (v2 Interactive Widget)', () => {
  it('renders overall pass rate, averages and exam items', () => {
    const mockData: AiGradeAnalyticsData = {
      totalExams: 3,
      overallAverage: 82.5,
      overallPassRate: 88,
      exams: [
        {
          id: 'ex-1',
          title: 'IELTS Mock Exam #1',
          subject: 'Ingliz tili',
          averageMarks: 82.5,
          totalMarks: 100,
          passingMarks: 60,
          passedCount: 22,
          failedCount: 3,
          totalStudents: 25,
          passRate: 88,
        },
      ],
    };

    renderWithRouter(<AiGradeAnalyticsCard data={mockData} />);

    expect(screen.getByTestId('ai-grade-analytics-card')).toBeInTheDocument();
    expect(screen.getAllByText('88%').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/O'rtacha: 82.5 ball/i)).toBeInTheDocument();
    expect(screen.getByText('IELTS Mock Exam #1')).toBeInTheDocument();
  });

  it('renders empty state when no exams exist', () => {
    renderWithRouter(<AiGradeAnalyticsCard data={{ totalExams: 0, overallAverage: 0, overallPassRate: 0, exams: [] }} />);
    expect(screen.getByText(/topilmadi/i)).toBeInTheDocument();
  });
});

describe('AiTeacherWorkloadCard (v2 Interactive Widget)', () => {
  it('renders teacher hours, group count, and specializations', () => {
    const mockData: AiTeacherWorkloadData = {
      totalTeachers: 2,
      totalHours: 36,
      averageAttendanceRate: 94,
      teachers: [
        {
          id: 'tch-1',
          name: 'Aziz Rahimov',
          groupsCount: 4,
          studentsCount: 48,
          weeklyHours: 18,
          attendanceRate: 94,
          specializations: ['Grammar', 'IELTS Writing'],
        },
      ],
    };

    renderWithRouter(<AiTeacherWorkloadCard data={mockData} />);

    expect(screen.getByTestId('ai-teacher-workload-card')).toBeInTheDocument();
    expect(screen.getByText('Aziz Rahimov')).toBeInTheDocument();
    expect(screen.getByText(/Jami: 36 soat\/hafta/i)).toBeInTheDocument();
    expect(screen.getByText('Grammar')).toBeInTheDocument();
  });

  it('renders empty state when no teachers found', () => {
    renderWithRouter(<AiTeacherWorkloadCard data={{ totalTeachers: 0, totalHours: 0, averageAttendanceRate: 0, teachers: [] }} />);
    expect(screen.getByText(/topilmadi/i)).toBeInTheDocument();
  });
});

describe('AiBroadcastCard (v2 Interactive Widget)', () => {
  it('renders channel label, recipient count, and message text', () => {
    const mockData: AiBroadcastData = {
      channel: 'sms',
      recipientGroup: "Barcha o'quvchilar va ota-onalar",
      recipientCount: 120,
      title: 'Darslar boshlanishi haqida',
      message: 'Hurmatli ota-onalar, yangi semestr darslari 1-sentabrdan boshlanadi.',
    };

    renderWithRouter(<AiBroadcastCard data={mockData} />);

    expect(screen.getByTestId('ai-broadcast-card')).toBeInTheDocument();
    expect(screen.getByText('SMS Xabarnoma')).toBeInTheDocument();
    expect(screen.getByText(/120 ta qabul qiluvchi/i)).toBeInTheDocument();
    expect(screen.getByText('Darslar boshlanishi haqida')).toBeInTheDocument();
  });

  it('renders empty state when message is empty', () => {
    renderWithRouter(<AiBroadcastCard data={null} />);
    expect(screen.getByText(/topilmadi/i)).toBeInTheDocument();
  });
});
