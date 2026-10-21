ALTER TABLE crm_pipeline_entities
    DROP CONSTRAINT crm_pipeline_entities_record_type_check;

ALTER TABLE crm_pipeline_entities
    ADD CONSTRAINT crm_pipeline_entities_record_type_check
        CHECK (record_type IN ('company', 'contact'));

DROP TABLE crm_deal_contacts;
DROP TABLE crm_deal_companies;
DROP TABLE crm_deals;

-- Postgres cannot drop an enum value, so `property_entity_type` keeps `DEAL`.
