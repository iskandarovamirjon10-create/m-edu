CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
id UUID NOT NULL DEFAULT gen_random_uuid(),
"userId" UUID NOT NULL,
"tokenHash" TEXT NOT NULL,
"expiresAt" TIMESTAMP(3) NOT NULL,
"usedAt" TIMESTAMP(3),
"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY (id)
);
CREATE UNIQUE INDEX IF NOT EXISTS "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");
CREATE INDEX IF NOT EXISTS "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");
CREATE INDEX IF NOT EXISTS "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS "AuthorizationCode" (
id UUID NOT NULL DEFAULT gen_random_uuid(),
code TEXT NOT NULL,
"accessToken" TEXT NOT NULL,
"expiresAt" TIMESTAMP(3) NOT NULL,
"usedAt" TIMESTAMP(3),
"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
"userId" UUID NOT NULL,

CONSTRAINT "AuthorizationCode_pkey" PRIMARY KEY (id)
);
CREATE UNIQUE INDEX IF NOT EXISTS "AuthorizationCode_code_key" ON "AuthorizationCode"(code);
CREATE INDEX IF NOT EXISTS "AuthorizationCode_expiresAt_idx" ON "AuthorizationCode"("expiresAt");
CREATE INDEX IF NOT EXISTS "AuthorizationCode_userId_idx" ON "AuthorizationCode"("userId");
ALTER TABLE "AuthorizationCode" ADD CONSTRAINT "AuthorizationCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE;
