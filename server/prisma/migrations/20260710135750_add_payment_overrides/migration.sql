-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "onSiteHoursOverride" DOUBLE PRECISION,
ADD COLUMN     "driveTimeHoursOverride" DOUBLE PRECISION,
ADD COLUMN     "setupTimeHoursOverride" DOUBLE PRECISION,
ADD COLUMN     "milesOverride" DOUBLE PRECISION,
ADD COLUMN     "salesOverride" INTEGER,
ADD COLUMN     "commissionOverride" DOUBLE PRECISION;
