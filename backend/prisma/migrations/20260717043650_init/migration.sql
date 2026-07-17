-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "CalcStatus" AS ENUM ('OK', 'WARN', 'DANGER');

-- CreateEnum
CREATE TYPE "CalcTrend" AS ENUM ('UP', 'DOWN', 'FLAT');

-- CreateEnum
CREATE TYPE "ImportFileType" AS ENUM ('ITEMS_RAW', 'PURCHASE_LINES');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PREVIEW', 'COMMITTED', 'FAILED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_history" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "usernameAttempted" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items" (
    "id" SERIAL NOT NULL,
    "itemNoRaw" TEXT NOT NULL,
    "itemNoNormalized" TEXT NOT NULL,
    "description" TEXT,
    "class" TEXT,
    "category" TEXT,
    "dimension" TEXT,
    "purchasePrice" DOUBLE PRECISION,
    "unitCost" DOUBLE PRECISION,
    "vendor" TEXT,
    "poQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stockQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "backorderQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "leadTimeDays" DOUBLE PRECISION,
    "avgMonth" DOUBLE PRECISION,
    "minUsage" DOUBLE PRECISION,
    "maxUsage" DOUBLE PRECISION,
    "oldMin" DOUBLE PRECISION,
    "sumMin" DOUBLE PRECISION,
    "next1" DOUBLE PRECISION,
    "next2" DOUBLE PRECISION,
    "next3" DOUBLE PRECISION,
    "next4" DOUBLE PRECISION,
    "next5" DOUBLE PRECISION,
    "calcStatus" "CalcStatus",
    "calcTrend" "CalcTrend",
    "recommendedMin" DOUBLE PRECISION,
    "suggestedOrderQty" DOUBLE PRECISION,
    "mustOrderByDate" TIMESTAMP(3),
    "prQtySuggested" DOUBLE PRECISION,
    "prQtyCurrent" DOUBLE PRECISION,
    "prIsOverride" BOOLEAN NOT NULL DEFAULT false,
    "remark" TEXT,
    "forModel" TEXT,
    "lastImportedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_usage_history" (
    "id" SERIAL NOT NULL,
    "itemId" INTEGER NOT NULL,
    "monthIndex" INTEGER NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "item_usage_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_yearly_sales" (
    "id" SERIAL NOT NULL,
    "itemId" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "item_yearly_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_lines" (
    "id" SERIAL NOT NULL,
    "itemNoNormalized" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "quantityReceived" DOUBLE PRECISION NOT NULL,
    "outstandingQty" DOUBLE PRECISION NOT NULL,
    "expectedReceiptDate" TIMESTAMP(3),
    "bucketMonth" INTEGER,
    "importBatchId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_batches" (
    "id" SERIAL NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" "ImportFileType" NOT NULL,
    "uploadedById" INTEGER NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rowCount" INTEGER NOT NULL,
    "status" "ImportStatus" NOT NULL,
    "errorLog" JSONB,

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packing_unit_rules" (
    "id" SERIAL NOT NULL,
    "itemNoNormalized" TEXT NOT NULL,
    "multipleOf" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "packing_unit_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" SERIAL NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "action" "AuditAction" NOT NULL,
    "changedById" INTEGER NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "login_history_userId_idx" ON "login_history"("userId");

-- CreateIndex
CREATE INDEX "login_history_createdAt_idx" ON "login_history"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "items_itemNoNormalized_key" ON "items"("itemNoNormalized");

-- CreateIndex
CREATE UNIQUE INDEX "item_usage_history_itemId_monthIndex_key" ON "item_usage_history"("itemId", "monthIndex");

-- CreateIndex
CREATE UNIQUE INDEX "item_yearly_sales_itemId_year_key" ON "item_yearly_sales"("itemId", "year");

-- CreateIndex
CREATE INDEX "purchase_lines_itemNoNormalized_idx" ON "purchase_lines"("itemNoNormalized");

-- CreateIndex
CREATE INDEX "purchase_lines_importBatchId_idx" ON "purchase_lines"("importBatchId");

-- CreateIndex
CREATE UNIQUE INDEX "packing_unit_rules_itemNoNormalized_key" ON "packing_unit_rules"("itemNoNormalized");

-- CreateIndex
CREATE INDEX "audit_log_entityType_entityId_idx" ON "audit_log"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_log_changedAt_idx" ON "audit_log"("changedAt");

-- AddForeignKey
ALTER TABLE "login_history" ADD CONSTRAINT "login_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_usage_history" ADD CONSTRAINT "item_usage_history_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_yearly_sales" ADD CONSTRAINT "item_yearly_sales_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_lines" ADD CONSTRAINT "purchase_lines_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packing_unit_rules" ADD CONSTRAINT "packing_unit_rules_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
