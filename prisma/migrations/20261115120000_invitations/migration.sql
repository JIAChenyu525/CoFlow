-- CreateEnum
CREATE TYPE "public"."InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'REVOKED');

-- CreateTable
CREATE TABLE "public"."project_invitations" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "inviteeId" TEXT NOT NULL,
    "role" "public"."ProjectRole" NOT NULL DEFAULT 'MEMBER',
    "status" "public"."InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "project_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_invitations_inviteeId_status_idx" ON "public"."project_invitations"("inviteeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "project_invitations_projectId_inviteeId_key" ON "public"."project_invitations"("projectId", "inviteeId");

-- AddForeignKey
ALTER TABLE "public"."project_invitations" ADD CONSTRAINT "project_invitations_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."project_invitations" ADD CONSTRAINT "project_invitations_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."project_invitations" ADD CONSTRAINT "project_invitations_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

