CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

CREATE TABLE "boards" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "boards_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "columns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "board_id" TEXT NOT NULL,
    CONSTRAINT "columns_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "assignees" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "initials" TEXT NOT NULL,
    "board_id" TEXT NOT NULL,
    CONSTRAINT "assignees_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cards" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" "Priority" NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "position" DOUBLE PRECISION NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "column_id" TEXT NOT NULL,
    "assignee_id" TEXT,
    CONSTRAINT "cards_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "columns_board_id_position_idx" ON "columns"("board_id", "position");
CREATE INDEX "assignees_board_id_idx" ON "assignees"("board_id");
CREATE INDEX "cards_column_id_position_idx" ON "cards"("column_id", "position");
CREATE INDEX "cards_assignee_id_idx" ON "cards"("assignee_id");

ALTER TABLE "columns" ADD CONSTRAINT "columns_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assignees" ADD CONSTRAINT "assignees_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cards" ADD CONSTRAINT "cards_column_id_fkey" FOREIGN KEY ("column_id") REFERENCES "columns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cards" ADD CONSTRAINT "cards_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "assignees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
