BEGIN;

SELECT "id" FROM "boards" WHERE "id" = 'sprint-board' FOR UPDATE;

WITH migrated AS (
  UPDATE "cards" AS card
  SET "id" = mapping.new_id
  FROM "columns" AS lane, (VALUES
    ('backlog-1', '753e682e-1752-4dce-87b8-128b3638e398'),
    ('backlog-2', 'c1bdcae3-5080-4da5-8853-acb9fd36914e'),
    ('backlog-3', '021f44c2-60aa-41ee-9bcb-b844a13d3261'),
    ('todo-1', 'ca5e449e-9978-4ca9-a47d-47981e0ed214'),
    ('todo-2', '70a610c9-470b-4232-8a62-b91de0d526fc'),
    ('todo-3', '281b02be-2633-4982-8607-7d9c08406146'),
    ('in-progress-1', 'd19276c5-7dfc-4cb2-aee8-f30fb37b216a'),
    ('in-progress-2', '734bbc72-5f40-4342-9ccc-346070b5d81c'),
    ('in-progress-3', '51d5a5f4-636c-435a-8094-3213e9fdcdfd'),
    ('done-1', 'a7f92653-0296-490a-8855-c30163ae92b0'),
    ('done-2', '9f53aa4c-fd18-480b-ad5e-b8a778f1f04b'),
    ('done-3', '0e8be58e-77e1-4f39-a7fb-fe7e2fe8c678')
  ) AS mapping(old_id, new_id)
  WHERE card."id" = mapping.old_id AND card."column_id" = lane."id" AND lane."board_id" = 'sprint-board'
  RETURNING card."id"
)
UPDATE "boards" SET "revision" = "revision" + 1
WHERE "id" = 'sprint-board' AND EXISTS (SELECT 1 FROM migrated);

COMMIT;
