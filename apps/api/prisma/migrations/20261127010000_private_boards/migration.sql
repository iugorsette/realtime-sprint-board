BEGIN;

-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('EDITOR', 'VIEWER');

-- AlterTable
ALTER TABLE "boards" ADD COLUMN     "owner_id" TEXT;

-- AlterTable
ALTER TABLE "assignees" ADD COLUMN     "account_id" TEXT;

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "avatar" BYTEA,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "digest" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("digest")
);

-- CreateTable
CREATE TABLE "login_codes" (
    "email" TEXT NOT NULL,
    "digest" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "login_codes_pkey" PRIMARY KEY ("email")
);

-- CreateTable
CREATE TABLE "auth_limits" (
    "key" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_limits_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "board_members" (
    "board_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL,

    CONSTRAINT "board_members_pkey" PRIMARY KEY ("board_id","account_id")
);

-- CreateTable
CREATE TABLE "board_invites" (
    "board_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "board_invites_pkey" PRIMARY KEY ("board_id","email")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_email_key" ON "accounts"("email");

-- CreateIndex
CREATE INDEX "sessions_account_id_idx" ON "sessions"("account_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE INDEX "login_codes_expires_at_idx" ON "login_codes"("expires_at");

-- CreateIndex
CREATE INDEX "auth_limits_expires_at_idx" ON "auth_limits"("expires_at");

-- CreateIndex
CREATE INDEX "board_members_account_id_idx" ON "board_members"("account_id");

-- CreateIndex
CREATE INDEX "board_invites_email_expires_at_idx" ON "board_invites"("email", "expires_at");

-- CreateIndex
CREATE INDEX "boards_owner_id_idx" ON "boards"("owner_id");

-- CreateIndex
CREATE INDEX "assignees_account_id_idx" ON "assignees"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "assignees_board_id_account_id_key" ON "assignees"("board_id", "account_id");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "board_members" ADD CONSTRAINT "board_members_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "board_members" ADD CONSTRAINT "board_members_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "board_invites" ADD CONSTRAINT "board_invites_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boards" ADD CONSTRAINT "boards_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignees" ADD CONSTRAINT "assignees_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
