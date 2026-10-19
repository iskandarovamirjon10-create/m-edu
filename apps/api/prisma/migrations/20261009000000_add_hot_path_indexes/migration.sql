-- Additive hot-path indexes.
--
-- Prisma does not index foreign-key columns automatically on PostgreSQL, so
-- these high-traffic lookups currently fall back to sequential scans. Every
-- statement is idempotent and matches the new `@@index` entries in
-- schema.prisma (Prisma default naming: <table>_<column>_idx) so the
-- schema <-> migration drift check stays green.

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StudentGroup_organizationId_idx" ON "StudentGroup"("organizationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SecurityEvent_userId_idx" ON "SecurityEvent"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SecurityEvent_resourceId_idx" ON "SecurityEvent"("resourceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SecurityEvent_correlationId_idx" ON "SecurityEvent"("correlationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "NotificationDelivery_eventId_idx" ON "NotificationDelivery"("eventId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "NotificationDelivery_entityId_idx" ON "NotificationDelivery"("entityId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "NotificationDelivery_principalId_idx" ON "NotificationDelivery"("principalId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Attendance_cameraId_idx" ON "Attendance"("cameraId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Attendance_deviceId_idx" ON "Attendance"("deviceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Attendance_recognitionAttemptId_idx" ON "Attendance"("recognitionAttemptId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RecognitionSession_deviceId_idx" ON "RecognitionSession"("deviceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RecognitionSession_actorId_idx" ON "RecognitionSession"("actorId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RecognitionSession_lessonId_idx" ON "RecognitionSession"("lessonId");
