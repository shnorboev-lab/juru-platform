-- CreateEnum
CREATE TYPE "Role" AS ENUM ('EMPLOYEE', 'EVALUATOR', 'HR_ADMIN', 'TEAM_HEAD', 'BU_HEAD', 'MD');

-- CreateEnum
CREATE TYPE "Grade" AS ENUM ('E1', 'E2', 'E3', 'E4', 'C1', 'C2', 'C3', 'C4', 'S1', 'S2', 'S3', 'S4', 'SE1', 'SE2', 'SE3', 'SE4', 'SC1', 'SC2', 'SC3', 'SC4', 'PE', 'PC', 'M1', 'M2', 'M3', 'M4', 'SM1', 'SM2', 'SM3', 'SM4', 'D1', 'D2', 'D3', 'MD', 'I');

-- CreateEnum
CREATE TYPE "SeniorityTier" AS ENUM ('ENTRY', 'MID', 'SENIOR');

-- CreateEnum
CREATE TYPE "CycleType" AS ENUM ('SEMI_ANNUAL', 'ANNUAL');

-- CreateEnum
CREATE TYPE "CyclePhase" AS ENUM ('PREP', 'SELF_APPRAISAL', 'EVALUATION', 'CONSOLIDATION', 'INTERVIEW', 'DONE');

-- CreateEnum
CREATE TYPE "SubmissionType" AS ENUM ('SELF', 'EVAL_1', 'EVAL_2');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED');

-- CreateEnum
CREATE TYPE "PerformanceLabel" AS ENUM ('EXCEPTIONAL', 'EXCEEDS_EXPECTATIONS', 'MEETS_EXPECTATIONS', 'PARTIALLY_MEETS', 'BELOW_EXPECTATIONS');

-- CreateEnum
CREATE TYPE "SubCriterion" AS ENUM ('TIMELINE', 'QUALITY', 'CLIENT_SATISFACTION', 'TEAMWORK', 'COMMERCIAL_SUCCESS', 'TECHNICAL_SKILLS', 'PEOPLE_SKILLS', 'CONTINUOUS_LEARNING', 'DISCIPLINE', 'RELIABILITY');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'GCHAT', 'IN_APP');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "business_units" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "headId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "buId" TEXT NOT NULL,
    "headId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "grade" "Grade" NOT NULL,
    "seniorityTier" "SeniorityTier" NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'EMPLOYEE',
    "teamId" TEXT,
    "buId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_cycles" (
    "id" TEXT NOT NULL,
    "type" "CycleType" NOT NULL,
    "year" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "buId" TEXT NOT NULL,
    "phase" "CyclePhase" NOT NULL DEFAULT 'PREP',
    "selfAppraisalStart" TIMESTAMP(3) NOT NULL,
    "selfAppraisalEnd" TIMESTAMP(3) NOT NULL,
    "evaluationEnd" TIMESTAMP(3) NOT NULL,
    "consolidationEnd" TIMESTAMP(3) NOT NULL,
    "interviewEnd" TIMESTAMP(3) NOT NULL,
    "resultsReleasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignments" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "evaluator1Id" TEXT NOT NULL,
    "evaluator2Id" TEXT NOT NULL,
    "weight1" DECIMAL(4,2) NOT NULL DEFAULT 0.70,
    "weight2" DECIMAL(4,2) NOT NULL DEFAULT 0.30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submissions" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "submittedBy" TEXT NOT NULL,
    "type" "SubmissionType" NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "comment" TEXT,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scores" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "subCriterion" "SubCriterion" NOT NULL,
    "score" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "results" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "overallAvg" DECIMAL(4,2) NOT NULL,
    "performanceLabel" "PerformanceLabel" NOT NULL,
    "isAtRisk" BOOLEAN NOT NULL DEFAULT false,
    "isNominated" BOOLEAN NOT NULL DEFAULT false,
    "belowCount" INTEGER NOT NULL DEFAULT 0,
    "releasedAt" TIMESTAMP(3),
    "interviewNote" TEXT,
    "interviewDoneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sub_criterion_results" (
    "id" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "subCriterion" "SubCriterion" NOT NULL,
    "scoreE1" DECIMAL(4,2) NOT NULL,
    "scoreE2" DECIMAL(4,2) NOT NULL,
    "weightedScore" DECIMAL(4,2) NOT NULL,

    CONSTRAINT "sub_criterion_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fileKey" TEXT,
    "fileUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "event" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "business_units_name_key" ON "business_units"("name");

-- CreateIndex
CREATE UNIQUE INDEX "teams_buId_name_key" ON "teams"("buId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "employees_email_key" ON "employees"("email");

-- CreateIndex
CREATE UNIQUE INDEX "review_cycles_type_year_buId_key" ON "review_cycles"("type", "year", "buId");

-- CreateIndex
CREATE UNIQUE INDEX "assignments_cycleId_employeeId_key" ON "assignments"("cycleId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "submissions_cycleId_employeeId_type_key" ON "submissions"("cycleId", "employeeId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "scores_submissionId_subCriterion_key" ON "scores"("submissionId", "subCriterion");

-- CreateIndex
CREATE UNIQUE INDEX "results_cycleId_employeeId_key" ON "results"("cycleId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "sub_criterion_results_resultId_subCriterion_key" ON "sub_criterion_results"("resultId", "subCriterion");

-- AddForeignKey
ALTER TABLE "business_units" ADD CONSTRAINT "business_units_headId_fkey" FOREIGN KEY ("headId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_buId_fkey" FOREIGN KEY ("buId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_headId_fkey" FOREIGN KEY ("headId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_buId_fkey" FOREIGN KEY ("buId") REFERENCES "business_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_cycles" ADD CONSTRAINT "review_cycles_buId_fkey" FOREIGN KEY ("buId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "review_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_evaluator1Id_fkey" FOREIGN KEY ("evaluator1Id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_evaluator2Id_fkey" FOREIGN KEY ("evaluator2Id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "review_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_submittedBy_fkey" FOREIGN KEY ("submittedBy") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scores" ADD CONSTRAINT "scores_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "results" ADD CONSTRAINT "results_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "review_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "results" ADD CONSTRAINT "results_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sub_criterion_results" ADD CONSTRAINT "sub_criterion_results_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "review_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
