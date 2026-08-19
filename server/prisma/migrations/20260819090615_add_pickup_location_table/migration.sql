-- CreateTable
CREATE TABLE "PickupLocation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PickupLocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PickupLocation_name_key" ON "PickupLocation"("name");

-- Seed with the list that was previously hardcoded in EventFormModal.jsx, so the picker's
-- options are unchanged the first time this deploys.
INSERT INTO "PickupLocation" ("id", "name", "updatedAt") VALUES
  (gen_random_uuid()::text, 'Burn Boot Camp Brandon', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Cigar City CrossFit', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'F45 Training Lakeland Highlands', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'F45 Training Riverview', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'ReBuilt Downstairs Fridge', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Neighborly Care Network', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Bayshore Fit', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Burn Boot Camp South Tampa', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'CAMP Tampa', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Perform24 Tampa', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Burg CrossFit Downtown', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'CrossFit St. Pete', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Elevate St. Pete', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Sunshine City CrossFit', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'CrossFit Aero', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'F45 Training Wiregrass', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Fit Body Boot Camp - Lutz', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Fit24 Tampa', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Anytime Fitness Clearwater', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'F45 Training Largo East', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'F45 Training Midtown Tampa', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'TrYumph Fitness Largo', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'CAMP Tampa 2nd Delivery', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'CAMP Tampa 3rd Delivery', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Nutrishop South Tampa', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Lexus', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Anytime Fitness Tarpon Springs', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Level Up Westchase', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Seven Springs CrossFit', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Train Harder CrossFit', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Burn Boot Camp Apollo Beach', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'CrossFit Manatee', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'F45 Training Sarasota UTC', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'MAD Nutrition & Smoothies', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'CrossFit Brooksville', CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;
