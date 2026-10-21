-- A deal is a CRM record a pipeline can point at. Companies and people
-- stay the directory; a deal links the ones it involves.
CREATE TABLE crm_deals (
    id UUID PRIMARY KEY,
    team_id UUID NOT NULL REFERENCES team (id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX crm_deals_team_id_idx ON crm_deals (team_id);

CREATE TABLE crm_deal_companies (
    deal_id UUID NOT NULL REFERENCES crm_deals (id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES crm_companies (id) ON DELETE CASCADE,
    PRIMARY KEY (deal_id, company_id)
);

CREATE INDEX crm_deal_companies_company_id_idx ON crm_deal_companies (company_id);

CREATE TABLE crm_deal_contacts (
    deal_id UUID NOT NULL REFERENCES crm_deals (id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES crm_contacts (id) ON DELETE CASCADE,
    PRIMARY KEY (deal_id, contact_id)
);

CREATE INDEX crm_deal_contacts_contact_id_idx ON crm_deal_contacts (contact_id);

ALTER TYPE property_entity_type ADD VALUE IF NOT EXISTS 'DEAL';

ALTER TABLE crm_pipeline_entities
    DROP CONSTRAINT crm_pipeline_entities_record_type_check;

ALTER TABLE crm_pipeline_entities
    ADD CONSTRAINT crm_pipeline_entities_record_type_check
        CHECK (record_type IN ('company', 'contact', 'deal'));
