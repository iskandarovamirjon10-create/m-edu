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
  Badge,
  useToasts,
} from '@/components/ui';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Paginated, Certificate, CertificateTemplate, Course, Student } from '@/lib/types';
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

interface TemplateFormState {
  name: string;
  htmlTemplate: string;
  cssStyles: string;
  isDefault: boolean;
}

const INITIAL_TEMPLATE_FORM: TemplateFormState = {
  name: '',
  htmlTemplate: [
    '<html>',
    '  <body style="font-family: Georgia, serif; text-align: center;">',
    '    <h1>Certificate of Achievement</h1>',
    '    <p>This certifies that</p>',
    '    <div class="student-name">{{studentName}}</div>',
    '    <p>has successfully completed</p>',
    '    <div class="course-name">{{courseName}}</div>',
    '    <p>Issued on {{issueDate}} — Certificate {{certificateNumber}}</p>',
    '  </body>',
    '</html>',
  ].join('\n'),
  cssStyles: '',
  isDefault: false,
};

const TEMPLATE_VARIABLES = ['studentName', 'courseName', 'issueDate', 'certificateNumber', 'verificationCode'];

function validateCertificateForm(form: CertificateFormState): Partial<Record<keyof CertificateFormState, string>> {
  const errors: Partial<Record<keyof CertificateFormState, string>> = {};

  if (!form.studentId) errors.studentId = 'Student is required';
  if (!form.courseId) errors.courseId = 'Course is required';

  return errors;
}

function validateTemplateForm(form: TemplateFormState): Partial<Record<keyof TemplateFormState, string>> {
  const errors: Partial<Record<keyof TemplateFormState, string>> = {};

  if (!form.name.trim()) errors.name = 'Template name is required';
  if (!form.htmlTemplate.trim()) errors.htmlTemplate = 'Template HTML is required';
  else if (form.htmlTemplate.length > 100_000) errors.htmlTemplate = 'Template HTML must be at most 100,000 characters';
  if (form.cssStyles.length > 50_000) errors.cssStyles = 'CSS must be at most 50,000 characters';

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

  // Tab state: certificates | templates
  const [activeTab, setActiveTab] = useState<'certificates' | 'templates'>('certificates');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CertificateTemplate | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState<CertificateTemplate | null>(null);

  // Form state
  const [form, setForm] = useState<CertificateFormState>(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof CertificateFormState, string>>>({});
  const [templateForm, setTemplateForm] = useState<TemplateFormState>(INITIAL_TEMPLATE_FORM);
  const [templateFormErrors, setTemplateFormErrors] = useState<Partial<Record<keyof TemplateFormState, string>>>({});

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

  const templates = useQuery({
    queryKey: ['certificate-templates'],
    queryFn: () => certificatesApi.listTemplates(),
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

  const templateList = useMemo(() => {
    const d = templates.data as unknown;
    return Array.isArray(d) ? (d as CertificateTemplate[]) : ((d as Paginated<CertificateTemplate> | null)?.items ?? []);
  }, [templates.data]);

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

  // ---- Template mutations ----

  const saveTemplate = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {
        name: templateForm.name.trim(),
        htmlTemplate: templateForm.htmlTemplate,
      };
      if (templateForm.cssStyles.trim()) payload.cssStyles = templateForm.cssStyles.trim();
      payload.isDefault = templateForm.isDefault;

      return editingTemplate
        ? certificatesApi.updateTemplate(editingTemplate.id, payload)
        : certificatesApi.createTemplate(payload);
    },
    onSuccess: () => {
      push({ type: 'success', message: editingTemplate ? 'Template updated' : 'Template created' });
      qc.invalidateQueries({ queryKey: ['certificate-templates'] });
      closeTemplateModal();
    },
    onError: (error) => {
      push({ type: 'error', message: getErrorMessage(error) });
    },
  });

  const setDefault = useMutation({
    mutationFn: (id: string) => certificatesApi.setDefaultTemplate(id),
    onSuccess: () => {
      push({ type: 'success', message: 'Default template updated' });
      qc.invalidateQueries({ queryKey: ['certificate-templates'] });
    },
    onError: (error) => {
      push({ type: 'error', message: getErrorMessage(error) });
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: (id: string) => certificatesApi.removeTemplate(id),
    onSuccess: () => {
      push({ type: 'success', message: 'Template deleted' });
      setDeletingTemplate(null);
      qc.invalidateQueries({ queryKey: ['certificate-templates'] });
    },
    onError: (error) => {
      push({ type: 'error', message: getErrorMessage(error) });
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

  const openTemplateModal = useCallback((template?: CertificateTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setTemplateForm({
        name: template.name,
        htmlTemplate: template.htmlTemplate,
        cssStyles: template.cssStyles ?? '',
        isDefault: template.isDefault,
      });
    } else {
      setEditingTemplate(null);
      setTemplateForm(INITIAL_TEMPLATE_FORM);
    }
    setTemplateFormErrors({});
    setTemplateModalOpen(true);
  }, []);

  const closeTemplateModal = useCallback(() => {
    setTemplateModalOpen(false);
    setEditingTemplate(null);
    setTemplateForm(INITIAL_TEMPLATE_FORM);
    setTemplateFormErrors({});
  }, []);

  const handleCertificateSubmit = useCallback(() => {
    const errors = validateCertificateForm(form);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    generateCertificate.mutate();
  }, [form, generateCertificate]);

  const handleTemplateSubmit = useCallback(() => {
    const errors = validateTemplateForm(templateForm);
    if (Object.keys(errors).length > 0) {
      setTemplateFormErrors(errors);
      return;
    }
    saveTemplate.mutate();
  }, [templateForm, saveTemplate]);

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
        subtitle="Manage student certificates and templates"
        action={
          activeTab === 'certificates'
            ? {
                label: 'Generate Certificate',
                onClick: openModal,
              }
            : {
                label: 'New Template',
                onClick: () => openTemplateModal(),
              }
        }
      />

      {/* Tab switcher */}
      <div role="tablist" aria-label="Certificate sections" className="flex gap-2">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'certificates'}
          onClick={() => setActiveTab('certificates')}
          className={
            activeTab === 'certificates'
              ? 'glass-btn glass-btn-primary glass-btn-sm'
              : 'glass-btn glass-btn-secondary glass-btn-sm'
          }
        >
          Certificates
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'templates'}
          onClick={() => setActiveTab('templates')}
          className={
            activeTab === 'templates'
              ? 'glass-btn glass-btn-primary glass-btn-sm'
              : 'glass-btn glass-btn-secondary glass-btn-sm'
          }
        >
          Templates
        </button>
      </div>

      {activeTab === 'certificates' && (
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
      )}

      {activeTab === 'templates' && (
        <Card>
          {templates.isLoading ? (
            <div className="p-8">
              <PageLoader />
            </div>
          ) : templates.isError ? (
            <ErrorState
              message={getErrorMessage(templates.error)}
              onRetry={() => templates.refetch()}
            />
          ) : templateList.length === 0 ? (
            <EmptyState
              title="No templates yet"
              description="Create a certificate template to control how issued certificates look."
              action={{ label: 'New Template', onClick: () => openTemplateModal() }}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH>Name</TH>
                    <TH>Default</TH>
                    <TH>Created</TH>
                    <TH>Actions</TH>
                  </TR>
                </THead>
                <TBody>
                  {templateList.map((tpl) => (
                    <TR key={tpl.id}>
                      <TD className="font-medium">{tpl.name}</TD>
                      <TD>
                        {tpl.isDefault ? (
                          <Badge variant="success">Default</Badge>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDefault.mutate(tpl.id)}
                            disabled={setDefault.isPending}
                            className="glass-btn glass-btn-ghost glass-btn-sm"
                          >
                            Make default
                          </button>
                        )}
                      </TD>
                      <TD>{tpl.createdAt ? new Date(tpl.createdAt).toLocaleDateString() : '—'}</TD>
                      <TD>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => openTemplateModal(tpl)}
                            className="glass-btn glass-btn-ghost glass-btn-sm"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingTemplate(tpl)}
                            disabled={deleteTemplate.isPending}
                            className="glass-btn glass-btn-ghost glass-btn-sm"
                            style={{ color: 'var(--state-error, #dc2626)' }}
                          >
                            Delete
                          </button>
                        </div>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          )}
        </Card>
      )}

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
                onClick={handleCertificateSubmit}
                disabled={generateCertificate.isPending}
                className="glass-btn glass-btn-primary"
              >
                {generateCertificate.isPending ? 'Generating...' : 'Generate'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Template Create/Edit Modal */}
      {templateModalOpen && (
        <Modal
          isOpen={templateModalOpen}
          onClose={closeTemplateModal}
          title={editingTemplate ? `Edit Template: ${editingTemplate.name}` : 'New Template'}
          wide
        >
          <div className="space-y-4">
            <Field label="Template name *" error={templateFormErrors.name}>
              <TextInput
                value={templateForm.name}
                onChange={(e) => {
                  setTemplateForm((prev) => ({ ...prev, name: e.target.value }));
                  setTemplateFormErrors((prev) => ({ ...prev, name: undefined }));
                }}
                placeholder="e.g. Golden Achievement"
                aria-invalid={Boolean(templateFormErrors.name)}
                maxLength={200}
              />
            </Field>

            <Field
              label="Template HTML *"
              error={templateFormErrors.htmlTemplate}
            >
              <TextArea
                value={templateForm.htmlTemplate}
                onChange={(e) => {
                  setTemplateForm((prev) => ({ ...prev, htmlTemplate: e.target.value }));
                  setTemplateFormErrors((prev) => ({ ...prev, htmlTemplate: undefined }));
                }}
                placeholder="<html>…</html>"
                rows={10}
                className="font-mono text-xs"
                aria-invalid={Boolean(templateFormErrors.htmlTemplate)}
              />
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Available variables:{' '}
                {TEMPLATE_VARIABLES.map((v) => (
                  <code key={v} className="glass-badge glass-badge-muted mr-1">
                    {`{{${v}}}`}
                  </code>
                ))}
                . Values are HTML-escaped automatically when rendered.
              </p>
            </Field>

            <Field label="Custom CSS" error={templateFormErrors.cssStyles}>
              <TextArea
                value={templateForm.cssStyles}
                onChange={(e) => {
                  setTemplateForm((prev) => ({ ...prev, cssStyles: e.target.value }));
                  setTemplateFormErrors((prev) => ({ ...prev, cssStyles: undefined }));
                }}
                placeholder=".student-name { font-size: 32px; color: #111; }"
                rows={4}
                className="font-mono text-xs"
                aria-invalid={Boolean(templateFormErrors.cssStyles)}
              />
            </Field>

            <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
              <input
                type="checkbox"
                checked={templateForm.isDefault}
                onChange={(e) =>
                  setTemplateForm((prev) => ({ ...prev, isDefault: e.target.checked }))
                }
                className="h-4 w-4 rounded border-[var(--border-medium)]"
              />
              Set as the organization default template
            </label>

            <div className="flex gap-2 justify-end pt-4">
              <button
                onClick={closeTemplateModal}
                className="glass-btn glass-btn-secondary"
                disabled={saveTemplate.isPending}
              >
                Cancel
              </button>
              <button
                onClick={handleTemplateSubmit}
                disabled={saveTemplate.isPending}
                className="glass-btn glass-btn-primary"
              >
                {saveTemplate.isPending ? 'Saving…' : editingTemplate ? 'Save changes' : 'Create template'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Template Delete Confirmation */}
      {deletingTemplate && (
        <Modal
          isOpen={Boolean(deletingTemplate)}
          onClose={() => setDeletingTemplate(null)}
          title="Delete Template"
        >
          <div className="space-y-4">
            <p className="text-sm text-[var(--text-primary)]">
              Delete template <strong>{deletingTemplate.name}</strong>? This cannot be undone.
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              Templates used by issued certificates cannot be deleted — the API will reject the
              request to preserve certificate history.
            </p>
            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setDeletingTemplate(null)}
                className="glass-btn glass-btn-secondary"
                disabled={deleteTemplate.isPending}
              >
                Cancel
              </button>
              <button
                onClick={() => deleteTemplate.mutate(deletingTemplate.id)}
                disabled={deleteTemplate.isPending}
                className="glass-btn glass-btn-primary"
                style={{ background: 'var(--state-error, #dc2626)' }}
              >
                {deleteTemplate.isPending ? 'Deleting…' : 'Delete template'}
              </button>
            </div>
          </div>
        </Modal>
      )}
      </div>
    </div>
  );
}
