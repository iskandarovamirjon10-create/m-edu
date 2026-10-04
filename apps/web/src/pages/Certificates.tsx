import { formatDate } from '../lib/format';
import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { certificatesApi, coursesApi, studentsApi, downloadFile } from '@/lib/api';
import { GlassPageHeader, GlassCard, GlassPageLoader, GlassErrorState, GlassEmptyState, GlassTable, GlassTHead, GlassTBody, GlassTR, GlassTH, GlassTD, GlassModal, GlassField, GlassInput, GlassTextArea, GlassSelect, GlassBadge, GlassButton, GlassSwitch, useToasts } from '@/components/ui';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Paginated, Certificate, CertificateTemplate, Course, Student } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '@/i18n/I18nProvider';

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

// Module-level validators return i18n KEYS; the component applies t() at render.
function validateCertificateForm(form: CertificateFormState): Partial<Record<keyof CertificateFormState, string>> {
  const errors: Partial<Record<keyof CertificateFormState, string>> = {};

  if (!form.studentId) errors.studentId = 'certificates.studentRequired';
  if (!form.courseId) errors.courseId = 'certificates.courseRequired';

  return errors;
}

function validateTemplateForm(form: TemplateFormState): Partial<Record<keyof TemplateFormState, string>> {
  const errors: Partial<Record<keyof TemplateFormState, string>> = {};

  if (!form.name.trim()) errors.name = 'templates.nameRequired';
  if (!form.htmlTemplate.trim()) errors.htmlTemplate = 'templates.htmlRequired';
  else if (form.htmlTemplate.length > 100_000) errors.htmlTemplate = 'templates.htmlTooLong';
  if (form.cssStyles.length > 50_000) errors.cssStyles = 'templates.cssTooLong';

  return errors;
}

function formatStudentName(student: Student | undefined): string {
  if (!student?.user) return '—';
  return [student.user.firstName, student.user.lastName].filter(Boolean).join(' ') || '—';
}

export function CertificatesPage() {
  const { t } = useI18n();
  usePageTitle(t('certificates.title'));
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
      push({ type: 'success', message: t('certificates.generated') });
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
      await downloadFile(`/certificates/${id}/download`, {
        method: 'POST',
        defaultFilename: 'certificate.pdf'
      });
    },
    onMutate: (id) => setDownloadingId(id),
    onSettled: () => setDownloadingId(null),
    onSuccess: () => {
      push({ type: 'success', message: t('certificates.downloaded') });
    },
    onError: (error) => {
      push({
        type: 'error',
        message: getErrorMessage(error) || t('certificates.downloadFailed', { status: 500 }),
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
      push({ type: 'success', message: editingTemplate ? t('templates.updated') : t('templates.created') });
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
      push({ type: 'success', message: t('templates.defaultUpdated') });
      qc.invalidateQueries({ queryKey: ['certificate-templates'] });
    },
    onError: (error) => {
      push({ type: 'error', message: getErrorMessage(error) });
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: (id: string) => certificatesApi.removeTemplate(id),
    onSuccess: () => {
      push({ type: 'success', message: t('templates.deleted') });
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
    return course?.name || t('common.unknown');
  }, [courseList, t]);

  if (certificates.isLoading) {
    return <GlassPageLoader />;
  }

  if (certificates.isError) {
    return (
      <GlassErrorState
        message={getErrorMessage(certificates.error)}
        onRetry={() => certificates.refetch()}
      />
    );
  }

  return (
    <div className="page-container">
      

      <div className="space-y-4" style={{ position: 'relative', zIndex: 1 }}>
        {toastNode}

      <GlassPageHeader
        title={t('certificates.title')}
        subtitle={t('certificates.subtitle')}
        action={
          activeTab === 'certificates'
            ? {
                label: t('certificates.generate'),
                onClick: openModal,
              }
            : {
                label: t('templates.new'),
                onClick: () => openTemplateModal(),
              }
        }
      />

      {/* Tab switcher */}
      <div role="tablist" aria-label={t('certificates.sectionsAria')} className="flex gap-2">
        <GlassButton
          type="button"
          role="tab"
          aria-selected={activeTab === 'certificates'}
          onClick={() => setActiveTab('certificates')}
          variant={activeTab === 'certificates' ? 'primary' : 'secondary'}
          size="sm"
        >
          {t('certificates.tab.certificates')}
        </GlassButton>
        <GlassButton
          type="button"
          role="tab"
          aria-selected={activeTab === 'templates'}
          onClick={() => setActiveTab('templates')}
          variant={activeTab === 'templates' ? 'primary' : 'secondary'}
          size="sm"
        >
          {t('certificates.tab.templates')}
        </GlassButton>
      </div>

      {activeTab === 'certificates' && (
        <GlassCard>
          <div className="p-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
            <GlassInput
              placeholder={t('certificates.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label={t('certificates.searchAria')}
            />
          </div>

          {filteredCertificates.length === 0 ? (
            <GlassEmptyState
              title={searchQuery ? t('certificates.emptySearch') : t('certificates.empty')}
              description={
                searchQuery
                  ? t('certificates.emptySearchHint')
                  : t('certificates.emptyHint')
              }
              action={!searchQuery ? { label: t('certificates.generate'), onClick: openModal } : undefined}
            />
          ) : (
            <div className="overflow-x-auto">
              <GlassTable>
                <GlassTHead>
                  <GlassTR>
                    <GlassTH>{t('certificates.col.student')}</GlassTH>
                    <GlassTH>{t('certificates.col.course')}</GlassTH>
                    <GlassTH>{t('certificates.col.number')}</GlassTH>
                    <GlassTH>{t('certificates.col.verification')}</GlassTH>
                    <GlassTH>{t('certificates.col.issued')}</GlassTH>
                    <GlassTH>{t('common.actions')}</GlassTH>
                  </GlassTR>
                </GlassTHead>
                <GlassTBody>
                  {filteredCertificates.map((cert) => (
                    <GlassTR key={cert.id}>
                      <GlassTD className="font-medium">{getStudentName(cert.studentId)}</GlassTD>
                      <GlassTD>{cert.course?.name || getCourseName(cert.courseId)}</GlassTD>
                      <GlassTD className="font-mono text-sm">{cert.certificateNumber}</GlassTD>
                      <GlassTD>
                        <code className="text-xs glass-badge glass-badge-muted">
                          {cert.verificationCode}
                        </code>
                      </GlassTD>
                      <GlassTD>{cert.issueDate ? formatDate(cert.issueDate) : '—'}</GlassTD>
                      <GlassTD>
                        <GlassButton
                          onClick={() => downloadCertificate.mutate(cert.id)}
                          disabled={downloadCertificate.isPending}
                          variant="ghost"
                          size="sm"
                        >
                          {downloadingId === cert.id ? t('certificates.downloading') : t('certificates.download')}
                        </GlassButton>
                      </GlassTD>
                    </GlassTR>
                  ))}
                </GlassTBody>
              </GlassTable>
            </div>
          )}
        </GlassCard>
      )}

      {activeTab === 'templates' && (
        <GlassCard>
          {templates.isLoading ? (
            <div className="p-8">
              <GlassPageLoader />
            </div>
          ) : templates.isError ? (
            <GlassErrorState
              message={getErrorMessage(templates.error)}
              onRetry={() => templates.refetch()}
            />
          ) : templateList.length === 0 ? (
            <GlassEmptyState
              title={t('templates.empty')}
              description={t('templates.emptyHint')}
              action={{ label: t('templates.new'), onClick: () => openTemplateModal() }}
            />
          ) : (
            <div className="overflow-x-auto">
              <GlassTable>
                <GlassTHead>
                  <GlassTR>
                    <GlassTH>{t('templates.col.name')}</GlassTH>
                    <GlassTH>{t('templates.col.default')}</GlassTH>
                    <GlassTH>{t('templates.col.created')}</GlassTH>
                    <GlassTH>{t('common.actions')}</GlassTH>
                  </GlassTR>
                </GlassTHead>
                <GlassTBody>
                  {templateList.map((tpl) => (
                    <GlassTR key={tpl.id}>
                      <GlassTD className="font-medium">{tpl.name}</GlassTD>
                      <GlassTD>
                        {tpl.isDefault ? (
                          <GlassBadge variant="success">{t('templates.badge.default')}</GlassBadge>
                        ) : (
                          <GlassButton
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setDefault.mutate(tpl.id)}
                            disabled={setDefault.isPending}
                          >
                            {t('templates.makeDefault')}
                          </GlassButton>
                        )}
                      </GlassTD>
                      <GlassTD>{tpl.createdAt ? formatDate(tpl.createdAt) : '—'}</GlassTD>
                      <GlassTD>
                        <div className="flex gap-2">
                          <GlassButton
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => openTemplateModal(tpl)}
                          >
                            {t('common.edit')}
                          </GlassButton>
                          <GlassButton
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeletingTemplate(tpl)}
                            disabled={deleteTemplate.isPending}
                            style={{ color: 'var(--state-error, #dc2626)' }}
                          >
                            {t('common.delete')}
                          </GlassButton>
                        </div>
                      </GlassTD>
                    </GlassTR>
                  ))}
                </GlassTBody>
              </GlassTable>
            </div>
          )}
        </GlassCard>
      )}

      {/* Certificate Generation Modal */}
      {modalOpen && (
        <GlassModal
          open={modalOpen}
          onClose={closeModal}
          title={t('certificates.generate')}
        >
          <div className="space-y-4">
            <GlassField label={t('certificates.field.student')} error={formErrors.studentId ? t(formErrors.studentId) : undefined}>
              <GlassSelect
                value={form.studentId}
                onChange={(e) => setForm({ ...form, studentId: e.target.value })}
              >
                <option value="">{t('certificates.selectStudent')}</option>
                {studentList.map((student) => (
                  <option key={student.id} value={student.id}>
                    {formatStudentName(student)}
                  </option>
                ))}
              </GlassSelect>
            </GlassField>

            <GlassField label={t('certificates.field.course')} error={formErrors.courseId ? t(formErrors.courseId) : undefined}>
              <GlassSelect
                value={form.courseId}
                onChange={(e) => setForm({ ...form, courseId: e.target.value })}
              >
                <option value="">{t('certificates.selectCourse')}</option>
                {courseList.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name}
                  </option>
                ))}
              </GlassSelect>
            </GlassField>

            <GlassField label={t('certificates.field.notes')} error={formErrors.notes ? t(formErrors.notes) : undefined}>
              <GlassTextArea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder={t('certificates.notesPlaceholder')}
                rows={3}
              />
            </GlassField>

            <p className="text-xs text-[var(--text-muted)]">
              {t('certificates.generateHint')}
            </p>

            <div className="flex gap-2 justify-end pt-4">
              <GlassButton
                variant="secondary"
                onClick={closeModal}
              >
                {t('common.cancel')}
              </GlassButton>
              <GlassButton
                variant="primary"
                onClick={handleCertificateSubmit}
                disabled={generateCertificate.isPending}
              >
                {generateCertificate.isPending ? t('certificates.generating') : t('certificates.generateAction')}
              </GlassButton>
            </div>
          </div>
        </GlassModal>
      )}

      {/* Template Create/Edit Modal */}
      {templateModalOpen && (
        <GlassModal
          open={templateModalOpen}
          onClose={closeTemplateModal}
          title={editingTemplate ? t('templates.edit', { name: editingTemplate.name }) : t('templates.createTitle')}
          wide
        >
          <div className="space-y-4">
            <GlassField label={t('templates.field.name')} error={templateFormErrors.name ? t(templateFormErrors.name) : undefined}>
              <GlassInput
                value={templateForm.name}
                onChange={(e) => {
                  setTemplateForm((prev) => ({ ...prev, name: e.target.value }));
                  setTemplateFormErrors((prev) => ({ ...prev, name: undefined }));
                }}
                placeholder={t('templates.namePlaceholder')}
                aria-invalid={Boolean(templateFormErrors.name)}
                maxLength={200}
              />
            </GlassField>

            <GlassField
              label={t('templates.field.html')}
              error={templateFormErrors.htmlTemplate ? t(templateFormErrors.htmlTemplate) : undefined}
            >
              <GlassTextArea
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
                {t('templates.variablesHint', {
                  variables: TEMPLATE_VARIABLES.map((v) => `{{${v}}}`).join(', '),
                })}
              </p>
            </GlassField>

            <GlassField label={t('templates.field.css')} error={templateFormErrors.cssStyles ? t(templateFormErrors.cssStyles) : undefined}>
              <GlassTextArea
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
            </GlassField>

            <GlassSwitch
              checked={templateForm.isDefault}
              onChange={(checked) =>
                setTemplateForm((prev) => ({ ...prev, isDefault: checked }))
              }
              aria-label={t('templates.field.isDefault')}
            />
            <span className="text-sm text-[var(--text-primary)]">
              {t('templates.field.isDefault')}
            </span>

            <div className="flex gap-2 justify-end pt-4">
              <GlassButton
                variant="secondary"
                onClick={closeTemplateModal}
                disabled={saveTemplate.isPending}
              >
                {t('common.cancel')}
              </GlassButton>
              <GlassButton
                variant="primary"
                onClick={handleTemplateSubmit}
                disabled={saveTemplate.isPending}
              >
                {saveTemplate.isPending
                  ? t('templates.saving')
                  : editingTemplate
                    ? t('templates.saveChanges')
                    : t('templates.createAction')}
              </GlassButton>
            </div>
          </div>
        </GlassModal>
      )}

      {/* Template Delete Confirmation */}
      {deletingTemplate && (
        <GlassModal
          open={Boolean(deletingTemplate)}
          onClose={() => setDeletingTemplate(null)}
          title={t('templates.deleteTitle')}
        >
          <div className="space-y-4">
            <p className="text-sm text-[var(--text-primary)]">
              {t('templates.deleteConfirm', { name: deletingTemplate.name })}
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              {t('templates.deleteHint')}
            </p>
            <div className="flex gap-2 justify-end pt-2">
              <GlassButton
                variant="secondary"
                onClick={() => setDeletingTemplate(null)}
                disabled={deleteTemplate.isPending}
              >
                {t('common.cancel')}
              </GlassButton>
              <GlassButton
                variant="primary"
                onClick={() => deleteTemplate.mutate(deletingTemplate.id)}
                disabled={deleteTemplate.isPending}
                style={{ background: 'var(--state-error, #dc2626)' }}
              >
                {deleteTemplate.isPending ? t('templates.deleting') : t('templates.deleteAction')}
              </GlassButton>
            </div>
          </div>
        </GlassModal>
      )}
      </div>
    </div>
  );
}
