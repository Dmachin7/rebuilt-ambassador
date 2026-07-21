-- AlterTable
-- New events default to 15 minutes of setup time instead of 30 (still editable per event).
ALTER TABLE "Event" ALTER COLUMN "setupTimeMins" SET DEFAULT 15;
