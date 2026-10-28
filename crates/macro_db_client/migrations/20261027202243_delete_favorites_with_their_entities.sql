-- `favorite.entity_id` is polymorphic, so no foreign key removes a favorite
-- when its entity is deleted. A favorite left behind no longer lists but
-- still counts toward its owner's favorites cap. Triggers catch every delete
-- path, including foreign-key cascades that run no application code (a
-- team's channels and CRM records, a user's WhatsApp groups). Trashing an
-- entity ("deletedAt") keeps its favorites, since it can be restored.

SET LOCAL lock_timeout = '5s';

-- Remove the favorites already left behind, before the triggers below lock
-- the entity tables against writes until commit. Casting the favorite side
-- to uuid keeps each lookup on the entity table's primary key; ids that
-- aren't uuids can't match a uuid-keyed row, so their favorites go too.
CREATE FUNCTION pg_temp.uuid_or_null(value text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE
        WHEN value ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
            THEN value::uuid
    END
$$;

DELETE FROM favorite f
WHERE CASE f.entity_type
    WHEN 'document' THEN NOT EXISTS (SELECT 1 FROM "Document" e WHERE e.id = f.entity_id)
    WHEN 'project' THEN NOT EXISTS (SELECT 1 FROM "Project" e WHERE e.id = f.entity_id)
    WHEN 'chat' THEN NOT EXISTS (SELECT 1 FROM "Chat" e WHERE e.id = f.entity_id)
    WHEN 'channel' THEN NOT EXISTS (
        SELECT 1 FROM comms_channels e WHERE e.id = pg_temp.uuid_or_null(f.entity_id))
    WHEN 'email_thread' THEN NOT EXISTS (
        SELECT 1 FROM email_threads e WHERE e.id = pg_temp.uuid_or_null(f.entity_id))
    WHEN 'call' THEN NOT EXISTS (
        SELECT 1 FROM call_entities e WHERE e.id = pg_temp.uuid_or_null(f.entity_id))
    WHEN 'foreign_entity' THEN NOT EXISTS (
        SELECT 1 FROM foreign_entity e WHERE e.id = pg_temp.uuid_or_null(f.entity_id))
    WHEN 'crm_company' THEN NOT EXISTS (
        SELECT 1 FROM crm_companies e WHERE e.id = pg_temp.uuid_or_null(f.entity_id))
    WHEN 'crm_contact' THEN NOT EXISTS (
        SELECT 1 FROM crm_contacts e WHERE e.id = pg_temp.uuid_or_null(f.entity_id))
    WHEN 'whatsapp_group' THEN NOT EXISTS (
        SELECT 1 FROM whatsapp_group e WHERE e.id = pg_temp.uuid_or_null(f.entity_id))
    WHEN 'agent_session' THEN NOT EXISTS (
        SELECT 1 FROM agent_session e WHERE e.id = pg_temp.uuid_or_null(f.entity_id))
    ELSE false
END;

-- Statement-level, so a bulk or cascaded delete cleans up in one statement.
-- TG_ARGV[0] is the `favorite.entity_type` of the table's rows.
CREATE FUNCTION delete_favorites_of_deleted_entities() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    DELETE FROM favorite f
    USING deleted_entities d
    WHERE f.entity_type = TG_ARGV[0] AND f.entity_id = d.id::text;
    RETURN NULL;
END;
$$;

CREATE TRIGGER delete_favorites AFTER DELETE ON "Document"
REFERENCING OLD TABLE AS deleted_entities
FOR EACH STATEMENT EXECUTE FUNCTION delete_favorites_of_deleted_entities('document');

CREATE TRIGGER delete_favorites AFTER DELETE ON "Project"
REFERENCING OLD TABLE AS deleted_entities
FOR EACH STATEMENT EXECUTE FUNCTION delete_favorites_of_deleted_entities('project');

CREATE TRIGGER delete_favorites AFTER DELETE ON "Chat"
REFERENCING OLD TABLE AS deleted_entities
FOR EACH STATEMENT EXECUTE FUNCTION delete_favorites_of_deleted_entities('chat');

CREATE TRIGGER delete_favorites AFTER DELETE ON comms_channels
REFERENCING OLD TABLE AS deleted_entities
FOR EACH STATEMENT EXECUTE FUNCTION delete_favorites_of_deleted_entities('channel');

CREATE TRIGGER delete_favorites AFTER DELETE ON email_threads
REFERENCING OLD TABLE AS deleted_entities
FOR EACH STATEMENT EXECUTE FUNCTION delete_favorites_of_deleted_entities('email_thread');

CREATE TRIGGER delete_favorites AFTER DELETE ON call_entities
REFERENCING OLD TABLE AS deleted_entities
FOR EACH STATEMENT EXECUTE FUNCTION delete_favorites_of_deleted_entities('call');

CREATE TRIGGER delete_favorites AFTER DELETE ON foreign_entity
REFERENCING OLD TABLE AS deleted_entities
FOR EACH STATEMENT EXECUTE FUNCTION delete_favorites_of_deleted_entities('foreign_entity');

CREATE TRIGGER delete_favorites AFTER DELETE ON crm_companies
REFERENCING OLD TABLE AS deleted_entities
FOR EACH STATEMENT EXECUTE FUNCTION delete_favorites_of_deleted_entities('crm_company');

CREATE TRIGGER delete_favorites AFTER DELETE ON crm_contacts
REFERENCING OLD TABLE AS deleted_entities
FOR EACH STATEMENT EXECUTE FUNCTION delete_favorites_of_deleted_entities('crm_contact');

CREATE TRIGGER delete_favorites AFTER DELETE ON whatsapp_group
REFERENCING OLD TABLE AS deleted_entities
FOR EACH STATEMENT EXECUTE FUNCTION delete_favorites_of_deleted_entities('whatsapp_group');

CREATE TRIGGER delete_favorites AFTER DELETE ON agent_session
REFERENCING OLD TABLE AS deleted_entities
FOR EACH STATEMENT EXECUTE FUNCTION delete_favorites_of_deleted_entities('agent_session');
