-- Routine templates: shareable snapshots of a routine with every
-- person-specific value pulled out into named variables. A template never
-- runs; activating one creates an ordinary routine owned by the activator.
--
-- * `owner` is the creator's user id. Grants are `entity_access` rows
--   (`entity_type = 'routine_template'`): the owner grant on create, then view
--   grants for users and channels it is shared with. The trigger below removes
--   them when the template is deleted.
-- * Deleting the source routine keeps the template.
CREATE TABLE routine_template (
    id UUID PRIMARY KEY,
    owner TEXT NOT NULL,
    source_action_id UUID REFERENCES scheduled_action(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    task JSONB NOT NULL,
    trigger_config JSONB NOT NULL,
    variables JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_routine_template_owner ON routine_template(owner);
CREATE INDEX idx_routine_template_source_action
    ON routine_template(source_action_id) WHERE source_action_id IS NOT NULL;

CREATE FUNCTION delete_routine_template_entity_access()
    RETURNS TRIGGER
    LANGUAGE PLPGSQL
    AS
$$
    BEGIN
        DELETE FROM entity_access
        WHERE entity_type = 'routine_template' AND entity_id = OLD.id;
        RETURN NULL;
    END;
$$;

CREATE TRIGGER routine_template_entity_access_cleanup
    AFTER DELETE ON routine_template
    FOR EACH ROW EXECUTE FUNCTION delete_routine_template_entity_access();

-- Provenance of a routine activated from a template. No foreign key: the
-- template may be deleted while the routine lives on.
ALTER TABLE scheduled_action
    ADD COLUMN source_template_id UUID,
    ADD COLUMN template_bindings JSONB;

CREATE INDEX idx_scheduled_action_source_template
    ON scheduled_action(source_template_id) WHERE source_template_id IS NOT NULL;
