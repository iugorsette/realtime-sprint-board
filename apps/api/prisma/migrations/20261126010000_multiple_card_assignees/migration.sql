BEGIN;

CREATE TABLE "card_assignees" (
    "card_id" TEXT NOT NULL,
    "assignee_id" TEXT NOT NULL,
    CONSTRAINT "card_assignees_pkey" PRIMARY KEY ("card_id", "assignee_id"),
    CONSTRAINT "card_assignees_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "card_assignees_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "assignees"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "card_assignees_assignee_id_idx" ON "card_assignees"("assignee_id");

INSERT INTO "card_assignees" ("card_id", "assignee_id")
SELECT "id", "assignee_id"
FROM "cards"
WHERE "assignee_id" IS NOT NULL;

ALTER TABLE "cards" DROP COLUMN "assignee_id";

COMMIT;
