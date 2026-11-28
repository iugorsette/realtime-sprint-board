BEGIN;

CREATE TYPE "ColumnColor" AS ENUM ('GRAY', 'RED', 'AMBER', 'GREEN', 'TEAL', 'BLUE', 'PURPLE', 'PINK');

ALTER TABLE "columns" ADD COLUMN "color" "ColumnColor" NOT NULL DEFAULT 'GRAY';

UPDATE "columns"
SET "color" = CASE
  WHEN "id" = 'backlog' THEN 'RED'
  WHEN "id" = 'todo' THEN 'AMBER'
  WHEN "id" = 'in-progress' THEN 'PURPLE'
  WHEN "id" = 'done' THEN 'GREEN'
  WHEN "position" = 1 THEN 'AMBER'
  WHEN "position" = 2 THEN 'PURPLE'
  WHEN "position" = 3 THEN 'GREEN'
  ELSE 'RED'
END::"ColumnColor";

COMMIT;
