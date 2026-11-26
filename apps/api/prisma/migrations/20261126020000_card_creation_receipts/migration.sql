CREATE TABLE "card_creations" (
    "id" UUID NOT NULL,
    "board_id" TEXT NOT NULL,
    CONSTRAINT "card_creations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "card_creations_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "boards"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "card_creations_board_id_idx" ON "card_creations"("board_id");
