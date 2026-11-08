const fs = require('fs');
const path = require('path');

const schemaPath = path.resolve('apps/api/prisma/schema.prisma');
let content = fs.readFileSync(schemaPath, 'utf8');

// 1. In model Organization, add arenaQuestions if not present
if (!content.includes('arenaQuestions')) {
  content = content.replace(
    /duelRooms\s+DuelRoom\[\]/,
    `duelRooms               DuelRoom[]\n  arenaQuestions          ArenaQuestion[]`
  );
  console.log('Added arenaQuestions to Organization');
}

// 2. In model User, add authoredArenaQuestions and reviewedArenaQuestions
if (!content.includes('authoredArenaQuestions')) {
  content = content.replace(
    /cashShifts\s+CashShift\[\]\s+@relation\("CashierShifts"\)/,
    `cashShifts                                                     CashShift[]              @relation("CashierShifts")\n  authoredArenaQuestions                                         ArenaQuestion[]          @relation("ArenaQuestionAuthor")\n  reviewedArenaQuestions                                         ArenaQuestion[]          @relation("ArenaQuestionReviewer")`
  );
  console.log('Added authored/reviewed ArenaQuestions to User');
}

// 3. In model Student, add duelRoundAnswers
if (!content.includes('duelRoundAnswers')) {
  content = content.replace(
    /duelParticipations\s+DuelParticipant\[\]/,
    `duelParticipations      DuelParticipant[]\n  duelRoundAnswers        DuelRoundAnswer[]`
  );
  console.log('Added duelRoundAnswers to Student');
}

// 4. In model DuelRoom, add rounds
if (!content.includes('rounds           DuelRound[]')) {
  content = content.replace(
    /participants\s+DuelParticipant\[\]/,
    `participants     DuelParticipant[]\n  rounds           DuelRound[]`
  );
  console.log('Added rounds to DuelRoom');
}

// 5. Append Arena Question Enums and Models if not already added
if (!content.includes('enum ArenaQuestionStatus')) {
  const newModels = `
// ============================================================================
// MIND ARENA: QUESTION ENGINE & DUEL ROUND SNAPSHOTS (PHASE 2)
// ============================================================================

enum ArenaQuestionStatus {
  DRAFT
  PENDING_REVIEW
  APPROVED
  REJECTED
  ARCHIVED
}

enum ArenaQuestionSource {
  AI_GENERATED
  TEACHER
  ADMIN
}

enum ArenaSubjectCategory {
  MATHEMATICS
  PHYSICS
  PROGRAMMING
  HISTORY
  ENGLISH
  LOGIC_PUZZLE
  GENERAL_SCIENCE
}

model ArenaQuestion {
  id               String               @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organizationId   String?              @db.Uuid
  subjectCategory  ArenaSubjectCategory
  difficulty       QuestionDifficulty   @default(MEDIUM)
  status           ArenaQuestionStatus  @default(PENDING_REVIEW)
  source           ArenaQuestionSource  @default(AI_GENERATED)
  
  questionText     String               @db.Text
  codeSnippet      String?              @db.Text
  codeLanguage     String?              @db.VarChar(32)
  imageUrl         String?              @db.Text
  explanation      String?              @db.Text
  
  version          Int                  @default(1)
  tags             String[]             @default([])
  timeLimitSec     Int                  @default(15)
  
  timesUsed        Int                  @default(0)
  correctCount     Int                  @default(0)
  
  createdById      String?              @db.Uuid
  approvedById     String?              @db.Uuid
  approvedAt       DateTime?
  rejectionReason  String?              @db.Text
  verificationLog  Json?
  
  createdAt        DateTime             @default(now())
  updatedAt        DateTime             @updatedAt

  organization     Organization?        @relation(fields: [organizationId], references: [id], onDelete: SetNull)
  createdByUser    User?                @relation("ArenaQuestionAuthor", fields: [createdById], references: [id], onDelete: SetNull)
  approvedByUser   User?                @relation("ArenaQuestionReviewer", fields: [approvedById], references: [id], onDelete: SetNull)
  
  options          ArenaQuestionOption[]
  duelRounds       DuelRound[]

  @@index([organizationId, status, difficulty])
  @@index([status, subjectCategory, difficulty])
  @@index([timesUsed, status])
}

model ArenaQuestionOption {
  id           String        @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  questionId   String        @db.Uuid
  optionKey    String        @db.VarChar(2)
  optionText   String        @db.Text
  isCorrect    Boolean       @default(false)
  explanation  String?       @db.Text
  orderIndex   Int           @default(0)
  createdAt    DateTime      @default(now())

  question     ArenaQuestion @relation(fields: [questionId], references: [id], onDelete: Cascade)

  @@unique([questionId, optionKey])
  @@index([questionId])
}

model DuelRound {
  id                String            @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  duelRoomId        String            @db.Uuid
  roundNumber       Int
  questionId        String?           @db.Uuid
  
  questionVersion   Int               @default(1)
  questionText      String            @db.Text
  codeSnippet       String?           @db.Text
  imageUrl          String?           @db.Text
  correctOptionKey  String            @db.VarChar(2)
  optionsSnapshot   Json
  
  startedAt         DateTime          @default(now())
  endedAt           DateTime?
  timeLimitSec      Int               @default(15)

  duelRoom          DuelRoom          @relation(fields: [duelRoomId], references: [id], onDelete: Cascade)
  arenaQuestion     ArenaQuestion?    @relation(fields: [questionId], references: [id], onDelete: SetNull)
  answers           DuelRoundAnswer[]

  @@unique([duelRoomId, roundNumber])
  @@index([duelRoomId])
  @@index([questionId])
}

model DuelRoundAnswer {
  id           String      @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  roundId      String      @db.Uuid
  studentId    String      @db.Uuid
  selectedKey  String?     @db.VarChar(2)
  isCorrect    Boolean     @default(false)
  timeSpentMs  Int         @default(0)
  scoreEarned  Int         @default(0)
  createdAt    DateTime    @default(now())

  round        DuelRound   @relation(fields: [roundId], references: [id], onDelete: Cascade)
  student      Student     @relation(fields: [studentId], references: [id], onDelete: Restrict)

  @@unique([roundId, studentId])
  @@index([studentId])
  @@index([roundId])
}
`;
  content = content.trimEnd() + '\n' + newModels;
  console.log('Appended Arena Question models');
}

fs.writeFileSync(schemaPath, content, 'utf8');
console.log('Successfully updated schema.prisma');
