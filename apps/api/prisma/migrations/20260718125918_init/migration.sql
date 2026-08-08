-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('ACTIVE', 'PENDING_PAYMENT', 'PAID', 'CLOSED', 'CANCELLED', 'INCIDENT');

-- CreateEnum
CREATE TYPE "ShiftStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "CashMovementType" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('CONFIRMED', 'VOIDED');

-- CreateEnum
CREATE TYPE "CustomerKind" AS ENUM ('PERSON', 'COMPANY');

-- CreateEnum
CREATE TYPE "AgreementStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'SUSPENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('PENDING', 'SENT', 'ACCEPTED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "pinHash" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "vehicle_types" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "vehicle_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parking_sessions" (
    "id" TEXT NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "plate" TEXT NOT NULL,
    "isTempPlate" BOOLEAN NOT NULL DEFAULT false,
    "vehicleTypeId" TEXT NOT NULL,
    "color" TEXT,
    "brand" TEXT,
    "spotNumber" TEXT,
    "driverIdNumber" TEXT,
    "photoUrl" TEXT,
    "notes" TEXT,
    "entryAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exitAt" TIMESTAMP(3),
    "entryOperatorId" TEXT NOT NULL,
    "exitOperatorId" TEXT,
    "tariffVersionId" TEXT,
    "billedMinutes" INTEGER,
    "subtotal" INTEGER,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "tax" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER,
    "calculationSnapshot" JSONB,
    "lostTicket" BOOLEAN NOT NULL DEFAULT false,
    "subscriptionId" TEXT,
    "agreementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parking_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_reprints" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_reprints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tariffs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vehicleTypeId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tariffs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tariff_versions" (
    "id" TEXT NOT NULL,
    "tariffId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "rules" JSONB NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validTo" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tariff_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shifts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ShiftStatus" NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "openingCash" INTEGER NOT NULL,
    "expectedCash" INTEGER,
    "countedCash" INTEGER,
    "difference" INTEGER,
    "closingNotes" TEXT,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_movements" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "type" "CashMovementType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_methods" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isCash" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'CONFIRMED',
    "amount" INTEGER NOT NULL,
    "receivedAmount" INTEGER,
    "changeAmount" INTEGER,
    "idempotencyKey" TEXT NOT NULL,
    "voidReason" TEXT,
    "voidedById" TEXT,
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_allocations" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "paymentMethodId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reference" TEXT,

    CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "kind" "CustomerKind" NOT NULL DEFAULT 'PERSON',
    "name" TEXT NOT NULL,
    "idNumber" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agreements" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "AgreementStatus" NOT NULL DEFAULT 'ACTIVE',
    "discountPct" INTEGER NOT NULL DEFAULT 0,
    "flatDiscount" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "agreements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "plate" TEXT NOT NULL,
    "vehicleTypeId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "price" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL DEFAULT 'mock',
    "providerRef" TEXT,
    "payload" JSONB,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT,
    "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN',
    "kind" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "resolvedBy" TEXT,
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "authorizerId" TEXT,
    "action" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "oldValue" JSONB,
    "newValue" JSONB,
    "reason" TEXT,
    "terminal" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "counters" (
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "counters_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_types_code_key" ON "vehicle_types"("code");

-- CreateIndex
CREATE INDEX "parking_sessions_plate_idx" ON "parking_sessions"("plate");

-- CreateIndex
CREATE INDEX "parking_sessions_status_idx" ON "parking_sessions"("status");

-- CreateIndex
CREATE INDEX "parking_sessions_entryAt_idx" ON "parking_sessions"("entryAt");

-- CreateIndex
CREATE INDEX "parking_sessions_exitAt_idx" ON "parking_sessions"("exitAt");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_code_key" ON "tickets"("code");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_sessionId_key" ON "tickets"("sessionId");

-- CreateIndex
CREATE INDEX "tickets_code_idx" ON "tickets"("code");

-- CreateIndex
CREATE UNIQUE INDEX "tariff_versions_tariffId_version_key" ON "tariff_versions"("tariffId", "version");

-- CreateIndex
CREATE INDEX "shifts_status_idx" ON "shifts"("status");

-- CreateIndex
CREATE INDEX "shifts_openedAt_idx" ON "shifts"("openedAt");

-- CreateIndex
CREATE UNIQUE INDEX "payment_methods_code_key" ON "payment_methods"("code");

-- CreateIndex
CREATE UNIQUE INDEX "payments_receiptNumber_key" ON "payments"("receiptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotencyKey_key" ON "payments"("idempotencyKey");

-- CreateIndex
CREATE INDEX "payments_shiftId_idx" ON "payments"("shiftId");

-- CreateIndex
CREATE INDEX "payments_createdAt_idx" ON "payments"("createdAt");

-- CreateIndex
CREATE INDEX "customers_idNumber_idx" ON "customers"("idNumber");

-- CreateIndex
CREATE INDEX "subscriptions_plate_idx" ON "subscriptions"("plate");

-- CreateIndex
CREATE INDEX "subscriptions_endsAt_idx" ON "subscriptions"("endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_number_key" ON "invoices"("number");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_sessionId_key" ON "invoices"("sessionId");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_entityId_idx" ON "audit_logs"("entityId");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parking_sessions" ADD CONSTRAINT "parking_sessions_vehicleTypeId_fkey" FOREIGN KEY ("vehicleTypeId") REFERENCES "vehicle_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parking_sessions" ADD CONSTRAINT "parking_sessions_entryOperatorId_fkey" FOREIGN KEY ("entryOperatorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parking_sessions" ADD CONSTRAINT "parking_sessions_exitOperatorId_fkey" FOREIGN KEY ("exitOperatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parking_sessions" ADD CONSTRAINT "parking_sessions_tariffVersionId_fkey" FOREIGN KEY ("tariffVersionId") REFERENCES "tariff_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parking_sessions" ADD CONSTRAINT "parking_sessions_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parking_sessions" ADD CONSTRAINT "parking_sessions_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "agreements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "parking_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_reprints" ADD CONSTRAINT "ticket_reprints_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_reprints" ADD CONSTRAINT "ticket_reprints_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tariffs" ADD CONSTRAINT "tariffs_vehicleTypeId_fkey" FOREIGN KEY ("vehicleTypeId") REFERENCES "vehicle_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tariff_versions" ADD CONSTRAINT "tariff_versions_tariffId_fkey" FOREIGN KEY ("tariffId") REFERENCES "tariffs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "parking_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "payment_methods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_vehicleTypeId_fkey" FOREIGN KEY ("vehicleTypeId") REFERENCES "vehicle_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "parking_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "parking_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_authorizerId_fkey" FOREIGN KEY ("authorizerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
