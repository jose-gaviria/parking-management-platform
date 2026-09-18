-- CreateTable
CREATE TABLE "auth_attempts" (
    "key" TEXT NOT NULL,
    "fails" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_attempts_pkey" PRIMARY KEY ("key")
);
