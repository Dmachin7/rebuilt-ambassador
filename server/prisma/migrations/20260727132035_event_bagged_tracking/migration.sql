-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "baggedAndSent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "baggedByUserId" TEXT;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_baggedByUserId_fkey" FOREIGN KEY ("baggedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

