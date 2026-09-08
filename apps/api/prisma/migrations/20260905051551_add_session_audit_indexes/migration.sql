-- CreateIndex
CREATE INDEX "FaceAuditEvent_userId_idx" ON "FaceAuditEvent"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
