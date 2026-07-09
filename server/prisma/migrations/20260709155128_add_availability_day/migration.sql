-- CreateEnum
CREATE TYPE "AvailabilityStatus" AS ENUM ('OPEN', 'UNAVAILABLE', 'OTHER');

-- CreateTable
CREATE TABLE "AvailabilityDay" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "AvailabilityStatus" NOT NULL DEFAULT 'OPEN',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvailabilityDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AvailabilityDay_userId_date_key" ON "AvailabilityDay"("userId", "date");

-- AddForeignKey
ALTER TABLE "AvailabilityDay" ADD CONSTRAINT "AvailabilityDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
