CREATE UNIQUE INDEX "FaceEnrollment_active_pending_idx" ON "FaceEnrollment"("organizationId", "studentId") WHERE status IN ('ACTIVE', 'PENDING');
