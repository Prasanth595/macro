-- no-transaction
-- Each batch commits separately so the backfill does not hold row locks for the whole table.
-- Run as a single top-level statement; transaction control inside DO requires autocommit.
DO $$
DECLARE
    updated_rows integer;
BEGIN
    LOOP
        WITH batch AS (
            SELECT ctid FROM team_user WHERE membership_id IS NULL LIMIT 1000 FOR UPDATE
        )
        UPDATE team_user AS tu SET membership_id = gen_random_uuid()
        FROM batch WHERE tu.ctid = batch.ctid;
        GET DIAGNOSTICS updated_rows = ROW_COUNT;
        COMMIT;
        EXIT WHEN updated_rows = 0;
    END LOOP;
END
$$;
