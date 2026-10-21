DELETE FROM database_column_protections WHERE capability = 'rename';

DROP TRIGGER database_column_protection ON database_columns;

CREATE OR REPLACE FUNCTION enforce_database_column_protection() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE blocked TEXT;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM database_tables t JOIN databases d ON d.id = t.database_id
        WHERE t.id = OLD.table_id
    ) THEN RETURN COALESCE(NEW, OLD); END IF;
    PERFORM 1 FROM database_tables WHERE id = OLD.table_id FOR UPDATE;
    IF TG_OP = 'DELETE' THEN blocked := 'delete';
    ELSIF NEW.property_definition_id IS DISTINCT FROM OLD.property_definition_id
       OR NEW.config IS DISTINCT FROM OLD.config THEN blocked := 'change_type';
    ELSE RETURN NEW;
    END IF;
    IF EXISTS (SELECT 1 FROM database_column_protections WHERE column_id = OLD.id AND capability = blocked) THEN
        RAISE EXCEPTION 'Column is protected against %', blocked
            USING ERRCODE = '23514', CONSTRAINT = 'database_column_protected';
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER database_column_protection
    BEFORE DELETE OR UPDATE OF property_definition_id, config ON database_columns
    FOR EACH ROW EXECUTE FUNCTION enforce_database_column_protection();

ALTER TABLE database_column_protections
    DROP CONSTRAINT database_column_protections_capability_check;
ALTER TABLE database_column_protections
    ADD CONSTRAINT database_column_protections_capability_check
    CHECK (capability IN ('delete', 'change_type'));
