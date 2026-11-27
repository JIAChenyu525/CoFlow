-- AlterTable
ALTER TABLE "public"."messages" ADD COLUMN     "agentOwnerId" TEXT,
ADD COLUMN     "authorType" TEXT NOT NULL DEFAULT 'HUMAN';

-- CreateTable
CREATE TABLE "public"."assistant_requests" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'general',
    "prompt" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reply" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "assistant_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assistant_requests_userId_status_idx" ON "public"."assistant_requests"("userId", "status");

-- AddForeignKey
ALTER TABLE "public"."messages" ADD CONSTRAINT "messages_agentOwnerId_fkey" FOREIGN KEY ("agentOwnerId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."assistant_requests" ADD CONSTRAINT "assistant_requests_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."assistant_requests" ADD CONSTRAINT "assistant_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

