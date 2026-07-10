-- AlterTable
-- Setup time is no longer tracked as a separate pay component: on-site hours
-- (checkin -> checkout) already include setup time, so a distinct override is unused.
ALTER TABLE "Payment" DROP COLUMN "setupTimeHoursOverride";
