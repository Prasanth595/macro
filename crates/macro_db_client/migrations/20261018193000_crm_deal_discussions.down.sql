DROP TRIGGER trg_cleanup_parent_message_mentions ON comms_messages;
CREATE TRIGGER trg_cleanup_parent_message_mentions
AFTER DELETE ON comms_messages
FOR EACH ROW WHEN (OLD.parent_entity_type IN ('crm_company', 'crm_contact'))
EXECUTE FUNCTION cleanup_parent_message_mentions();

DROP INDEX idx_comms_messages_crm_deal_parent;

ALTER TABLE comms_messages
    DROP COLUMN crm_deal_message_parent_id,
    DROP CONSTRAINT comms_messages_parent_type_check,
    ADD CONSTRAINT comms_messages_parent_type_check
        CHECK (parent_entity_type IN (
            'channel', 'document', 'initiative', 'crm_company', 'crm_contact', 'call'
        ));
