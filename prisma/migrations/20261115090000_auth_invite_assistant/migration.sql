-- AlterTable
ALTER TABLE "public"."projects" ADD COLUMN     "inviteCode" TEXT;

-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN     "passwordHash" TEXT,
ADD COLUMN     "preferredEndpointId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "projects_inviteCode_key" ON "public"."projects"("inviteCode");

