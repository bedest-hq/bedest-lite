-- Custom SQL migration file, put your code below! --
-- [BUG-17] The organization is a singleton. Runs BEFORE the next
-- migration adds the "singleton" column and its unique index over active
-- rows: every active organization except the newest one (createdAt, then
-- id — the row GET /organization used to return) is soft-deleted. The
-- ids are reported with RAISE NOTICE so the operator can review them.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id FROM (
      SELECT id, row_number() OVER (ORDER BY "createdAt" DESC, id DESC) AS rn
      FROM "organizations"
      WHERE "isDeleted" = false
    ) ranked
    WHERE rn > 1
  LOOP
    UPDATE "organizations"
    SET "isDeleted" = true, "deletedAt" = now()
    WHERE id = r.id;
    RAISE NOTICE 'BUG-17: soft-deleted duplicate organization %', r.id;
  END LOOP;
END $$;
