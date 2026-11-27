-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."ProjectStage" AS ENUM ('DEFINE', 'BUILD', 'INTEGRATE', 'REVIEW', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "public"."ProjectRole" AS ENUM ('OWNER', 'LEAD', 'MEMBER', 'REVIEWER', 'OBSERVER');

-- CreateEnum
CREATE TYPE "public"."TaskStatus" AS ENUM ('CLARIFY', 'UNCLAIMED', 'READY', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED', 'PAUSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."Priority" AS ENUM ('P0', 'P1', 'P2', 'P3');

-- CreateEnum
CREATE TYPE "public"."MessageType" AS ENUM ('TEXT', 'TASK_REF', 'DECISION_PROPOSAL', 'BLOCKER', 'ARTIFACT_SUBMIT', 'SYSTEM', 'AGENT_REPORT');

-- CreateEnum
CREATE TYPE "public"."DecisionStatus" AS ENUM ('PROPOSED', 'CONFIRMED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "public"."ArtifactType" AS ENUM ('COMMIT', 'BUILD', 'DOC', 'DESIGN', 'IMAGE', 'DATA', 'TEST_REPORT', 'LINK', 'NOTE');

-- CreateEnum
CREATE TYPE "public"."ReviewVerdict" AS ENUM ('PASS', 'RETURN', 'NEED_MORE');

-- CreateEnum
CREATE TYPE "public"."MilestoneStatus" AS ENUM ('PLANNED', 'ACTIVE', 'DONE');

-- CreateEnum
CREATE TYPE "public"."ActorType" AS ENUM ('HUMAN', 'AGENT_SESSION', 'SYSTEM');

-- CreateEnum
CREATE TYPE "public"."Capability" AS ENUM ('AUTO', 'SEMI', 'MANUAL');

-- CreateEnum
CREATE TYPE "public"."LeaseStatus" AS ENUM ('OFFERED', 'ACCEPTED', 'ACTIVE', 'SUBMITTED', 'EXPIRED', 'REVOKED');

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "email" TEXT,
    "color" TEXT NOT NULL DEFAULT '#0F5F5C',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."login_codes" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "userAgent" TEXT,
    "ip" TEXT,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."devices" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "os" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."device_pairings" (
    "id" TEXT NOT NULL,
    "deviceCode" TEXT NOT NULL,
    "userCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "os" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "userId" TEXT,
    "interval" INTEGER NOT NULL DEFAULT 3,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),

    CONSTRAINT "device_pairings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."agent_endpoints" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "projectId" TEXT,
    "toolType" TEXT NOT NULL,
    "toolVersion" TEXT NOT NULL DEFAULT 'unknown',
    "capability" "public"."Capability" NOT NULL DEFAULT 'MANUAL',
    "status" TEXT NOT NULL DEFAULT 'ONLINE',
    "allowedPaths" JSONB NOT NULL DEFAULT '[]',
    "headlessOk" BOOLEAN NOT NULL DEFAULT false,
    "capabilityNote" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_endpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "stage" "public"."ProjectStage" NOT NULL DEFAULT 'DEFINE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."memberships" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "public"."ProjectRole" NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."charters" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "goal" TEXT NOT NULL,
    "targetUsers" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "nonGoals" TEXT NOT NULL,
    "constraints" TEXT NOT NULL,
    "acceptance" TEXT NOT NULL,
    "decisionMakerId" TEXT,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "charters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."milestones" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "status" "public"."MilestoneStatus" NOT NULL DEFAULT 'PLANNED',
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tasks" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "milestoneId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "inputs" TEXT NOT NULL DEFAULT '',
    "scope" TEXT NOT NULL DEFAULT '',
    "nonScope" TEXT NOT NULL DEFAULT '',
    "acceptance" TEXT NOT NULL DEFAULT '',
    "priority" "public"."Priority" NOT NULL DEFAULT 'P2',
    "status" "public"."TaskStatus" NOT NULL DEFAULT 'CLARIFY',
    "assigneeId" TEXT,
    "reviewerId" TEXT,
    "dueDate" TIMESTAMP(3),
    "weight" INTEGER NOT NULL DEFAULT 1,
    "blockedReason" TEXT,
    "blockedNeeds" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."task_dependencies" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "dependsOnTaskId" TEXT NOT NULL,

    CONSTRAINT "task_dependencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."messages" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "taskId" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'general',
    "type" "public"."MessageType" NOT NULL DEFAULT 'TEXT',
    "body" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."decisions" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "taskId" TEXT,
    "title" TEXT NOT NULL,
    "conclusion" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "alternatives" TEXT NOT NULL DEFAULT '',
    "impact" TEXT NOT NULL DEFAULT '',
    "status" "public"."DecisionStatus" NOT NULL DEFAULT 'PROPOSED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "decidedById" TEXT,
    "supersedesId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."artifacts" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "taskId" TEXT,
    "type" "public"."ArtifactType" NOT NULL,
    "title" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT 'v1',
    "hash" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "submittedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."reviews" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "artifactId" TEXT,
    "verdict" "public"."ReviewVerdict" NOT NULL,
    "criteriaNotes" TEXT NOT NULL DEFAULT '',
    "comment" TEXT NOT NULL DEFAULT '',
    "reviewerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."context_snapshots" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "endpointId" TEXT,
    "hash" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "packageJson" JSONB NOT NULL,
    "tokens" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "context_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."task_leases" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "endpointId" TEXT NOT NULL,
    "contextSnapshotId" TEXT NOT NULL,
    "status" "public"."LeaseStatus" NOT NULL DEFAULT 'OFFERED',
    "declaredPaths" JSONB NOT NULL DEFAULT '[]',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),

    CONSTRAINT "task_leases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."agent_sessions" (
    "id" TEXT NOT NULL,
    "leaseId" TEXT NOT NULL,
    "endpointId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "contextSnapshotId" TEXT NOT NULL,
    "contextHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastHeartbeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "agent_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."project_events" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "clientEventId" TEXT,
    "sessionId" TEXT,
    "type" TEXT NOT NULL,
    "actorType" "public"."ActorType" NOT NULL,
    "actorId" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'web',
    "correlationId" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'project',
    "schemaVersion" TEXT NOT NULL DEFAULT '1.0',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_handle_key" ON "public"."users"("handle");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE INDEX "login_codes_email_createdAt_idx" ON "public"."login_codes"("email", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_tokenHash_key" ON "public"."sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "public"."sessions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "devices_tokenHash_key" ON "public"."devices"("tokenHash");

-- CreateIndex
CREATE INDEX "devices_userId_idx" ON "public"."devices"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "device_pairings_deviceCode_key" ON "public"."device_pairings"("deviceCode");

-- CreateIndex
CREATE UNIQUE INDEX "device_pairings_userCode_key" ON "public"."device_pairings"("userCode");

-- CreateIndex
CREATE INDEX "device_pairings_status_expiresAt_idx" ON "public"."device_pairings"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "agent_endpoints_deviceId_idx" ON "public"."agent_endpoints"("deviceId");

-- CreateIndex
CREATE INDEX "agent_endpoints_projectId_idx" ON "public"."agent_endpoints"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "projects_key_key" ON "public"."projects"("key");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_projectId_userId_key" ON "public"."memberships"("projectId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "charters_projectId_version_key" ON "public"."charters"("projectId", "version");

-- CreateIndex
CREATE INDEX "tasks_projectId_status_idx" ON "public"."tasks"("projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "task_dependencies_taskId_dependsOnTaskId_key" ON "public"."task_dependencies"("taskId", "dependsOnTaskId");

-- CreateIndex
CREATE INDEX "messages_projectId_channel_createdAt_idx" ON "public"."messages"("projectId", "channel", "createdAt");

-- CreateIndex
CREATE INDEX "decisions_projectId_status_idx" ON "public"."decisions"("projectId", "status");

-- CreateIndex
CREATE INDEX "artifacts_projectId_idx" ON "public"."artifacts"("projectId");

-- CreateIndex
CREATE INDEX "reviews_taskId_idx" ON "public"."reviews"("taskId");

-- CreateIndex
CREATE INDEX "context_snapshots_taskId_createdAt_idx" ON "public"."context_snapshots"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "task_leases_endpointId_status_idx" ON "public"."task_leases"("endpointId", "status");

-- CreateIndex
CREATE INDEX "task_leases_taskId_idx" ON "public"."task_leases"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "agent_sessions_leaseId_key" ON "public"."agent_sessions"("leaseId");

-- CreateIndex
CREATE INDEX "agent_sessions_endpointId_status_idx" ON "public"."agent_sessions"("endpointId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "project_events_clientEventId_key" ON "public"."project_events"("clientEventId");

-- CreateIndex
CREATE INDEX "project_events_projectId_occurredAt_idx" ON "public"."project_events"("projectId", "occurredAt");

-- CreateIndex
CREATE INDEX "project_events_projectId_type_idx" ON "public"."project_events"("projectId", "type");

-- AddForeignKey
ALTER TABLE "public"."sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."devices" ADD CONSTRAINT "devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."agent_endpoints" ADD CONSTRAINT "agent_endpoints_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "public"."devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."agent_endpoints" ADD CONSTRAINT "agent_endpoints_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."memberships" ADD CONSTRAINT "memberships_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."memberships" ADD CONSTRAINT "memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."charters" ADD CONSTRAINT "charters_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."milestones" ADD CONSTRAINT "milestones_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tasks" ADD CONSTRAINT "tasks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tasks" ADD CONSTRAINT "tasks_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "public"."milestones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tasks" ADD CONSTRAINT "tasks_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tasks" ADD CONSTRAINT "tasks_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."task_dependencies" ADD CONSTRAINT "task_dependencies_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "public"."tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."task_dependencies" ADD CONSTRAINT "task_dependencies_dependsOnTaskId_fkey" FOREIGN KEY ("dependsOnTaskId") REFERENCES "public"."tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."messages" ADD CONSTRAINT "messages_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."messages" ADD CONSTRAINT "messages_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "public"."tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."messages" ADD CONSTRAINT "messages_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."decisions" ADD CONSTRAINT "decisions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."decisions" ADD CONSTRAINT "decisions_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "public"."tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."decisions" ADD CONSTRAINT "decisions_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."decisions" ADD CONSTRAINT "decisions_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "public"."decisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."artifacts" ADD CONSTRAINT "artifacts_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."artifacts" ADD CONSTRAINT "artifacts_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "public"."tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."artifacts" ADD CONSTRAINT "artifacts_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reviews" ADD CONSTRAINT "reviews_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "public"."tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reviews" ADD CONSTRAINT "reviews_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "public"."artifacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reviews" ADD CONSTRAINT "reviews_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."context_snapshots" ADD CONSTRAINT "context_snapshots_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "public"."tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."task_leases" ADD CONSTRAINT "task_leases_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "public"."tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."task_leases" ADD CONSTRAINT "task_leases_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "public"."agent_endpoints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."agent_sessions" ADD CONSTRAINT "agent_sessions_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "public"."task_leases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."agent_sessions" ADD CONSTRAINT "agent_sessions_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "public"."agent_endpoints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."agent_sessions" ADD CONSTRAINT "agent_sessions_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "public"."tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."project_events" ADD CONSTRAINT "project_events_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

