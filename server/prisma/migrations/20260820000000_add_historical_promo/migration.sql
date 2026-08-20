-- CreateTable
CREATE TABLE "HistoricalPromo" (
    "id" TEXT NOT NULL,
    "ambassadorId" TEXT,
    "ambassadorName" TEXT NOT NULL,
    "promoName" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "hoursWorked" DOUBLE PRECISION NOT NULL,
    "salesCount" INTEGER NOT NULL DEFAULT 0,
    "mealsSold" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoricalPromo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HistoricalPromo_ambassadorId_idx" ON "HistoricalPromo"("ambassadorId");

-- CreateIndex
CREATE INDEX "HistoricalPromo_date_idx" ON "HistoricalPromo"("date");

-- AddForeignKey
ALTER TABLE "HistoricalPromo" ADD CONSTRAINT "HistoricalPromo_ambassadorId_fkey" FOREIGN KEY ("ambassadorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
