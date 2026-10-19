-- A deal hosts its own comments. The generated key deletes them with the deal.
SET LOCAL lock_timeout = '5s';

ALTER TABLE comms_messages
    DROP CONSTRAINT comms_messages_parent_type_check,
    ADD CONSTRAINT comms_messages_parent_type_check
        CHECK (parent_entity_type IN (
            'channel', 'document', 'initiative', 'crm_company', 'crm_contact', 'crm_deal', 'call'
        )) NOT VALID,
    ADD COLUMN crm_deal_message_parent_id uuid GENERATED ALWAYS AS (
        CASE WHEN parent_entity_type = 'crm_deal' THEN parent_entity_id::uuid END
    ) STORED REFERENCES crm_deals (id) ON DELETE CASCADE;

ALTER TABLE comms_messages VALIDATE CONSTRAINT comms_messages_parent_type_check;

CREATE INDEX idx_comms_messages_crm_deal_parent
    ON comms_messages (crm_deal_message_parent_id)
    WHERE crm_deal_message_parent_id IS NOT NULL;

DROP TRIGGER trg_cleanup_parent_message_mentions ON comms_messages;
CREATE TRIGGER trg_cleanup_parent_message_mentions
AFTER DELETE ON comms_messages
FOR EACH ROW WHEN (OLD.parent_entity_type IN ('crm_company', 'crm_contact', 'crm_deal'))
EXECUTE FUNCTION cleanup_parent_message_mentions();
