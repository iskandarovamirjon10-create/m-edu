import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { certificatesApi, coursesApi, studentsApi } from '@/lib/api';
import {
  PageHeader,
  Card,
  PageLoader,
  ErrorState,
  EmptyState,
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
  Modal,
  Field,
  TextInput,
  TextArea,
  Select,
  useToasts,
} from '@/components/ui';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Paginated, Certificate, Course, Student } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';

interface CertificateFormState {
  studentId: string;
  courseId: string;
  notes: string;
}

const INITIAL_FORM: CertificateFormState = {
  studentId: '',
  courseId: '',
  notes: '',
};

function validateCertificateForm(form: CertificateFormState): Partial<Record<keyof CertificateFormState, string>> {
  const errors: Partial<Record<keyof CertificateFormState, string>> = {};

  if (!form.studentId) errors.studentId = 'Student is required';
  if (!form.courseId) errors.courseId = 'Course is required';

  return errors;
}

function formatStudentName(student: Student | undefined): string {
  if (!student?.user) return '—';
  return [student.user.firstName, student.user.lastName].filter(Boolean).join(' ') || '—';
}

export function CertificatesPage() {
  usePageTitle('Certificates');
  const { push, toastNode } = useToasts();
  const qc = useQueryClient();

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);

  // Form state
  const [form, setForm] = useState<CertificateFormState>(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof CertificateFormState, string>>>({});

  // Search and filter
  const [searchQuery, setSearchQuery] = useState('');

  // Data fetching
  // NOTE: GET /certificates returns a plain array (not paginated) — see
  // certificates.service.findAllCertificates. Cast accordingly.
  const certificates = useQuery({
    queryKey: ['certificates'],
    queryFn: () => certificatesApi.list({ limit: 100 }),
    placeholderData: (previousData) => previousData,
  });

  const courses = useQuery({
    queryKey: ['courses'],
    queryFn: () => coursesApi.list({ limit: 100 }),
  });

  const students = useQuery({
    queryKey: ['students'],
    queryFn: () => studentsApi.list({ limit: 100 }),
  });

  // Backend returns an array for certificates; courses/students are paginated.
  const certificateList = useMemo(() => {
    const d = certificates.data as unknown;
    return Array.isArray(d) ? (d as Certificate[]) : ((d as Paginated<Certificate> | null)?.items ?? []);
  }, [certificates.data]);

  const courseData = courses.data as Paginated<Course> | undefined;
  const courseList = useMemo(() => courseData?.items || [], [courseData]);

  const studentData = students.data as Paginated<Student> | undefined;
  const studentList = useMemo(() => studentData?.items || [], [studentData]);

  const filteredCertificates = useMemo(() => {
    if (!searchQuery.trim()) return certificateList;
    const q = searchQuery.toLowerCase();
    return certificateList.filter(
      (cert) =>
        cert.certificateNumber?.toLowerCase().includes(q) ||
        cert.verificationCode?.toLowerCase().includes(q) ||
        cert.student?.user?.firstName?.toLowerCase().includes(q) ||
        cert.student?.user?.lastName?.toLowerCase().includes(q) ||
        cert.course?.name?.toLowerCase().includes(q)
    );
  }, [certificateList, searchQuery]);

  // Generate certificate mutation
  // Backend CreateCertificateDto accepts ONLY: studentId (uuid, required),
  // courseId (uuid, required), templateId?, notes?. Anything else is rejected
  // with 400 (global ValidationPipe uses forbidNonWhitelisted).
  const generateCertificate = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {
        studentId: form.studentId,
        courseId: form.courseId,
      };

      if (form.notes.trim()) payload.notes = form.notes.trim();

      return certificatesApi.generate(payload);
    },
    onSuccess: () => {
      push({ type: 'success', message: 'Certificate generated' });
      qc.invalidateQueries({ queryKey: ['certificates'] });
      closeModal();
    },
    onError: (error) => {
      push({
        type: 'error',
        message: getErrorMessage(error),
      });
    },
  });

  // Download certificate mutation.
  // POST /certificates/:id/download streams a PDF binary with @Res(), so we
  // fetch it as a blob (request() would try to parse JSON) and save it.
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const downloadCertificate = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/certificates/${id}/download`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        let message = `Download failed with status ${res.status}.`;
        try {
          const body = (await res.json()) as { message?: string };
          if (body?.message) message = body.message;
        } catch {
          // binary or empty body — keep default message
        }
        throw new Error(message);
      }
      return res.blob();
    },
    onMutate: (id) => setDownloadingId(id),
    onSettled: () => setDownloadingId(null),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'certificate.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      push({ type: 'success', message: 'Certificate downloaded' });
    },
    onError: (error) => {
      push({
        type: 'error',
        message: getErrorMessage(error),
      });
    },
  });

  const openModal = useCallback(() => {
    setForm(INITIAL_FORM);
    setFormErrors({});
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setForm(INITIAL_FORM);
    setFormErrors({});
  }, []);

  const handleSubmit = useCallback(() => {
    const errors = validateCertificateForm(form);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    generateCertificate.mutate();
  }, [form, generateCertificate]);

  const getStudentName = useCallback(
    (studentId: string) => {
      const student = studentList.find((s) => s.id === studentId);
      return student ? formatStudentName(student) : '—';
    },
    [studentList],
  );

  const getCourseName = useCallback((courseId?: string) => {
    if (!courseId) return '—';
    const course = courseList.find((c) => c.id === courseId);
    return course?.name || 'Unknown';
  }, [courseList]);

  if (certificates.isLoading) {
    return <PageLoader />;
  }

  if (certificates.isError) {
    return (
      <ErrorState
        message={getErrorMessage(certificates.error)}
        onRetry={() => certificates.refetch()}
      />
    );
  }

  return (
    <div className="page-container">
      <div className="orb-container" aria-hidden="true">
        <div className="orb orb-cyan-1" />
        <div className="orb orb-cyan-2" />
        <div className="orb orb-indigo-1" />
        <div className="orb orb-deep-1" />
      </div>

      <div className="space-y-4" style={{ position: 'relative', zIndex: 1 }}>
        {toastNode}

      <PageHeader
        title="Certificates"
        subtitle="Manage student certificates"
        action={{
          label: 'Generate Certificate',
          onClick: openModal,
        }}
      />

      <Card>
        <div className="p-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <TextInput
            placeholder="Search by student name, course, or verification code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search certificates"
          />
        </div>

        {filteredCertificates.length === 0 ? (
          <EmptyState
            title={searchQuery ? 'No certificates found' : 'No certificates yet'}
            description={
              searchQuery
                ? 'Try adjusting your search criteria'
                : 'Generate your first certificate to get started'
            }
            action={!searchQuery ? { label: 'Generate Certificate', onClick: openModal } : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>Student</TH>
                  <TH>Course</TH>
                  <TH>Certificate #</TH>
                  <TH>Verification</TH>
                  <TH>Issued</TH>
                  <TH>Actions</TH>
                </TR>
              </THead>
              <TBody>
                {filteredCertificates.map((cert) => (
                  <TR key={cert.id}>
                    <TD className="font-medium">{getStudentName(cert.studentId)}</TD>
                    <TD>{cert.course?.name || getCourseName(cert.courseId)}</TD>
                    <TD className="font-mono text-sm">{cert.certificateNumber}</TD>
                    <TD>
                      <code className="text-xs glass-badge glass-badge-muted">
                        {cert.verificationCode}
                      </code>
                    </TD>
                    <TD>{cert.issueDate ? new Date(cert.issueDate).toLocaleDateString() : '—'}</TD>
                    <TD>
                      <button
                        onClick={() => downloadCertificate.mutate(cert.id)}
                        disabled={downloadCertificate.isPending}
                        className="glass-btn glass-btn-ghost glass-btn-sm"
                      >
                        {downloadingId === cert.id ? 'Downloading…' : 'Download'}
                      </button>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Certificate Generation Modal */}
      {modalOpen && (
        <Modal
          isOpen={modalOpen}
          onClose={closeModal}
          title="Generate Certificate"
        >
          <div className="space-y-4">
            <Field label="Student *" error={formErrors.studentId}>
              <Select
                value={form.studentId}
                onChange={(e) => setForm({ ...form, studentId: e.target.value })}
              >
                <option value="">Select student</option>
                {studentList.map((student) => (
                  <option key={student.id} value={student.id}>
                    {formatStudentName(student)}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Course *" error={formErrors.courseId}>
              <Select
                value={form.courseId}
                onChange={(e) => setForm({ ...form, courseId: e.target.value })}
              >
                <option value="">Select course</option>
                {courseList.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Notes" error={formErrors.notes}>
              <TextArea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Optional notes stored with the certificate"
                rows={3}
              />
            </Field>

            <p className="text-xs text-[var(--text-muted)]">
              The certificate is issued for the selected student and course. The student must be
              enrolled in an active group of that course.
            </p>

            <div className="flex gap-2 justify-end pt-4">
              <button
                onClick={closeModal}
                className="glass-btn glass-btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={generateCertificate.isPending}
                className="glass-btn glass-btn-primary"
              >
                {generateCertificate.isPending ? 'Generating...' : 'Generate'}
              </button>
            </div>
          </div>
        </Modal>
      )}
      </div>
    </div>
  );
}
